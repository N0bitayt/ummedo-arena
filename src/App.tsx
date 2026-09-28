import React from 'react';
import {
  ArrowUpRight, Bell, ChevronDown, CircleDollarSign, Gamepad2, Grid2X2,
  LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, Swords,
  Trophy, Users, Wallet, X, LoaderCircle, Copy,
  Check, CreditCard, History, Hash, Plus, ShieldAlert, Save, Crown,
  Image, UserRound, Trash2, UserPlus, MoreHorizontal, Activity,
} from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { supabase } from './supabase';
import AuthDialog from './AuthDialog';
import './App.css';

type Tournament = {
  game: string; title: string; format: string; prize: string; entry: string;
  players: string; accent: string; icon: React.ReactNode; status: string;
  tournamentKey: string; matchStatus: 'upcoming' | 'live' | 'completed';
  roomId?: string; roomPassword?: string; winnerName?: string; startsAt?: string;
  mapName?: string; mode?: string; slotsTotal?: number; slotsFilled?: number;
  kills?: number; matchPoints?: number;
  streamUrl?: string; spectatorCount?: number;
};

type Transaction = {
  id?: string;
  title: string;
  date: string;
  amount: number;
  kind: 'deposit' | 'entry' | 'win' | 'withdrawal';
};

type AppTab = 'dashboard' | 'tournaments' | 'teams' | 'wallet' | 'leaderboard' | 'settings';
type ArenaUser = { uid: string; email: string | null; displayName: string | null; photoURL: string | null };

type TeamMember = { id: string; userId?: string; email?: string; role: 'leader' | 'member'; ign: string; characterId: string; status: string };
type Team = { id: string; name: string; tag: string; logoUrl: string; members: TeamMember[] };

const tournaments: Tournament[] = [
  { game: 'BGMI', title: 'Night Ops: Squad Showdown', format: 'Squad · 4v4', prize: '₹25,000', entry: '₹99', players: '128 / 256', accent: 'lime', icon: <Swords size={22} strokeWidth={1.8} />, status: 'Starting in 18m', tournamentKey: 'night-ops', matchStatus: 'upcoming' },
  { game: 'Valorant', title: 'Neon Clash Open Qualifier', format: 'Team · 5v5', prize: '₹50,000', entry: '₹199', players: '32 / 64', accent: 'red', icon: <ShieldCheck size={22} strokeWidth={1.8} />, status: 'Starting in 42m', tournamentKey: 'neon-clash', matchStatus: 'upcoming' },
  { game: 'Free Fire MAX', title: 'Street Kings Solo Rush', format: 'Solo · Battle Royale', prize: '₹10,000', entry: 'Free', players: '76 / 100', accent: 'violet', icon: <Gamepad2 size={22} strokeWidth={1.8} />, status: 'Starting in 1h 10m', tournamentKey: 'street-kings', matchStatus: 'upcoming' },
  { game: 'COD Mobile', title: 'Deadzone Domination', format: 'Duo · 2v2', prize: '₹15,000', entry: '₹49', players: '48 / 128', accent: 'blue', icon: <CrosshairIcon />, status: 'Starting in 2h', tournamentKey: 'deadzone', matchStatus: 'upcoming' },
];

function CrosshairIcon() {
  return <span className="crosshair-icon" aria-hidden="true"><span /></span>;
}

function HashIcon() {
  return <Hash size={16} />;
}

function App() {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [dataError, setDataError] = React.useState('');
  const [dataLoading, setDataLoading] = React.useState(false);
  const [reload, setReload] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [gameFilter, setGameFilter] = React.useState('All games');
  const [results, setResults] = React.useState<{ tournament_key: string; user_id: string; ign: string; rank: number; kills: number; match_points: number; prize_amount: number }[]>([]);
  const [adminBusy, setAdminBusy] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<AppTab>(() => { const tab = window.location.hash.slice(1); return ['dashboard', 'tournaments', 'teams', 'wallet', 'leaderboard', 'settings'].includes(tab) ? tab as AppTab : 'dashboard'; });
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<'login' | 'signup'>('login');
  const [user, setUser] = React.useState<ArenaUser | null>(null);
  const [walletOpen, setWalletOpen] = React.useState(false);
  const [walletTab, setWalletTab] = React.useState<'add' | 'withdraw'>('add');
  const [walletBalance, setWalletBalance] = React.useState(0);
  const [customAmount, setCustomAmount] = React.useState('');
  const [selectedAmount, setSelectedAmount] = React.useState(100);
  const [walletMessage, setWalletMessage] = React.useState('');
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [registeredTournaments, setRegisteredTournaments] = React.useState<string[]>([]);
  const [pendingTournament, setPendingTournament] = React.useState<Tournament | null>(null);
    const [joinForm, setJoinForm] = React.useState({ ign: '', characterId: '' });
  const [joinTeam, setJoinTeam] = React.useState('');
  const [joinError, setJoinError] = React.useState('');
  const [joinBusy, setJoinBusy] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState({ avatarUrl: '', bio: '', realName: '', preferredGames: [] as string[], gameName: '', characterId: '' });
  const [profileMessage, setProfileMessage] = React.useState('');
  const [profileBusy, setProfileBusy] = React.useState(false);
  const loadedProfile = React.useRef<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [copyField, setCopyField] = React.useState('');
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [teamModalOpen, setTeamModalOpen] = React.useState(false);
  const [inviteModal, setInviteModal] = React.useState<Team | null>(null);
  const [teamForm, setTeamForm] = React.useState({ name: '', tag: '', logoUrl: '' });
  const [teamLogoFile, setTeamLogoFile] = React.useState<File | null>(null);
  const [inviteForm, setInviteForm] = React.useState({ lookup: '', ign: '', characterId: '' });
  const [teamMessage, setTeamMessage] = React.useState('');
  const [teamBusy, setTeamBusy] = React.useState(false);
  const [tournamentList, setTournamentList] = React.useState<Tournament[]>(supabase ? [] : tournaments);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [adminTournament, setAdminTournament] = React.useState<Tournament | null>(null);
  const [adminForm, setAdminForm] = React.useState({ game: 'BGMI', title: '', format: 'Solo', entry: '0', prize: '10000', matchStatus: 'upcoming', roomId: '', roomPassword: '', streamUrl: '' });
  const [adminMessage, setAdminMessage] = React.useState('');
  const [resultForm, setResultForm] = React.useState({ ign: '', characterId: '', prize: '' });
  React.useEffect(() => {
    if (supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        const account = session?.user;
        setUser(account ? { uid: account.id, email: account.email || null, displayName: account.user_metadata?.display_name || account.user_metadata?.full_name || null, photoURL: account.user_metadata?.avatar_url || null } : null);
      });
      return () => listener.subscription.unsubscribe();
    }
    if (auth) return onAuthStateChanged(auth, (account) => setUser(account ? { uid: account.uid, email: account.email, displayName: account.displayName, photoURL: account.photoURL } : null));
    return undefined;
  }, []);

  React.useEffect(() => {
    loadedProfile.current = null;
    setWalletBalance(0); setTransactions([]); setRegisteredTournaments([]); setTeams([]); setIsAdmin(false);
    setProfileForm({ avatarUrl: '', bio: '', realName: '', preferredGames: [], gameName: '', characterId: '' });
    setTournamentList((items) => items.map((item) => ({ ...item, roomId: undefined, roomPassword: undefined })));
    setProfileMessage(''); setWalletMessage(''); setTeamMessage(''); setAdminMessage('');
    setJoinTeam('');
    setPendingTournament(null); setWalletOpen(false); setAdminOpen(false); setTeamModalOpen(false); setInviteModal(null);
  }, [user?.uid]);

  React.useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let request = 0;
    const load = async () => {
      const version = ++request;
      setDataLoading(true);
      try {
        const remote = await client.from('tournament_catalog').select('*').order('created_at', { ascending: false });
        if (remote.error) throw remote.error;
        const rankings = await client.rpc('public_results');
        if (rankings.error) throw rankings.error;
        if (!active || version !== request) return;
        setResults(rankings.data || []);
        setTournamentList((remote.data || []).map((item) => ({
          game: item.game, title: item.title, format: item.format, prize: `₹${Number(item.prize_pool).toLocaleString('en-IN')}`, entry: Number(item.entry_fee) ? `₹${Number(item.entry_fee).toLocaleString('en-IN')}` : 'Free', players: `${item.slots_filled} / ${item.slots_total}`, accent: item.accent || 'lime', icon: <Gamepad2 size={22} />, status: item.match_status === 'live' ? 'Live now' : item.match_status === 'completed' ? 'Completed' : 'Upcoming', tournamentKey: item.tournament_key, matchStatus: item.match_status, startsAt: item.starts_at, mapName: item.map_name, mode: item.mode, slotsTotal: item.slots_total, slotsFilled: item.slots_filled, streamUrl: item.stream_url, spectatorCount: item.spectator_count || 0,
          winnerName: rankings.data?.find((r: { tournament_key: string; rank: number }) => r.tournament_key === item.tournament_key && r.rank === 1)?.ign,
          kills: rankings.data?.find((r: { tournament_key: string; rank: number }) => r.tournament_key === item.tournament_key && r.rank === 1)?.kills,
          matchPoints: rankings.data?.find((r: { tournament_key: string; rank: number }) => r.tournament_key === item.tournament_key && r.rank === 1)?.match_points,
        })));
        if (user) {
          const ensured = await client.rpc('ensure_profile');
          if (ensured.error) throw ensured.error;
          const responses = await Promise.all([
            client.from('users').select('*').eq('id', user.uid).single(),
            client.from('wallet_transactions').select('id,title,amount,transaction_type,created_at').eq('user_id', user.uid).order('created_at', { ascending: false }).limit(30),
            client.from('tournament_registrations').select('tournament_key').eq('user_id', user.uid),
            client.from('teams').select('id,team_name,team_tag,logo_url,team_members(id,user_id,invite_email,role,ign,character_id,status)'),
            client.from('admin_users').select('user_id').eq('user_id', user.uid),
            client.rpc('my_rooms'),
          ]);
          const failed = responses.find((response) => response.error);
          if (failed?.error) throw failed.error;
          if (!active || version !== request) return;
          const [profile, history, registrations, remoteTeams, admins, rooms] = responses;
          const row = profile.data;
          setWalletBalance(Number(row.wallet_balance));
          if (loadedProfile.current !== user.uid) { setProfileForm({ avatarUrl: row.avatar_url || '', bio: row.bio || '', realName: row.real_name || '', preferredGames: row.preferred_games || [], gameName: row.game_name || '', characterId: row.character_id || '' }); loadedProfile.current = user.uid; }
          setTransactions((history.data || []).map((t: any) => ({ id: t.id, title: t.title, date: new Date(t.created_at).toLocaleString('en-IN'), amount: Number(t.amount), kind: t.transaction_type })));
          setRegisteredTournaments((registrations.data || []).map((r: any) => r.tournament_key));
          setTeams((remoteTeams.data || []).map((team: any) => ({ id: team.id, name: team.team_name, tag: team.team_tag, logoUrl: team.logo_url || '', members: (team.team_members || []).map((m: any) => ({ id: m.id, userId: m.user_id, email: m.invite_email, role: m.role, ign: m.ign || '', characterId: m.character_id || '', status: m.status })) })));
          setIsAdmin(Boolean(admins.data?.length));
          setTournamentList((items) => items.map((item) => { const room = rooms.data?.find((r: any) => r.tournament_key === item.tournamentKey); return { ...item, roomId: room?.room_id, roomPassword: room?.room_password }; }));
        }
        if (active) setDataError('');
      } catch (error) {
        if (active) setDataError(error instanceof Error ? error.message : (error as { message?: string }).message || 'Arena data could not be loaded. Please retry.');
      } finally { if (active && version === request) setDataLoading(false); }
    };
    void load();
    const channel = client.channel(`arena-${user?.uid || 'guest'}`);
    ['tournaments', 'tournament_results', 'wallet_transactions', 'tournament_registrations', 'teams', 'team_members'].forEach((table) => channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void load(); }));
    channel.subscribe();
    // Polling also releases room credentials when the 15-minute window opens.
    const timer = window.setInterval(() => { void load(); }, 60000);
    return () => { active = false; window.clearInterval(timer); void client.removeChannel(channel); };
  }, [user, reload]);

  const openAuthModal = (mode: 'login' | 'signup' = 'login') => { setAuthMode(mode); setAuthModalOpen(true); };
  const handleLogout = async () => {
    try {
      if (supabase) { const response = await supabase.auth.signOut(); if (response.error) throw response.error; }
      else if (auth) await signOut(auth);
      window.localStorage.removeItem('ummedo-arena-user');
      setUser(null);
    } catch { setDataError('Sign out failed. Please retry.'); }
  };

  const handleJoin = async (tournament?: Tournament) => {
    setActiveTab('tournaments');
    if (!user) openAuthModal('login');
    if (!user || !tournament || registeredTournaments.includes(tournament.tournamentKey) || !canJoin(tournament)) return;
    setJoinForm({ ign: profileForm.gameName, characterId: profileForm.characterId });
    setJoinError('');
    setPendingTournament(tournament);
  };

  const closeJoinModal = () => {
    if (!joinBusy) setPendingTournament(null);
  };

  const handleJoinConfirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingTournament || !user) return;
    if (joinBusy) return;
    if (!joinForm.ign.trim() || !joinForm.characterId.trim()) { setJoinError('Enter your in-game name and player ID.'); return; }
    setJoinBusy(true); setJoinError('');
    try {
      if (!supabase) throw new Error('Tournament registration is unavailable until the arena is connected.');
      const response = await supabase.rpc('join_tournament', { p_key: pendingTournament.tournamentKey, p_ign: joinForm.ign.trim(), p_character_id: joinForm.characterId.trim(), p_team: joinTeam || null });
      if (response.error) throw new Error(response.error.message);
      setWalletBalance(Number(response.data));
      setRegisteredTournaments((items) => Array.from(new Set([...items, pendingTournament.tournamentKey])));
      setPendingTournament(null); setReload((n) => n + 1);
    } catch (error) { setJoinError(error instanceof Error ? error.message : 'Unable to join this tournament.'); }
    finally { setJoinBusy(false); }
  };

  const openWallet = (tab: 'add' | 'withdraw' = 'add') => {
    if (!user) { openAuthModal(); return; }
    setSidebarOpen(false);
    setActiveTab('wallet');
    setWalletTab(tab);
    setWalletMessage('');
    setWalletOpen(true);
  };

  const navigateTo = (tab: AppTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    window.history.replaceState(null, '', `#${tab}`);
  };

  const activeAmount = customAmount ? Number(customAmount) : selectedAmount;

  const handlePaymentStart = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWalletMessage(!Number.isFinite(activeAmount) || activeAmount < 1 ? 'Enter an amount of at least ₹1.' : 'Payments are currently unavailable. No money has been charged.');
  };
  const handleWithdraw = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWalletMessage('Withdrawals are currently unavailable. Your balance has not changed.');
  };

  const preferredGames = ['BGMI', 'Free Fire MAX', 'Valorant', 'COD Mobile', 'PUBG PC', 'Apex Legends'];

  const updateProfileField = (field: keyof typeof profileForm, value: string | string[]) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
    setProfileMessage('');
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    setProfileBusy(true);
    setProfileMessage('');
    try {
      if (!supabase) throw new Error('Profile storage is unavailable until the arena is connected.');
      const payload = { avatar_url: profileForm.avatarUrl.trim() || null, bio: profileForm.bio.trim() || null, real_name: profileForm.realName.trim() || null, preferred_games: profileForm.preferredGames, game_name: profileForm.gameName.trim() || null, character_id: profileForm.characterId.trim() || null, updated_at: new Date().toISOString() };
      const response = await supabase.from('users').update(payload).eq('id', user.uid).select('id').single();
      if (response.error) throw new Error(response.error.message);
      setProfileMessage('Profile saved successfully.');
    } catch (error) { setProfileMessage(error instanceof Error ? error.message : 'Profile could not be saved.'); }
    finally { setProfileBusy(false); }
  };

  const copyProfileField = async (value: string, field: string) => {
    try { await navigator.clipboard.writeText(value); setCopyField(field); window.setTimeout(() => setCopyField(''), 1600); }
    catch { setDataError('Copy failed. Please select and copy the text manually.'); }
  };

  const createTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !teamForm.name.trim() || !teamForm.tag.trim()) { setTeamMessage('Log in and enter a team name and tag.'); return; }
    if (teamBusy) return;
    setTeamBusy(true); setTeamMessage('');
    try {
      if (!supabase) throw new Error('Team storage is unavailable until the arena is connected.');
      let logoUrl = teamForm.logoUrl.trim();
      if (teamLogoFile) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(teamLogoFile.type) || teamLogoFile.size > 2 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP logo under 2 MB.');
        const path = `${user.uid}/${crypto.randomUUID()}`;
        const upload = await supabase.storage.from('team-logos').upload(path, teamLogoFile, { contentType: teamLogoFile.type });
        if (upload.error) throw new Error(upload.error.message);
        logoUrl = supabase.storage.from('team-logos').getPublicUrl(path).data.publicUrl;
      }
      const created = await supabase.rpc('create_arena_team', { p_name: teamForm.name.trim(), p_tag: teamForm.tag.trim(), p_logo: logoUrl });
      if (created.error) throw new Error(created.error.message);
      setTeamForm({ name: '', tag: '', logoUrl: '' }); setTeamLogoFile(null); setTeamModalOpen(false); setReload((n) => n + 1);
    } catch (error) { setTeamMessage(error instanceof Error ? error.message : 'Team could not be created.'); }
    finally { setTeamBusy(false); }
  };

  const addTeammate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteModal || teamBusy) return;
    setTeamBusy(true); setTeamMessage('');
    try {
      if (!supabase) throw new Error('Team storage is unavailable.');
      const response = await supabase.rpc('invite_teammate', { p_team: inviteModal.id, p_lookup: inviteForm.lookup.trim(), p_ign: inviteForm.ign.trim(), p_character_id: inviteForm.characterId.trim() });
      if (response.error) throw new Error(response.error.message);
      setInviteModal(null); setInviteForm({ lookup: '', ign: '', characterId: '' }); setReload((n) => n + 1);
    } catch (error) { setTeamMessage(error instanceof Error ? error.message : 'Invitation could not be saved.'); }
    finally { setTeamBusy(false); }
  };

  const removeTeammate = async (team: Team, member: TeamMember) => {
    if (member.role === 'leader' || teamBusy) return;
    setTeamBusy(true); setTeamMessage('');
    try {
      if (!supabase) throw new Error('Team storage is unavailable.');
      const response = await supabase.from('team_members').delete().eq('id', member.id).eq('team_id', team.id).select('id').single();
      if (response.error) throw new Error(response.error.message);
      setTeams((items) => items.map((item) => item.id === team.id ? { ...item, members: item.members.filter((entry) => entry.id !== member.id) } : item));
    } catch (error) { setTeamMessage(error instanceof Error ? error.message : 'Teammate could not be removed.'); }
    finally { setTeamBusy(false); }
  };

  const handleDeleteAccount = React.useCallback(async () => {
    if (!user || !window.confirm('Permanently delete your account, profile, teams, wallet history and registrations?')) return;
    setDeleteBusy(true);
    try {
      if (!supabase) throw new Error('Account deletion is unavailable until the arena is connected.');
      const response = await supabase.rpc('delete_my_account');
      if (response.error) throw new Error(response.error.message);
      await supabase.auth.signOut({ scope: 'local' });
      setUser(null);
    } catch (error) { setProfileMessage(error instanceof Error ? error.message : 'Account could not be deleted.'); }
    finally { setDeleteBusy(false); setDeleteOpen(false); }
  }, [user]);
  React.useEffect(() => { if (deleteOpen) { setDeleteOpen(false); void handleDeleteAccount(); } }, [deleteOpen, handleDeleteAccount]);

  const openAdminEditor = (tournament?: Tournament) => {
    setAdminTournament(tournament || null);
    setAdminMessage('');
    if (tournament) setAdminForm({ game: tournament.game, title: tournament.title, format: tournament.format, entry: tournament.entry.replace(/[^0-9.]/g, '') || '0', prize: tournament.prize.replace(/[^0-9.]/g, ''), matchStatus: tournament.matchStatus, roomId: tournament.roomId || '', roomPassword: tournament.roomPassword || '', streamUrl: tournament.streamUrl || '' });
    else setAdminForm({ game: 'BGMI', title: '', format: 'Solo', entry: '0', prize: '10000', matchStatus: 'upcoming', roomId: '', roomPassword: '', streamUrl: '' });
  };

  const saveTournament = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin || !adminForm.title.trim()) return;
    if (adminBusy) return;
    setAdminBusy(true); setAdminMessage('');
    try {
      if (!supabase) throw new Error('Tournament storage is unavailable.');
      const entry = Number(adminForm.entry), prize = Number(adminForm.prize);
      if (![entry, prize].every((n) => Number.isFinite(n) && n >= 0)) throw new Error('Enter valid non-negative entry and prize amounts.');
      const key = adminTournament?.tournamentKey || `arena-${crypto.randomUUID()}`;
      const response = await supabase.rpc('save_tournament', { p_key: key, p_game: adminForm.game.trim(), p_title: adminForm.title.trim(), p_format: adminForm.format.trim(), p_entry: entry, p_prize: prize, p_status: adminForm.matchStatus, p_room_id: adminForm.roomId.trim(), p_room_password: adminForm.roomPassword.trim(), p_stream_url: adminForm.streamUrl.trim() });
      if (response.error) throw new Error(response.error.message);
      setAdminTournament({ ...adminTournament, tournamentKey: key } as Tournament);
      setAdminMessage('Tournament saved.'); setReload((n) => n + 1);
    } catch (error) { setAdminMessage(error instanceof Error ? error.message : 'Tournament could not be saved.'); }
    finally { setAdminBusy(false); }
  };

  const declareWinner = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin || !adminTournament || adminBusy) return;
    setAdminBusy(true); setAdminMessage('');
    try {
      if (!supabase) throw new Error('Results storage is unavailable.');
      const prize = Number(resultForm.prize);
      if (!Number.isFinite(prize) || prize < 0) throw new Error('Enter a valid prize amount.');
      const response = await supabase.rpc('declare_winner', { p_key: adminTournament.tournamentKey, p_ign: resultForm.ign.trim(), p_character_id: resultForm.characterId.trim(), p_prize: prize });
      if (response.error) throw new Error(response.error.message);
      setAdminMessage('Winner declared and prize settled.'); setReload((n) => n + 1);
      setResultForm({ ign: '', characterId: '', prize: '' });
    } catch (error) { setAdminMessage(error instanceof Error ? error.message : 'Winner could not be declared.'); }
    finally { setAdminBusy(false); }
  };

  const profileName = user?.displayName || user?.email?.split('@')[0] || 'Player';
  const profileInitials = profileName.slice(0, 2).toUpperCase();
  const canJoin = (t: Tournament) => Boolean(supabase && t.matchStatus === 'upcoming' && (!t.startsAt || new Date(t.startsAt).getTime() > Date.now()) && (t.slotsFilled || 0) < (t.slotsTotal || 100));
  const visibleTournaments = tournamentList.filter((t) => (gameFilter === 'All games' || t.game === gameFilter) && `${t.title} ${t.game}`.toLowerCase().includes(search.toLowerCase()));
  const leaderboard = Object.values(results.reduce<Record<string, { name: string; points: number }>>((all, r) => { const row = all[r.user_id] || { name: r.ign, points: 0 }; row.points += r.match_points; all[r.user_id] = row; return all; }, {})).sort((a, b) => b.points - a.points);
  const canShowRoom = (tournament: Tournament) => Boolean(tournament.roomId && registeredTournaments.includes(tournament.tournamentKey) && (!tournament.startsAt || new Date(tournament.startsAt).getTime() - Date.now() <= 15 * 60 * 1000));
  const getYoutubeId = (value?: string) => {
    if (!value) return '';
    const match = value.match(/(?:v=|youtu\.be\/|embed\/|live\/)([\w-]{6,})/);
    return match ? match[1] : value.trim().match(/^[\w-]{6,}$/)?.[0] || '';
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Trophy size={19} strokeWidth={2.5} /></div>
          <span>UMMEDO <b>ARENA</b></span>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="nav-section"><p className="nav-label">Workspace</p><nav className="primary-nav" aria-label="Main navigation">
          <button className={`nav-item nav-button ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => navigateTo('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
          <button className={`nav-item nav-button ${activeTab === 'tournaments' ? 'active' : ''}`} onClick={() => navigateTo('tournaments')}><Trophy size={18} /> Tournaments <span className="nav-count">{tournamentList.length}</span></button>
          <button className={`nav-item nav-button ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => navigateTo('teams')}><Users size={18} /> My teams</button>
          <button className={`nav-item nav-button ${activeTab === 'wallet' ? 'active' : ''}`} onClick={() => openWallet()}><Wallet size={18} /> Wallet</button>
        </nav></div>
        <div className="nav-section nav-section-lower"><p className="nav-label">Manage</p><nav className="primary-nav" aria-label="Management navigation">
          <button className={`nav-item nav-button ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => navigateTo('leaderboard')}><Grid2X2 size={18} /> Leaderboard</button>
          <button className={`nav-item nav-button ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')}><Settings size={18} /> Settings</button>
          {isAdmin && <button className="nav-item nav-button admin-nav" onClick={() => setAdminOpen(true)}><ShieldAlert size={18} /> Admin panel</button>}
        </nav></div>
        <div className="sidebar-footer"><div className="upgrade-card"><span className="upgrade-icon"><CircleDollarSign size={17} /></span><strong>Go Pro</strong><p>Unlock private leagues and more.</p><button onClick={() => setDataError('Pro plans are not available yet.')}>Explore pro <ArrowUpRight size={13} /></button></div><button className="nav-item logout nav-button" onClick={handleLogout}><LogOut size={18} /> Log out</button></div>
      </aside>

      <main className="main-content">
        {!supabase && <p className="profile-message" role="status">Preview: sample tournaments. Registration and payments are unavailable.</p>}
        {dataLoading && <p role="status">Loading arena data…</p>}
        {dataError && <p className="auth-error" role="alert">{dataError} <button onClick={() => setReload((n) => n + 1)}>Retry</button></p>}
        {!dataLoading && (activeTab === 'dashboard' || activeTab === 'tournaments') && visibleTournaments.length === 0 && <p role="status">No tournaments found.</p>}


        {activeTab === 'tournaments' && <div className="stream-strip">{tournamentList.filter((item) => item.matchStatus === 'live' && item.streamUrl).map((item) => { const videoId = getYoutubeId(item.streamUrl); return <div className="stream-panel" key={`stream-${item.tournamentKey}`}><div className="insight-heading"><span><i className="live-dot" /> Watch live · {item.title}</span><b className="live-badge">LIVE</b></div><div className="stream-frame"><iframe title={`${item.title} live stream`} src={`https://www.youtube.com/embed/${videoId}?rel=0`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /><div className="spectator-count"><Users size={13} /> {item.spectatorCount || 0} watching</div></div><a className="stream-chat-link" href={`https://www.youtube.com/live_chat?v=${videoId}`} target="_blank" rel="noreferrer">Open live chat <ArrowUpRight size={14} /></a></div>; })}</div>}
        {activeTab === 'tournaments' && <div className="tournament-insights"><div className="tracker-panel"><div className="insight-heading"><span><Activity size={15} /> Live match tracker</span><small>Updates in real time</small></div>{tournamentList.filter((item) => item.matchStatus !== 'completed').slice(0, 3).map((item) => <div className="tracker-row" key={item.tournamentKey}><div><strong>{item.title}</strong><small>{item.mapName || 'Arena map'} · {item.mode || item.format}</small></div><b className={item.matchStatus}>{item.status}</b><span>{Math.max(0, (item.slotsTotal || 100) - (item.slotsFilled || 0))} slots left</span></div>)}</div><div className="results-panel"><div className="insight-heading"><span><Crown size={15} /> Match results & kill matrix</span><small>Completed matches</small></div>{tournamentList.filter((item) => item.matchStatus === 'completed').length === 0 ? <p className="empty-insight">No completed matches yet. Results will appear here after an admin publishes them.</p> : tournamentList.filter((item) => item.matchStatus === 'completed').map((item) => <div className="result-match" key={item.tournamentKey}><strong>{item.title}</strong><span>Winner: {item.winnerName || 'Pending'} · {item.kills || 0} kills · {item.matchPoints || 0} points</span></div>)}</div></div>}
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumb"><span>Overview</span><span className="breadcrumb-slash">/</span><strong>Dashboard</strong></div><div className="topbar-actions">
          <label className="search-box"><Search size={17} /><input type="search" placeholder="Search tournaments" aria-label="Search tournaments" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label><button className="header-wallet" onClick={() => openWallet()}><Wallet size={15} /><span><small>Wallet balance</small><strong>₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span></button>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setDataError('No new notifications.')}><Bell size={19} /><i /></button><div className="profile-chip"><button className="profile-trigger" onClick={() => user ? navigateTo('settings') : openAuthModal()} aria-label={user ? 'Open account menu' : 'Log in'}><div className="avatar">{profileForm.avatarUrl || user?.photoURL ? <img src={profileForm.avatarUrl || user?.photoURL || ''} alt="" /> : profileInitials}</div><div className="profile-copy"><strong>{user ? profileName : 'Guest player'}</strong><span>{user ? 'Arena member' : 'Log in to compete'}</span></div><ChevronDown size={16} /></button>{user && <button className="profile-logout" onClick={handleLogout} aria-label="Log out"><LogOut size={15} /></button>}</div>
        </div></header>

        {activeTab !== 'dashboard' && activeTab !== 'teams' && activeTab !== 'settings' && <div className="page-content subpage-view"><div className="subpage-header"><div><p className="eyebrow">Ummedo Arena</p><h1>{activeTab === 'tournaments' ? 'Tournaments' : activeTab === 'wallet' ? 'Wallet activity' : activeTab === 'leaderboard' ? 'Leaderboard' : 'Settings'}</h1><p className="subheading">{activeTab === 'tournaments' ? 'Find your next match and secure your spot.' : activeTab === 'wallet' ? 'Your deposits, entries, and winnings in one place.' : activeTab === 'leaderboard' ? 'See who is making noise in the arena.' : 'Tune your arena experience.'}</p></div>{activeTab === 'wallet' && <button className="primary-button" onClick={() => openWallet('add')}><Wallet size={16} /> Manage wallet</button>}</div>{activeTab === 'tournaments' && <div className="tournament-grid">{visibleTournaments.map((tournament) => <article className="tournament-card" key={tournament.tournamentKey}><div className={`game-icon ${tournament.accent}`}>{tournament.icon}</div><div className="card-topline"><span>{tournament.game}</span><b className={`open-status ${tournament.matchStatus}`}><i /> {tournament.status}</b></div><h3>{tournament.title}</h3><p className="format">{tournament.format}</p><div className="card-data"><div><span>Prize pool</span><strong>{tournament.prize}</strong></div><div><span>Entry fee</span><strong>{tournament.entry}</strong></div></div><div className="card-footer"><span className="player-count"><Users size={14} /> {tournament.players}</span><span className="start-time">{tournament.status}</span></div>{canShowRoom(tournament) && <div className="room-credentials"><div><span>Room ID</span><strong>{tournament.roomId}</strong></div><div><span>Password</span><strong>{tournament.roomPassword || '—'}</strong></div><button onClick={() => { void copyProfileField(`${tournament.roomId} / ${tournament.roomPassword || ''}`, 'room'); }} aria-label="Copy room credentials"><Copy size={14} /></button></div>}<button className="join-button" onClick={() => handleJoin(tournament)} disabled={registeredTournaments.includes(tournament.tournamentKey) || !canJoin(tournament)}>{registeredTournaments.includes(tournament.tournamentKey) ? 'Joined' : !canJoin(tournament) ? 'Registration closed' : 'Join tournament'} <ArrowUpRight size={15} /></button></article>)}</div>}{activeTab === 'wallet' && <div className="detail-grid"><div className="detail-panel balance-panel"><Wallet size={22} /><span>Available balance</span><strong>₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><button className="primary-button" onClick={() => openWallet('add')}>Add cash <Plus size={15} /></button></div><div className="detail-panel"><div className="panel-title"><History size={16} /> Recent transactions</div>{transactions.map((transaction) => <div className="compact-transaction" key={transaction.id || `${transaction.title}-${transaction.date}`}><span>{transaction.title}<small>{transaction.date}</small></span><b className={transaction.amount > 0 ? 'positive' : ''}>{transaction.amount > 0 ? '+' : '−'}₹{Math.abs(transaction.amount).toLocaleString('en-IN')}</b></div>)}</div></div>}{activeTab === 'leaderboard' && <div className="detail-panel leaderboard-panel"><div className="panel-title"><Crown size={16} /> Season rankings</div>{leaderboard.length === 0 && <p>No results published yet.</p>}{leaderboard.map((row, index) => <div className="rank-row" key={index}><strong>{index + 1}</strong><span>{row.name}</span><b>{row.points} pts</b></div>)}</div>}</div>}
        <div className="page-content" id="dashboard" style={{ display: activeTab === 'dashboard' ? undefined : 'none' }}><section className="welcome-row"><div><p className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>Welcome, {profileName}<span className="neon-dot">.</span></h1><p className="subheading">The arena is live. Find your next challenge.</p></div><button className="wallet-card" id="wallet" onClick={() => openWallet()}><div className="wallet-heading"><span><Wallet size={16} /> UPI wallet</span><span className="wallet-status"><i /> {supabase && user ? 'Connected' : 'Not connected'}</span></div><strong>₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className="wallet-action">Manage wallet <ArrowUpRight size={14} /></span></button></section>
          <section className="hero-banner" aria-label="Featured tournament"><div className="hero-grid" /><div className="hero-glow" /><div className="hero-copy"><div className="live-pill"><span /> Live registrations</div><p className="hero-kicker">Featured tournament · BGMI</p><h2>Own the <em>drop.</em><br />Rule the arena.</h2><p className="hero-description">The biggest squad battle of the season is here. Assemble your team and take the crown.</p><button className="primary-button" onClick={() => navigateTo('tournaments')}>View tournament <ArrowUpRight size={17} /></button></div><div className="hero-stats"><div><span>Prize pool</span><strong>{tournamentList[0]?.prize || '—'}</strong></div><div><span>Players registered</span><strong>{tournamentList[0]?.players || '—'}</strong></div><div><span>Status</span><strong>{tournamentList[0]?.status || 'No scheduled match'}</strong></div></div><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /></section>
          <section className="tournaments-section" id="tournaments"><div className="section-heading"><div><p className="eyebrow">Compete & win</p><h2>Active tournaments <span>({tournamentList.length})</span></h2></div><div className="section-controls"><select className="filter-button" aria-label="Filter by game" value={gameFilter} onChange={(e) => setGameFilter(e.target.value)}>{['All games', ...Array.from(new Set(tournamentList.map((t) => t.game)))].map((game) => <option key={game}>{game}</option>)}</select><button className="filter-button" onClick={() => navigateTo('tournaments')}>View all <ArrowUpRight size={15} /></button></div></div><div className="tournament-grid">{visibleTournaments.map((tournament) => <article className="tournament-card" key={tournament.tournamentKey}><div className={`game-icon ${tournament.accent}`}>{tournament.icon}</div><div className="card-topline"><span>{tournament.game}</span><b className={`open-status ${tournament.matchStatus}`}><i /> {tournament.status}</b></div><h3>{tournament.title}</h3><p className="format">{tournament.format}</p><div className="card-data"><div><span>Prize pool</span><strong>{tournament.prize}</strong></div><div><span>Entry fee</span><strong>{tournament.entry}</strong></div></div><div className="card-footer"><span className="player-count"><Users size={14} /> {tournament.players}</span><span className="start-time">{tournament.status}</span></div>{canShowRoom(tournament) && <div className="room-credentials"><div><span>Room ID</span><strong>{tournament.roomId}</strong></div><div><span>Password</span><strong>{tournament.roomPassword || '—'}</strong></div><button onClick={() => { void copyProfileField(`${tournament.roomId} / ${tournament.roomPassword || ''}`, 'room'); }} aria-label="Copy room credentials"><Copy size={14} /></button></div>}<button className="join-button" onClick={() => handleJoin(tournament)} disabled={registeredTournaments.includes(tournament.tournamentKey) || !canJoin(tournament)}>{registeredTournaments.includes(tournament.tournamentKey) ? 'Joined' : tournament.matchStatus === 'completed' ? 'Results declared' : !canJoin(tournament) ? 'Registration closed' : 'Join tournament'} {registeredTournaments.includes(tournament.tournamentKey) ? <Check size={15} /> : <ArrowUpRight size={15} />}</button></article>)}</div></section>
        </div>
        {activeTab === 'settings' && <div className="profile-page"><div className="profile-page-header"><div><p className="eyebrow">Account center</p><h2>Profile & account</h2><p>Make your arena identity yours. Changes sync across your devices.</p></div>{!user && <button className="primary-button" onClick={() => openAuthModal('login')}>Log in <ArrowUpRight size={15} /></button>}</div><form className="profile-layout" onSubmit={saveProfile}><div className="profile-main"><section className="profile-section profile-identity"><div className="profile-avatar-wrap"><div className="profile-large-avatar">{profileForm.avatarUrl ? <img src={profileForm.avatarUrl} alt="Profile" /> : <UserRound size={34} />}</div><div><h3>Profile picture</h3><p>Use a public image URL for your arena avatar.</p><div className="profile-url-field"><Image size={15} /><input value={profileForm.avatarUrl} onChange={(event) => updateProfileField('avatarUrl', event.target.value)} placeholder="https://..." /></div></div></div><label>Real name<input value={profileForm.realName} onChange={(event) => updateProfileField('realName', event.target.value)} placeholder="Your real name" /></label><label>Bio<textarea value={profileForm.bio} maxLength={160} onChange={(event) => updateProfileField('bio', event.target.value)} placeholder="Tell the arena who you are..." /><small>{profileForm.bio.length}/160</small></label></section><section className="profile-section"><div className="section-title"><Gamepad2 size={17} /><div><h3>Preferred games</h3><p>Pick the games you want to see first.</p></div></div><div className="game-preferences">{preferredGames.map((game) => <button type="button" className={profileForm.preferredGames.includes(game) ? 'game-preference selected' : 'game-preference'} key={game} onClick={() => updateProfileField('preferredGames', profileForm.preferredGames.includes(game) ? profileForm.preferredGames.filter((item) => item !== game) : [...profileForm.preferredGames, game])}>{profileForm.preferredGames.includes(game) && <Check size={14} />}{game}</button>)}</div></section></div><aside className="profile-side"><section className="profile-section gaming-identity"><div className="section-title"><Trophy size={17} /><div><h3>Gaming identity</h3><p>Used for tournament check-ins.</p></div></div><label>Game name (IGN)<div className="copyable-field"><input value={profileForm.gameName} onChange={(event) => updateProfileField('gameName', event.target.value)} placeholder="Your in-game name" /><button type="button" onClick={() => copyProfileField(profileForm.gameName, 'ign')} disabled={!profileForm.gameName}>{copyField === 'ign' ? <Check size={15} /> : <Copy size={15} />}</button></div></label><label>In-game character ID<div className="copyable-field"><input value={profileForm.characterId} onChange={(event) => updateProfileField('characterId', event.target.value.replace(/[^0-9]/g, ''))} placeholder="Your player ID" /><button type="button" onClick={() => copyProfileField(profileForm.characterId, 'characterId')} disabled={!profileForm.characterId}>{copyField === 'characterId' ? <Check size={15} /> : <Copy size={15} />}</button></div></label><button className="quick-save" type="submit" disabled={profileBusy}>{profileBusy ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{profileBusy ? 'Saving...' : 'Save profile'}</button>{profileMessage && <p className="profile-message">{profileMessage}</p>}</section><section className="profile-section account-section"><div className="section-title"><UserRound size={17} /><div><h3>Account management</h3><p>{user?.email || 'You are browsing as a guest.'}</p></div></div>{user ? <button type="button" className="account-action" onClick={handleLogout}><LogOut size={15} /> Log out</button> : <button type="button" className="account-action" onClick={() => openAuthModal('login')}><ArrowUpRight size={15} /> Log in</button>}<div className="danger-zone"><div><strong>Danger zone</strong><p>Delete your profile and wallet data permanently.</p></div><button type="button" onClick={() => setDeleteOpen(true)} disabled={!user || deleteBusy}><Trash2 size={15} /> Delete account</button></div></section></aside></form></div>}
        {activeTab === 'teams' && <div className="teams-page"><div className="teams-toolbar"><div><p className="eyebrow">Squad management</p><h2>Your teams</h2><p className="subheading">Build a roster, then register your full squad for tournaments.</p></div><button className="primary-button" onClick={() => { if (!user) { openAuthModal(); return; } setTeamMessage(''); setTeamModalOpen(true); }}><Plus size={16} /> Create a team</button></div>{teamMessage && <p className="profile-message">{teamMessage}</p>}{teams.length === 0 ? <div className="empty-panel"><Users size={28} /><h2>Your squad is waiting</h2><p>Create a team and invite players to enter squad tournaments together.</p><button className="primary-button" onClick={() => user ? setTeamModalOpen(true) : openAuthModal()}>Create a team <Plus size={15} /></button></div> : <div className="teams-grid">{teams.map((team) => <article className="team-card" key={team.id}><div className="team-card-heading"><div className="team-logo">{team.logoUrl ? <img src={team.logoUrl} alt="" /> : <Users size={22} />}</div><div><h3>{team.name}</h3><span>[{team.tag}] · {team.members.length} players</span></div><button className="icon-button" aria-label="Team options" onClick={() => setTeamMessage('Use Add teammate or the roster controls to manage this team.')}><MoreHorizontal size={18} /></button></div><div className="roster-heading"><span>Squad roster</span><button onClick={() => { setInviteModal(team); setTeamMessage(''); }}><UserPlus size={14} /> Add teammate</button></div><div className="roster-list">{team.members.map((member) => <div className="roster-member" key={member.id}><span className={`roster-avatar ${member.role}`}>{member.ign.slice(0, 2).toUpperCase() || '??'}</span><div><strong>{member.ign || member.email || 'Invited player'}</strong><small>{member.role === 'leader' ? 'Leader' : 'Member'} · ID {member.characterId || 'Pending'}{member.status === 'invited' ? ' · Invite pending' : ''}</small></div>{member.role !== 'leader' && <button className="icon-button remove-member" onClick={() => removeTeammate(team, member)} aria-label="Remove teammate"><X size={15} /></button>}</div>)}</div><button className="team-register" onClick={() => { setJoinTeam(team.id); navigateTo('tournaments'); }}>Register squad for tournament <ArrowUpRight size={15} /></button></article>)}</div>}</div>}
      {teamModalOpen && <div className="team-backdrop"><section className="team-modal"><button className="wallet-close icon-button" onClick={() => !teamBusy && setTeamModalOpen(false)} disabled={teamBusy} aria-label="Close"><X size={19} /></button><p className="eyebrow">Squad builder</p><h2>Create a team</h2><p>Set up your squad identity.</p><form className="team-form" onSubmit={createTeam}>{teamMessage && <p role="alert" className="auth-error">{teamMessage}</p>}<label>Team name<input required value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} /></label><label>Team tag<input required maxLength={5} value={teamForm.tag} onChange={(event) => setTeamForm({ ...teamForm, tag: event.target.value })} /></label><label>Logo / avatar URL<input value={teamForm.logoUrl} onChange={(event) => setTeamForm({ ...teamForm, logoUrl: event.target.value })} /></label><button className="team-primary" type="submit" disabled={teamBusy}><Plus size={16} /> Create team</button></form></section></div>}
      {inviteModal && <div className="team-backdrop"><section className="team-modal"><button className="wallet-close icon-button" onClick={() => !teamBusy && setInviteModal(null)} disabled={teamBusy} aria-label="Close"><X size={19} /></button><p className="eyebrow">{inviteModal.name} · [{inviteModal.tag}]</p><h2>Add teammate</h2><p>Invite by email, username, or Game ID.</p><form className="team-form" onSubmit={addTeammate}>{teamMessage && <p role="alert" className="auth-error">{teamMessage}</p>}<label>Email, username, or Game ID<input required value={inviteForm.lookup} onChange={(event) => setInviteForm({ ...inviteForm, lookup: event.target.value })} /></label><label>IGN<input value={inviteForm.ign} onChange={(event) => setInviteForm({ ...inviteForm, ign: event.target.value })} /></label><label>Character ID<input value={inviteForm.characterId} onChange={(event) => setInviteForm({ ...inviteForm, characterId: event.target.value })} /></label><button className="team-primary" type="submit" disabled={teamBusy}><UserPlus size={16} /> Send invite</button></form></section></div>}
      {teamModalOpen && <label className="team-file-float">Upload a logo from your device<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0] || null; setTeamLogoFile(file);  }} /></label>}
      </main>
      {adminOpen && isAdmin && <div className="admin-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAdminOpen(false)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title"><button className="wallet-close icon-button" onClick={() => setAdminOpen(false)} aria-label="Close admin panel"><X size={19} /></button><div className="admin-heading"><p className="eyebrow">Restricted workspace</p><h2 id="admin-title">Arena control room</h2><p>Create tournaments, publish rooms, and settle winners.</p></div><div className="admin-tabs"><button className={!adminTournament ? 'selected' : ''} onClick={() => openAdminEditor()}>New tournament <Plus size={14} /></button>{tournamentList.map((item) => <button className={adminTournament?.tournamentKey === item.tournamentKey ? 'selected' : ''} key={item.tournamentKey} onClick={() => openAdminEditor(item)}>{item.title}</button>)}</div><form className="admin-form" onSubmit={saveTournament}><label>Game<input value={adminForm.game} onChange={(event) => setAdminForm({ ...adminForm, game: event.target.value })} /></label><label>Tournament title<input required value={adminForm.title} onChange={(event) => setAdminForm({ ...adminForm, title: event.target.value })} placeholder="Weekend Arena Cup" /></label><div className="admin-fields"><label>Format<input value={adminForm.format} onChange={(event) => setAdminForm({ ...adminForm, format: event.target.value })} /></label><label>Entry fee<input type="number" min="0" value={adminForm.entry} onChange={(event) => setAdminForm({ ...adminForm, entry: event.target.value })} /></label><label>Prize pool<input type="number" min="0" value={adminForm.prize} onChange={(event) => setAdminForm({ ...adminForm, prize: event.target.value })} /></label><label>Status<select value={adminForm.matchStatus} onChange={(event) => setAdminForm({ ...adminForm, matchStatus: event.target.value })}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option></select></label></div><div className="admin-fields"><label>Room ID<input value={adminForm.roomId} onChange={(event) => setAdminForm({ ...adminForm, roomId: event.target.value })} placeholder="Publish when ready" /></label><label>Room password<input value={adminForm.roomPassword} onChange={(event) => setAdminForm({ ...adminForm, roomPassword: event.target.value })} placeholder="Publish when ready" /></label></div><label>Live stream URL or video ID<input value={adminForm.streamUrl} onChange={(event) => setAdminForm({ ...adminForm, streamUrl: event.target.value })} placeholder="youtube.com/watch?v=..." /></label><button className="admin-save" type="submit" disabled={adminBusy}><Save size={15} /> Save tournament</button></form>{adminTournament && <form className="results-form" onSubmit={declareWinner}><div className="results-heading"><span><Crown size={15} /> Match results</span><small>Declare rank #1 and pay the prize</small></div><div className="admin-fields"><label>Winner IGN<input required value={resultForm.ign} onChange={(event) => setResultForm({ ...resultForm, ign: event.target.value })} /></label><label>Character ID<input required value={resultForm.characterId} onChange={(event) => setResultForm({ ...resultForm, characterId: event.target.value })} /></label><label>Prize payout<input type="number" min="0" value={resultForm.prize} onChange={(event) => setResultForm({ ...resultForm, prize: event.target.value })} /></label></div><button className="declare-button" type="submit" disabled={adminBusy}><Crown size={15} /> Declare winner & pay</button></form>}{adminMessage && <p className="admin-message">{adminMessage}</p>}</section></div>}
      {pendingTournament && <div className="join-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeJoinModal()}><section className="join-modal" role="dialog" aria-modal="true" aria-labelledby="join-title"><button className="wallet-close icon-button" onClick={closeJoinModal} aria-label="Close tournament confirmation"><X size={19} /></button><div className={`join-game-icon ${pendingTournament.accent}`}>{pendingTournament.icon}</div><p className="eyebrow">Confirm your slot</p><h2 id="join-title">{pendingTournament.title}</h2><p className="join-copy">Enter your {pendingTournament.game} details exactly as they appear in-game. Your entry fee will be deducted from your wallet.</p><div className="join-summary"><span>Entry fee <strong>{pendingTournament.entry}</strong></span><span>Remaining after entry <strong>₹{Math.max(0, walletBalance - (pendingTournament.entry === 'Free' ? 0 : Number(pendingTournament.entry.replace(/[^0-9.]/g, '')))).toLocaleString('en-IN')}</strong></span></div><form className="join-form" onSubmit={handleJoinConfirm}>{teams.some((team) => team.members.some((member) => member.userId === user?.uid && member.role === 'leader')) && <label>Register with a team (optional)<select value={joinTeam} onChange={(event) => setJoinTeam(event.target.value)}><option value="">Individual entry</option>{teams.filter((team) => team.members.some((member) => member.userId === user?.uid && member.role === 'leader')).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}<label>{pendingTournament.game} In-Game Name (IGN)<div className="join-input"><Users size={16} /><input required maxLength={24} value={joinForm.ign} onChange={(event) => setJoinForm({ ...joinForm, ign: event.target.value })} placeholder="e.g. UmmedoHunter" /></div></label><label>Character ID<div className="join-input"><HashIcon /><input required maxLength={64} value={joinForm.characterId} onChange={(event) => setJoinForm({ ...joinForm, characterId: event.target.value })} placeholder="Enter your player ID" /></div></label>{joinError && <p className="join-error">{joinError}</p>}<button className="join-confirm" type="submit" disabled={joinBusy}>{joinBusy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{joinBusy ? 'Confirming slot...' : 'Confirm and join'}</button></form></section></div>}
      {walletOpen && <div className="wallet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setWalletOpen(false)}><section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title"><button className="wallet-close icon-button" onClick={() => setWalletOpen(false)} aria-label="Close wallet"><X size={19} /></button><><div className="wallet-modal-heading"><p className="eyebrow">Your funds</p><h2 id="wallet-title">UPI wallet</h2><p>Manage your balance and keep your tournament entries ready.</p></div><div className="wallet-balance"><span>Available balance</span><strong>₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className="balance-secure"><Check size={13} /> Account balance</span></div><div className="wallet-tabs"><button className={walletTab === 'add' ? 'selected' : ''} onClick={() => { setWalletTab('add'); setWalletMessage(''); }}>Add cash</button><button className={walletTab === 'withdraw' ? 'selected' : ''} onClick={() => { setWalletTab('withdraw'); setWalletMessage(''); }}>Withdraw</button></div>{walletTab === 'add' ? <form className="cash-form" onSubmit={handlePaymentStart}><label>Choose amount</label><div className="amount-presets">{[50, 100, 200, 500].map((amount) => <button type="button" className={!customAmount && selectedAmount === amount ? 'amount-selected' : ''} key={amount} onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}>{`₹${amount}`}</button>)}</div><label className="custom-amount-label">Custom amount<div className="amount-input"><span>₹</span><input type="number" min="1" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="Enter amount" /></div></label>{walletMessage && <p className="wallet-message success-message">{walletMessage}</p>}<button className="wallet-primary" type="submit">Continue to payment <ArrowUpRight size={16} /></button></form> : <form className="cash-form" onSubmit={handleWithdraw}><label>Amount to withdraw</label><label className="custom-amount-label"><div className="amount-input"><span>₹</span><input type="number" min="1" max={walletBalance} value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="Enter amount" /></div></label>{walletMessage && <p className="wallet-message">{walletMessage}</p>}<button className="wallet-primary" type="submit">Withdraw to UPI <ArrowUpRight size={16} /></button></form>}<div className="transaction-heading"><span><History size={15} /> Recent activity</span><small>Last 30 days</small></div><div className="transactions">{transactions.map((transaction) => <div className="transaction" key={transaction.id || `${transaction.title}-${transaction.date}`}><span className={`transaction-icon ${transaction.kind}`}>{transaction.kind === 'deposit' ? <ArrowUpRight size={15} /> : transaction.kind === 'win' ? <Trophy size={15} /> : <CreditCard size={15} />}</span><div><strong>{transaction.title}</strong><small>{transaction.date}</small></div><b className={transaction.amount > 0 ? 'positive' : ''}>{transaction.amount > 0 ? '+' : '−'}₹{Math.abs(transaction.amount).toLocaleString('en-IN')}</b></div>)}</div></></section></div>}
      {authModalOpen && <AuthDialog initialMode={authMode} onClose={() => setAuthModalOpen(false)} />}
    </div>
  );
}

export default App;
