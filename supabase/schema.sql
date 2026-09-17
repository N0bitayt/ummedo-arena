-- Run this in the Supabase SQL editor before enabling persistence.
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  bio text,
  real_name text,
  preferred_games text[] not null default '{}',
  game_name text,
  character_id text,
  wallet_balance numeric(12, 2) not null default 2840,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  transaction_type text not null check (transaction_type in ('deposit', 'entry', 'win', 'withdrawal')),
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tournament_key text not null,
  team_id uuid,
  game text not null,
  entry_fee numeric(12, 2) not null default 0,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  unique (user_id, tournament_key)
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  tournament_key text not null unique,
  game text not null,
  title text not null,
  format text not null,
  prize_pool numeric(12, 2) not null default 0,
  entry_fee numeric(12, 2) not null default 0,
  max_players integer not null default 100,
  accent text not null default 'lime',
  match_status text not null default 'upcoming' check (match_status in ('upcoming', 'live', 'completed')),
  room_id text,
  room_password text,
  starts_at timestamptz,
  map_name text,
  mode text not null default 'Solo',
  slots_total integer not null default 100,
  slots_filled integer not null default 0,
  stream_url text,
  spectator_count integer not null default 0,
  winner_user_id uuid references auth.users(id),
  winner_prize numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_key text not null references public.tournaments(tournament_key) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rank integer not null,
  prize_amount numeric(12, 2) not null default 0,
  kills integer not null default 0,
  match_points integer not null default 0,
  declared_at timestamptz not null default now(),
  unique (tournament_key, user_id),
  unique (tournament_key, rank)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  team_name text not null,
  team_tag text not null,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  invite_email text,
  role text not null default 'member' check (role in ('leader', 'member')),
  ign text,
  character_id text,
  status text not null default 'invited' check (status in ('invited', 'accepted')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id),
  unique (team_id, invite_email)
);

alter table public.tournament_registrations add column if not exists ign text;
alter table public.tournament_registrations add column if not exists character_id text;
alter table public.tournament_registrations add column if not exists room_seen_at timestamptz;
alter table public.tournaments add column if not exists starts_at timestamptz;
alter table public.tournaments add column if not exists map_name text;
alter table public.tournaments add column if not exists mode text not null default 'Solo';
alter table public.tournaments add column if not exists slots_total integer not null default 100;
alter table public.tournaments add column if not exists slots_filled integer not null default 0;
alter table public.tournaments add column if not exists stream_url text;
alter table public.tournaments add column if not exists spectator_count integer not null default 0;
alter table public.tournament_results add column if not exists kills integer not null default 0;
alter table public.tournament_results add column if not exists match_points integer not null default 0;
alter table public.tournament_registrations add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists real_name text;
alter table public.users add column if not exists preferred_games text[] not null default '{}';
alter table public.users add column if not exists game_name text;
alter table public.users add column if not exists character_id text;

alter table public.users enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_results enable row level security;
alter table public.admin_users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "Users can view their own profile" on public.users for select using (auth.uid() = id);
create policy "Users can insert their own profile" on public.users for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.users for update using (auth.uid() = id);
create policy "Admins can view player profiles" on public.users for select using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "Admins can update player balances" on public.users for update using (exists (select 1 from public.admin_users where user_id = auth.uid()));

create policy "Users can view their own transactions" on public.wallet_transactions for select using (auth.uid() = user_id);
create policy "Users can add their own transactions" on public.wallet_transactions for insert with check (auth.uid() = user_id);

create policy "Users can view their own registrations" on public.tournament_registrations for select using (auth.uid() = user_id);
create policy "Users can register themselves" on public.tournament_registrations for insert with check (auth.uid() = user_id);
create policy "Admins can view registrations" on public.tournament_registrations for select using (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "Everyone can view tournaments" on public.tournaments for select using (true);
create policy "Players can view their own results" on public.tournament_results for select using (auth.uid() = user_id);
create policy "Admins can manage tournaments" on public.tournaments for all using (exists (select 1 from public.admin_users where user_id = auth.uid())) with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "Admins can manage results" on public.tournament_results for all using (exists (select 1 from public.admin_users where user_id = auth.uid())) with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "Admins can record prize transactions" on public.wallet_transactions for insert with check (exists (select 1 from public.admin_users where user_id = auth.uid()));
create policy "Admins can view admin allowlist" on public.admin_users for select using (auth.uid() = user_id);
create policy "Team members can view their teams" on public.teams for select using (owner_id = auth.uid() or exists (select 1 from public.team_members where team_id = teams.id and user_id = auth.uid()));
create policy "Users can create teams" on public.teams for insert with check (owner_id = auth.uid());
create policy "Team owners can update teams" on public.teams for update using (owner_id = auth.uid());
create policy "Team owners can delete teams" on public.teams for delete using (owner_id = auth.uid());
create policy "Team members can view memberships" on public.team_members for select using (user_id = auth.uid() or exists (select 1 from public.teams where teams.id = team_members.team_id and teams.owner_id = auth.uid()));
create policy "Team owners can add memberships" on public.team_members for insert with check (exists (select 1 from public.teams where teams.id = team_members.team_id and teams.owner_id = auth.uid()));
create policy "Team owners can remove memberships" on public.team_members for delete using (exists (select 1 from public.teams where teams.id = team_members.team_id and teams.owner_id = auth.uid()));

alter table public.users replica identity full;
alter table public.wallet_transactions replica identity full;
alter table public.tournament_registrations replica identity full;
alter table public.tournaments replica identity full;
alter table public.tournament_results replica identity full;
alter table public.admin_users replica identity full;
alter table public.teams replica identity full;
alter table public.team_members replica identity full;

-- Enable these tables under Database > Replication for realtime updates.

-- The React client currently authenticates with Firebase. In production, configure
-- Supabase Third-Party Auth to trust Firebase ID tokens so auth.uid() matches the
-- Firebase user id. Otherwise, route these writes through a trusted Edge Function.
