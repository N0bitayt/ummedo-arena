-- Apply after schema.sql. All changes are transactional and safe to re-run.
begin;

alter table public.users alter column wallet_balance set default 0;
-- Existing balances are preserved: reconcile historical demo credits separately.
revoke insert, update, delete on public.users from anon, authenticated;
grant update (display_name, avatar_url, bio, real_name, preferred_games, game_name, character_id, updated_at) on public.users to authenticated;
revoke insert, update, delete on public.wallet_transactions, public.tournament_registrations, public.tournament_results from anon, authenticated;
revoke all on public.tournaments from anon, authenticated;

create table if not exists public.tournament_rooms (
  tournament_key text primary key references public.tournaments(tournament_key) on delete cascade,
  room_id text,
  room_password text
);
alter table public.tournament_rooms enable row level security;
revoke all on public.tournament_rooms from anon, authenticated;
insert into public.tournament_rooms(tournament_key, room_id, room_password)
select tournament_key, room_id, room_password from public.tournaments
where room_id is not null or room_password is not null
on conflict (tournament_key) do update set room_id = excluded.room_id, room_password = excluded.room_password;
update public.tournaments set room_id = null, room_password = null where room_id is not null or room_password is not null;

-- An explicit column list is essential: room credentials never enter public reads.
create or replace view public.tournament_catalog as
select tournament_key, game, title, format, prize_pool, entry_fee, accent, match_status,
       starts_at, map_name, mode, slots_total, slots_filled, stream_url, spectator_count, created_at
from public.tournaments;
revoke all on public.tournament_catalog from public, anon, authenticated;
grant select on public.tournament_catalog to anon, authenticated;

create or replace function public.is_arena_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.ensure_profile() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into public.users(id, email, display_name, avatar_url, wallet_balance)
  select id, coalesce(email, ''), coalesce(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name'), raw_user_meta_data->>'avatar_url', 0
  from auth.users where id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

create or replace function public.join_tournament(p_key text, p_ign text, p_character_id text, p_team uuid default null) returns numeric
language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; balance numeric;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if length(trim(p_ign)) not between 1 and 64 or length(trim(p_character_id)) not between 1 and 64 or p_ign is null or p_character_id is null then raise exception 'Enter a valid IGN and player ID'; end if;
  if p_team is not null and not exists(select 1 from public.teams where id = p_team and owner_id = auth.uid()) then raise exception 'Only the team owner can register this team'; end if;
  select * into t from public.tournaments where tournament_key = p_key for update;
  if not found then raise exception 'Tournament not found'; end if;
  -- A retry of a successful request never deducts funds twice.
  if exists(select 1 from public.tournament_registrations where tournament_key = p_key and user_id = auth.uid()) then
    return (select wallet_balance from public.users where id = auth.uid());
  end if;
  if t.match_status <> 'upcoming' or (t.starts_at is not null and t.starts_at <= now()) then raise exception 'Registration is closed'; end if;
  if t.slots_filled >= t.slots_total then raise exception 'Tournament is full'; end if;
  if t.entry_fee < 0 or t.entry_fee::text in ('NaN', 'Infinity', '-Infinity') then raise exception 'Invalid entry fee'; end if;
  perform public.ensure_profile();
  update public.users set wallet_balance = wallet_balance - t.entry_fee, updated_at = now()
    where id = auth.uid() and wallet_balance >= t.entry_fee returning wallet_balance into balance;
  if not found then raise exception 'Insufficient wallet balance'; end if;
  insert into public.tournament_registrations(user_id, tournament_key, game, entry_fee, ign, character_id, team_id)
    values(auth.uid(), p_key, t.game, t.entry_fee, trim(p_ign), trim(p_character_id), p_team);
  if t.entry_fee > 0 then
    insert into public.wallet_transactions(user_id, title, transaction_type, amount)
      values(auth.uid(), 'Match entry · ' || t.title, 'entry', -t.entry_fee);
  end if;
  update public.tournaments set slots_filled = slots_filled + 1, updated_at = now() where tournament_key = p_key;
  return balance;
end;
$$;

create or replace function public.save_tournament(p_key text, p_game text, p_title text, p_format text, p_entry numeric, p_prize numeric, p_status text, p_room_id text, p_room_password text, p_stream_url text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_arena_admin() then raise exception 'Admin access required'; end if;
  if coalesce(length(trim(p_title)), 0) = 0 or coalesce(length(trim(p_game)), 0) = 0 or coalesce(length(trim(p_format)), 0) = 0 then raise exception 'Title, game and format are required'; end if;
  if p_entry is null or p_prize is null or p_entry < 0 or p_prize < 0 or p_entry::text in ('NaN','Infinity','-Infinity') or p_prize::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid entry or prize amount'; end if;
  perform 1 from public.tournaments where tournament_key = p_key for update;
  if exists(select 1 from public.tournament_results where tournament_key = p_key) and p_status <> 'completed' then raise exception 'A settled tournament cannot be reopened'; end if;
  insert into public.tournaments(tournament_key, game, title, format, entry_fee, prize_pool, match_status, stream_url)
    values(p_key, trim(p_game), trim(p_title), trim(p_format), p_entry, p_prize, p_status, nullif(trim(p_stream_url), ''))
  on conflict(tournament_key) do update set game = excluded.game, title = excluded.title, format = excluded.format, entry_fee = excluded.entry_fee, prize_pool = excluded.prize_pool, match_status = excluded.match_status, stream_url = excluded.stream_url, updated_at = now();
  insert into public.tournament_rooms(tournament_key, room_id, room_password) values(p_key, nullif(trim(p_room_id), ''), nullif(trim(p_room_password), ''))
  on conflict(tournament_key) do update set room_id = excluded.room_id, room_password = excluded.room_password;
end;
$$;

create or replace function public.declare_winner(p_key text, p_ign text, p_character_id text, p_prize numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.tournaments; winner uuid;
begin
  if not public.is_arena_admin() then raise exception 'Admin access required'; end if;
  select * into t from public.tournaments where tournament_key = p_key for update;
  if not found then raise exception 'Tournament not found'; end if;
  if p_prize is null or p_prize < 0 or p_prize > t.prize_pool or p_prize::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid prize amount'; end if;
  if exists(select 1 from public.tournament_results where tournament_key = p_key) then raise exception 'Results already settled'; end if;
  begin
    select user_id into strict winner from public.tournament_registrations where tournament_key = p_key and ign = trim(p_ign) and character_id = trim(p_character_id);
  exception when no_data_found then raise exception 'Winner must be a registered player';
            when too_many_rows then raise exception 'Winner identity is ambiguous';
  end;
  insert into public.tournament_results(tournament_key, user_id, rank, prize_amount) values(p_key, winner, 1, p_prize);
  if p_prize > 0 then
    update public.users set wallet_balance = wallet_balance + p_prize, updated_at = now() where id = winner;
    insert into public.wallet_transactions(user_id, title, transaction_type, amount) values(winner, 'Prize winnings · ' || t.title, 'win', p_prize);
  end if;
  update public.tournaments set match_status = 'completed', winner_user_id = winner, winner_prize = p_prize, updated_at = now() where tournament_key = p_key;
end;
$$;

create or replace function public.my_rooms() returns table(tournament_key text, room_id text, room_password text)
language sql stable security definer set search_path = '' as $$
  select r.tournament_key, r.room_id, r.room_password from public.tournament_rooms r
  join public.tournaments t using(tournament_key)
  where public.is_arena_admin() or (t.match_status <> 'completed' and (t.starts_at is null or t.starts_at <= now() + interval '15 minutes')
    and exists(select 1 from public.tournament_registrations reg where reg.tournament_key = t.tournament_key and reg.user_id = auth.uid()));
$$;

create or replace function public.public_results() returns table(tournament_key text, user_id uuid, ign text, rank integer, kills integer, match_points integer, prize_amount numeric)
language sql stable security definer set search_path = '' as $$
  select r.tournament_key, r.user_id, coalesce(reg.ign, 'Player'), r.rank, r.kills, r.match_points, r.prize_amount
  from public.tournament_results r join public.tournaments t using(tournament_key)
  left join public.tournament_registrations reg on reg.tournament_key = r.tournament_key and reg.user_id = r.user_id
  where t.match_status = 'completed';
$$;

-- Security-definer membership helpers break the teams <-> team_members RLS cycle.
create or replace function public.owns_team(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.teams where id = p_team and owner_id = auth.uid());
$$;
create or replace function public.belongs_to_team(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.owns_team(p_team) or exists(select 1 from public.team_members where team_id = p_team and user_id = auth.uid() and status = 'accepted');
$$;
drop policy if exists "Team members can view their teams" on public.teams;
create policy "Team members can view their teams" on public.teams for select to authenticated using(public.belongs_to_team(id));
drop policy if exists "Team members can view memberships" on public.team_members;
create policy "Team members can view memberships" on public.team_members for select to authenticated using(public.belongs_to_team(team_id));
drop policy if exists "Team owners can add memberships" on public.team_members;
create policy "Team owners can add memberships" on public.team_members for insert to authenticated with check(public.owns_team(team_id));
drop policy if exists "Team owners can remove memberships" on public.team_members;
create policy "Team owners can remove memberships" on public.team_members for delete to authenticated using(public.owns_team(team_id));

create or replace function public.create_arena_team(p_name text, p_tag text, p_logo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare team uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if coalesce(length(trim(p_name)), 0) = 0 or coalesce(length(trim(p_tag)), 0) not between 1 and 5 then raise exception 'Enter a team name and tag (1–5 characters)'; end if;
  perform public.ensure_profile();
  insert into public.teams(owner_id, team_name, team_tag, logo_url) values(auth.uid(), trim(p_name), upper(trim(p_tag)), nullif(p_logo, '')) returning id into team;
  insert into public.team_members(team_id, user_id, role, ign, character_id, status)
    select team, id, 'leader', game_name, character_id, 'accepted' from public.users where id = auth.uid();
  return team;
end;
$$;

create or replace function public.invite_teammate(p_team uuid, p_lookup text, p_ign text, p_character_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare player public.users; matches integer;
begin
  if not public.owns_team(p_team) then raise exception 'Only the team owner can invite players'; end if;
  select count(*) into matches from public.users where lower(email) = lower(trim(p_lookup)) or game_name = trim(p_lookup) or character_id = trim(p_lookup) or id::text = trim(p_lookup);
  if matches > 1 then raise exception 'Multiple players matched; use an exact email or user ID'; end if;
  select * into player from public.users where lower(email) = lower(trim(p_lookup)) or game_name = trim(p_lookup) or character_id = trim(p_lookup) or id::text = trim(p_lookup);
  if player.id is null and position('@' in p_lookup) = 0 then raise exception 'Player not found; invite using an email address'; end if;
  insert into public.team_members(team_id, user_id, invite_email, role, ign, character_id, status)
    values(p_team, player.id, case when player.id is null then lower(trim(p_lookup)) end, 'member', coalesce(nullif(trim(p_ign), ''), player.game_name), coalesce(nullif(trim(p_character_id), ''), player.character_id), case when player.id is null then 'invited' else 'accepted' end);
end;
$$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  -- Keep financial records until funds and open registrations have been resolved.
  if exists(select 1 from public.users where id = auth.uid() and wallet_balance <> 0) then raise exception 'Resolve your wallet balance with support before deleting your account'; end if;
  if exists(select 1 from public.tournament_registrations r join public.tournaments t using(tournament_key) where r.user_id = auth.uid() and t.match_status <> 'completed') then raise exception 'Wait until your registered tournaments finish before deleting your account'; end if;
  update public.tournaments set winner_user_id = null where winner_user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

-- Explicit function allowlist: PostgreSQL otherwise grants EXECUTE to PUBLIC.
revoke all on function public.is_arena_admin(), public.ensure_profile(), public.join_tournament(text,text,text,uuid), public.save_tournament(text,text,text,text,numeric,numeric,text,text,text,text), public.declare_winner(text,text,text,numeric), public.my_rooms(), public.public_results(), public.owns_team(uuid), public.belongs_to_team(uuid), public.create_arena_team(text,text,text), public.invite_teammate(uuid,text,text,text), public.delete_my_account() from public, anon, authenticated;
grant execute on function public.public_results() to anon, authenticated;
grant execute on function public.is_arena_admin(), public.ensure_profile(), public.join_tournament(text,text,text,uuid), public.save_tournament(text,text,text,text,numeric,numeric,text,text,text,text), public.declare_winner(text,text,text,numeric), public.my_rooms(), public.owns_team(uuid), public.belongs_to_team(uuid), public.create_arena_team(text,text,text), public.invite_teammate(uuid,text,text,text), public.delete_my_account() to authenticated;
commit;
