import React from 'react';
import {
  ArrowUpRight, Bell, ChevronDown, CircleDollarSign, Gamepad2, Grid2X2,
  LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, Swords,
  Trophy, Users, Wallet, X, Globe2, LoaderCircle, Mail, LockKeyhole, Copy,
  Check, CreditCard, ArrowLeft, History, Hash, Plus, ShieldAlert, Save, Crown,
  Image, UserRound, Trash2, UserPlus, MoreHorizontal, Activity,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { isSupabaseConfigured, supabase } from './supabase';
import { AuthError, AuthResponse } from '@supabase/supabase-js';
import { useGoogleLogin } from '@react-oauth/google';
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
  const adminEmails = (process.env.REACT_APP_ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<AppTab>('dashboard');
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<'login' | 'signup'>('login');
  const [user, setUser] = React.useState<ArenaUser | null>(null);
  const [authError, setAuthError] = React.useState('');
  const [authBusy, setAuthBusy] = React.useState(false);
  const [authForm, setAuthForm] = React.useState({ email: '', password: '' });
  const [walletOpen, setWalletOpen] = React.useState(false);
  const [walletTab, setWalletTab] = React.useState<'add' | 'withdraw'>('add');
  const [walletView, setWalletView] = React.useState<'wallet' | 'payment'>('wallet');
  const [walletBalance, setWalletBalance] = React.useState(2840);
  const [customAmount, setCustomAmount] = React.useState('');
  const [selectedAmount, setSelectedAmount] = React.useState(100);
  const [upiCopied, setUpiCopied] = React.useState(false);
  const [walletMessage, setWalletMessage] = React.useState('');
  const [transactions, setTransactions] = React.useState<Transaction[]>([
    { title: 'Prize winnings · Night Raid', date: 'Today, 10:42 AM', amount: 850, kind: 'win' },
    { title: 'Match entry · Neon Clash', date: 'Yesterday, 8:16 PM', amount: -199, kind: 'entry' },
    { title: 'Added via UPI', date: '12 Sep 2026, 4:20 PM', amount: 1000, kind: 'deposit' },
  ]);
  const [registeredTournaments, setRegisteredTournaments] = React.useState<string[]>([]);
  const [pendingTournament, setPendingTournament] = React.useState<Tournament | null>(null);
    const [joinForm, setJoinForm] = React.useState({ ign: '', characterId: '' });
  const [joinError, setJoinError] = React.useState('');
  const [joinBusy, setJoinBusy] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState({ avatarUrl: '', bio: '', realName: '', preferredGames: [] as string[], gameName: '', characterId: '' });
  const [profileMessage, setProfileMessage] = React.useState('');
  const [profileBusy, setProfileBusy] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [, setDeleteBusy] = React.useState(false);
  const [copyField, setCopyField] = React.useState('');
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [teamModalOpen, setTeamModalOpen] = React.useState(false);
  const [inviteModal, setInviteModal] = React.useState<Team | null>(null);
  const [teamForm, setTeamForm] = React.useState({ name: '', tag: '', logoUrl: '' });
  const [teamLogoFile, setTeamLogoFile] = React.useState<File | null>(null);
  const [inviteForm, setInviteForm] = React.useState({ lookup: '', ign: '', characterId: '' });
  const [teamMessage, setTeamMessage] = React.useState('');
  const [teamBusy, setTeamBusy] = React.useState(false);
  const [tournamentList, setTournamentList] = React.useState<Tournament[]>(tournaments);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [adminTournament, setAdminTournament] = React.useState<Tournament | null>(null);
  const [adminForm, setAdminForm] = React.useState({ game: 'BGMI', title: '', format: 'Solo', entry: '0', prize: '10000', matchStatus: 'upcoming', roomId: '', roomPassword: '', streamUrl: '' });
  const [adminMessage, setAdminMessage] = React.useState('');
  const [resultForm, setResultForm] = React.useState({ ign: '', characterId: '', prize: '' });
  const isAdmin = Boolean(user?.email && adminEmails.includes(user.email.toLowerCase()));
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } });
        if (!response.ok) throw new Error('Google profile lookup failed.');
        const profile = await response.json() as { sub: string; email?: string; name?: string; picture?: string };
        let uid = `google-${profile.sub}`;
        let email = profile.email || null;
        let displayName = profile.name || profile.email?.split('@')[0] || 'Google player';
        let photoURL = profile.picture || null;
        if (supabase) {
          const identity = await supabase.auth.signInWithIdToken({ provider: 'google', token: tokenResponse.access_token });
          if (!identity.error && identity.data.user) {
            uid = identity.data.user.id;
            email = identity.data.user.email || email;
            displayName = identity.data.user.user_metadata?.full_name || identity.data.user.user_metadata?.name || displayName;
            photoURL = identity.data.user.user_metadata?.avatar_url || identity.data.user.user_metadata?.picture || photoURL;
          }
        }
        const nextUser: ArenaUser = { uid, email, displayName, photoURL };
        setUser(nextUser);
        window.localStorage.setItem('ummedo-arena-user', JSON.stringify(nextUser));
        if (supabase && !nextUser.uid.startsWith('google-')) await supabase.from('users').upsert({ id: nextUser.uid, email: nextUser.email || '', display_name: nextUser.displayName, avatar_url: nextUser.photoURL }, { onConflict: 'id' });
        setAuthModalOpen(false);
        setAuthError('');
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Google sign-in could not be completed.');
      } finally {
        setAuthBusy(false);
      }
    },
    onError: () => { setAuthBusy(false); setAuthError('Google sign-in was cancelled or could not be completed.'); },
  });

  React.useEffect(() => {
    if (auth) return onAuthStateChanged(auth, (firebaseUser) => setUser(firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName, photoURL: firebaseUser.photoURL } : null));
    if (supabase) {
      void supabase.auth.getSession().then(({ data }) => {
        const supabaseUser = data.session?.user;
        if (supabaseUser) setUser({ uid: supabaseUser.id, email: supabaseUser.email || null, displayName: supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0] || null, photoURL: supabaseUser.user_metadata?.avatar_url || null });
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        const supabaseUser = session?.user;
        setUser(supabaseUser ? { uid: supabaseUser.id, email: supabaseUser.email || null, displayName: supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0] || null, photoURL: supabaseUser.user_metadata?.avatar_url || null } : null);
      });
      return () => listener.subscription.unsubscribe();
    }
    const stored = window.localStorage.getItem('ummedo-arena-user');
    if (stored) {
      try { setUser(JSON.parse(stored) as ArenaUser); } catch { window.localStorage.removeItem('ummedo-arena-user'); }
    }
    return undefined;
  }, []);

  React.useEffect(() => {
    const client = supabase;
    if (!client || !user) return undefined;
    let active = true;

    const loadArenaData = async () => {
      const profile = await client.from('users').upsert({
        id: user.uid,
        email: user.email || '',
        display_name: user.displayName,
        avatar_url: user.photoURL,
      }, { onConflict: 'id' }).select('wallet_balance, avatar_url, bio, real_name, preferred_games, game_name, character_id').single();
      const walletTransactions = await client.from('wallet_transactions').select('title, amount, transaction_type, created_at').eq('user_id', user.uid).order('created_at', { ascending: false }).limit(30);
      const registrations = await client.from('tournament_registrations').select('tournament_key').eq('user_id', user.uid);
      const remoteTournaments = await client.from('tournaments').select('*').order('created_at', { ascending: false });
      const remoteTeams = await client.from('teams').select('id, team_name, team_tag, logo_url, team_members(id, user_id, invite_email, role, ign, character_id, status)').or(`owner_id.eq.${user.uid},team_members.user_id.eq.${user.uid}`);

      if (!active) return;
      if (profile.data) setWalletBalance(Number(profile.data.wallet_balance));
      if (profile.data) setProfileForm({ avatarUrl: profile.data.avatar_url || user.photoURL || '', bio: profile.data.bio || '', realName: profile.data.real_name || '', preferredGames: profile.data.preferred_games || [], gameName: profile.data.game_name || '', characterId: profile.data.character_id || '' });
      if (walletTransactions.data) {
        setTransactions(walletTransactions.data.map((transaction) => ({
          title: transaction.title,
          date: new Date(transaction.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          amount: Number(transaction.amount),
          kind: transaction.transaction_type === 'withdrawal' ? 'withdrawal' : transaction.transaction_type,
        })));
      }
      if (registrations.data) setRegisteredTournaments(registrations.data.map((registration) => registration.tournament_key));
      if (remoteTournaments.data?.length) setTournamentList(remoteTournaments.data.map((item) => ({
        game: item.game, title: item.title, format: item.format, prize: `₹${Number(item.prize_pool).toLocaleString('en-IN')}`, entry: Number(item.entry_fee) ? `₹${Number(item.entry_fee).toLocaleString('en-IN')}` : 'Free', players: `${item.slots_filled || 0} / ${item.slots_total || item.max_players}`, accent: item.accent || 'lime', icon: item.game === 'BGMI' ? <Swords size={22} strokeWidth={1.8} /> : <Gamepad2 size={22} strokeWidth={1.8} />, status: item.match_status === 'live' ? 'Live now' : item.match_status === 'completed' ? 'Completed' : 'Upcoming', tournamentKey: item.tournament_key, matchStatus: item.match_status, roomId: item.room_id, roomPassword: item.room_password, startsAt: item.starts_at, mapName: item.map_name, mode: item.mode, slotsTotal: item.slots_total || item.max_players, slotsFilled: item.slots_filled || 0, streamUrl: item.stream_url, spectatorCount: item.spectator_count || 0,
      })));
      if (remoteTeams.data) setTeams(remoteTeams.data.map((team) => ({ id: team.id, name: team.team_name, tag: team.team_tag, logoUrl: team.logo_url || '', members: (team.team_members || []).map((member: { id: string; user_id?: string; invite_email?: string; role: 'leader' | 'member'; ign?: string; character_id?: string; status: string }) => ({ id: member.id, userId: member.user_id, email: member.invite_email, role: member.role, ign: member.ign || '', characterId: member.character_id || '', status: member.status })) })));
    };

    loadArenaData();
    const channel = client.channel(`arena-data-${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.uid}` }, (payload) => {
        const nextBalance = (payload.new as { wallet_balance?: number }).wallet_balance;
        if (nextBalance !== undefined) setWalletBalance(Number(nextBalance));
        const profile = payload.new as { avatar_url?: string; bio?: string; real_name?: string; preferred_games?: string[]; game_name?: string; character_id?: string };
        if (profile.bio !== undefined) setProfileForm({ avatarUrl: profile.avatar_url || '', bio: profile.bio || '', realName: profile.real_name || '', preferredGames: profile.preferred_games || [], gameName: profile.game_name || '', characterId: profile.character_id || '' });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.uid}` }, loadArenaData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_registrations', filter: `user_id=eq.${user.uid}` }, loadArenaData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, loadArenaData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, loadArenaData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, loadArenaData)
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [user]);

  const openAuthModal = (mode: 'login' | 'signup' = 'login') => {
    setAuthMode(mode);
    setAuthError('');
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    if (!authBusy) setAuthModalOpen(false);
  };

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      let nextUser: ArenaUser | null = null;
      if (auth) {
        if (authMode === 'login') await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
        else await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        const firebaseUser = auth.currentUser;
        if (firebaseUser) nextUser = { uid: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName, photoURL: firebaseUser.photoURL };
      } else if (supabase) {
        const response: AuthResponse = authMode === 'login'
          ? await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password })
          : await supabase.auth.signUp({ email: authForm.email, password: authForm.password });
        if (response.error) throw response.error;
        if (response.data.user) nextUser = { uid: response.data.user.id, email: response.data.user.email || authForm.email, displayName: response.data.user.user_metadata?.display_name || authForm.email.split('@')[0], photoURL: response.data.user.user_metadata?.avatar_url || null };
      } else {
        nextUser = { uid: `local-${btoa(authForm.email).replace(/[^a-zA-Z0-9]/g, '')}`, email: authForm.email, displayName: authForm.email.split('@')[0], photoURL: null };
      }
      if (!nextUser) throw new Error('The account provider did not return a user session.');
      setUser(nextUser);
      window.localStorage.setItem('ummedo-arena-user', JSON.stringify(nextUser));
      if (supabase && !nextUser.uid.startsWith('local-')) await supabase.from('users').upsert({ id: nextUser.uid, email: nextUser.email || '', display_name: nextUser.displayName, avatar_url: nextUser.photoURL }, { onConflict: 'id' });
      setAuthModalOpen(false);
      setAuthForm({ email: '', password: '' });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const message = error instanceof AuthError ? error.message : '';
      setAuthError(code === 'auth/invalid-credential' || message.includes('Invalid login credentials') ? 'Email or password is incorrect.' : code === 'auth/email-already-in-use' ? 'An account already exists with this email.' : message || 'Authentication failed. Check your details and try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthError('');
    try {
      if (supabase) {
        const response = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
        if (response.error) throw response.error;
      } else {
        googleLogin();
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in was cancelled or could not be completed.');
      setAuthBusy(false);
    } finally {
      // The OAuth callback owns the loading state until the profile is saved.
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    if (supabase) await supabase.auth.signOut();
    window.localStorage.removeItem('ummedo-arena-user');
    setUser(null);
  };

  const handleJoin = async (tournament?: Tournament) => {
    setActiveTab('tournaments');
    if (!user) openAuthModal('login');
    if (!user || !tournament || registeredTournaments.includes(tournament.tournamentKey)) return;
    setJoinForm({ ign: '', characterId: '' });
    setJoinError('');
    setPendingTournament(tournament);
  };

  const closeJoinModal = () => {
    if (!joinBusy) setPendingTournament(null);
  };

  const handleJoinConfirm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingTournament || !user) return;
    const entryAmount = pendingTournament.entry === 'Free' ? 0 : Number(pendingTournament.entry.replace(/[^0-9.]/g, ''));
    if (entryAmount > walletBalance) {
      setJoinError('Your wallet balance is too low for this entry. Add cash to continue.');
      return;
    }
    setJoinBusy(true);
    setJoinError('');
    try {
      if (supabase && isSupabaseConfigured) {
        const nextBalance = walletBalance - entryAmount;
        const balanceUpdate = await supabase.from('users').update({ wallet_balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', user.uid).gte('wallet_balance', entryAmount).select('wallet_balance').single();
        if (balanceUpdate.error) throw new Error('Your wallet could not be updated. Please try again.');
        const registration = await supabase.from('tournament_registrations').insert({ user_id: user.uid, team_id: teams[0]?.id.startsWith('local-') ? null : teams[0]?.id || null, tournament_key: pendingTournament.tournamentKey, game: pendingTournament.game, entry_fee: entryAmount, ign: joinForm.ign.trim(), character_id: joinForm.characterId.trim() });
        if (registration.error) {
          await supabase.from('users').update({ wallet_balance: walletBalance, updated_at: new Date().toISOString() }).eq('id', user.uid);
          throw new Error('We could not save your tournament slot. Your wallet was not charged.');
        }
        if (entryAmount > 0) await supabase.from('wallet_transactions').insert({ user_id: user.uid, title: `Match entry · ${pendingTournament.title}`, transaction_type: 'entry', amount: -entryAmount });
        setWalletBalance(Number(balanceUpdate.data.wallet_balance));
      } else {
        setWalletBalance((balance) => balance - entryAmount);
        if (entryAmount > 0) setTransactions((items) => [{ title: `Match entry · ${pendingTournament.title}`, date: 'Just now', amount: -entryAmount, kind: 'entry' }, ...items]);
      }
      setRegisteredTournaments((items) => [...items, pendingTournament.tournamentKey]);
      setPendingTournament(null);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : 'Unable to join this tournament right now.');
    } finally {
      setJoinBusy(false);
    }
  };

  const openWallet = (tab: 'add' | 'withdraw' = 'add') => {
    setActiveTab('wallet');
    setWalletTab(tab);
    setWalletView('wallet');
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
    if (activeAmount < 1 || Number.isNaN(activeAmount)) {
      setWalletMessage('Enter an amount of at least ₹1.');
      return;
    }
    setWalletMessage('');
    setWalletView('payment');
  };

  const handleMockPayment = async () => {
    setWalletBalance((balance) => balance + activeAmount);
    setTransactions((items) => [{ title: 'Added via UPI', date: 'Just now', amount: activeAmount, kind: 'deposit' }, ...items]);
    if (supabase && user) {
      await supabase.from('wallet_transactions').insert({ user_id: user.uid, title: 'Added via UPI', transaction_type: 'deposit', amount: activeAmount });
      await supabase.from('users').update({ wallet_balance: walletBalance + activeAmount, updated_at: new Date().toISOString() }).eq('id', user.uid);
    }
    setWalletView('wallet');
    setWalletTab('add');
    setCustomAmount('');
    setWalletMessage(`₹${activeAmount.toLocaleString('en-IN')} added successfully.`);
  };

  const handleWithdraw = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeAmount < 1 || Number.isNaN(activeAmount)) {
      setWalletMessage('Enter an amount of at least ₹1.');
    } else if (activeAmount > walletBalance) {
      setWalletMessage('The withdrawal amount is greater than your wallet balance.');
    } else {
      setWalletBalance((balance) => balance - activeAmount);
      setTransactions((items) => [{ title: 'Withdrawal to UPI', date: 'Just now', amount: -activeAmount, kind: 'withdrawal' }, ...items]);
      if (supabase && user) {
        await supabase.from('wallet_transactions').insert({ user_id: user.uid, title: 'Withdrawal to UPI', transaction_type: 'withdrawal', amount: -activeAmount });
        await supabase.from('users').update({ wallet_balance: walletBalance - activeAmount, updated_at: new Date().toISOString() }).eq('id', user.uid);
      }
      setCustomAmount('');
      setWalletMessage(`₹${activeAmount.toLocaleString('en-IN')} withdrawal requested.`);
    }
  };

  const copyUpiId = async () => {
    await navigator.clipboard?.writeText('ummedoarena@upi');
    setUpiCopied(true);
    window.setTimeout(() => setUpiCopied(false), 1800);
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
    const payload = { avatar_url: profileForm.avatarUrl.trim() || null, bio: profileForm.bio.trim() || null, real_name: profileForm.realName.trim() || null, preferred_games: profileForm.preferredGames, game_name: profileForm.gameName.trim() || null, character_id: profileForm.characterId.trim() || null, updated_at: new Date().toISOString() };
    if (supabase) {
      const response = await supabase.from('users').update(payload).eq('id', user.uid);
      if (response.error) {
        setProfileMessage(response.error.message);
        setProfileBusy(false);
        return;
      }
    }
    setProfileMessage('Profile saved successfully.');
    setProfileBusy(false);
  };

  const copyProfileField = async (value: string, field: string) => {
    await navigator.clipboard?.writeText(value);
    setCopyField(field);
    window.setTimeout(() => setCopyField(''), 1600);
  };

  const createTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !teamForm.name.trim() || !teamForm.tag.trim()) { setTeamMessage('Log in and enter a team name and tag.'); return; }
    setTeamBusy(true); setTeamMessage('');
    let logoUrl = teamForm.logoUrl.trim();
    if (teamLogoFile) {
      let uploaded = false;
      if (supabase) {
        const filePath = `${user.uid}/${Date.now()}-${teamLogoFile.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
        const upload = await supabase.storage.from('team-logos').upload(filePath, teamLogoFile, { upsert: true, contentType: teamLogoFile.type });
        if (!upload.error) { logoUrl = supabase.storage.from('team-logos').getPublicUrl(filePath).data.publicUrl; uploaded = true; }
      }
      if (!uploaded) logoUrl = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : ''); reader.readAsDataURL(teamLogoFile); });
    }
    const localTeam: Team = { id: `local-${Date.now()}`, name: teamForm.name.trim(), tag: teamForm.tag.trim().toUpperCase(), logoUrl, members: [{ id: `leader-${user.uid}`, userId: user.uid, role: 'leader', ign: profileForm.gameName, characterId: profileForm.characterId, status: 'accepted' }] };
    if (supabase) {
      const created = await supabase.from('teams').insert({ owner_id: user.uid, team_name: localTeam.name, team_tag: localTeam.tag, logo_url: localTeam.logoUrl || null }).select('id').single();
      if (created.error) { setTeamMessage(created.error.message); setTeamBusy(false); return; }
      localTeam.id = created.data.id;
      const member = await supabase.from('team_members').insert({ team_id: localTeam.id, user_id: user.uid, role: 'leader', ign: profileForm.gameName || null, character_id: profileForm.characterId || null, status: 'accepted' });
      if (member.error) { setTeamMessage(member.error.message); setTeamBusy(false); return; }
    }
    setTeams((items) => [localTeam, ...items]); setTeamForm({ name: '', tag: '', logoUrl: '' }); setTeamLogoFile(null); setTeamModalOpen(false); setTeamBusy(false);
  };

  const addTeammate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteModal || !inviteForm.lookup.trim()) { setTeamMessage('Enter an email, username, or Game ID.'); return; }
    setTeamBusy(true); setTeamMessage('');
    const isEmail = inviteForm.lookup.includes('@');
    let member: TeamMember = { id: `invite-${Date.now()}`, email: isEmail ? inviteForm.lookup.trim() : undefined, role: 'member', ign: inviteForm.ign.trim(), characterId: inviteForm.characterId.trim(), status: 'invited' };
    if (supabase) {
      let userId: string | undefined;
      if (isEmail) {
        const found = await supabase.from('users').select('id, game_name, character_id').eq('email', inviteForm.lookup.trim()).maybeSingle();
        userId = found.data?.id;
        member = { ...member, userId, ign: member.ign || found.data?.game_name || '', characterId: member.characterId || found.data?.character_id || '' };
      } else {
        const lookup = inviteForm.lookup.trim();
        const found = /^[0-9a-f-]{36}$/i.test(lookup)
          ? await supabase.from('users').select('id, email, game_name, character_id').eq('id', lookup).maybeSingle()
          : await supabase.from('users').select('id, email, game_name, character_id').or(`game_name.ilike.${lookup},character_id.eq.${lookup}`).maybeSingle();
        userId = found.data?.id;
        member = { ...member, userId, email: found.data?.email, ign: member.ign || found.data?.game_name || inviteForm.lookup.trim(), characterId: member.characterId || found.data?.character_id || '' };
      }
      const response = await supabase.from('team_members').insert({ team_id: inviteModal.id, user_id: userId || null, invite_email: userId ? null : (isEmail ? inviteForm.lookup.trim() : null), role: 'member', ign: member.ign || null, character_id: member.characterId || null, status: userId ? 'accepted' : 'invited' });
      if (response.error) { setTeamMessage(response.error.message); setTeamBusy(false); return; }
    }
    setTeams((items) => items.map((team) => team.id === inviteModal.id ? { ...team, members: [...team.members, member] } : team)); setInviteModal(null); setInviteForm({ lookup: '', ign: '', characterId: '' }); setTeamBusy(false);
  };

  const removeTeammate = async (team: Team, member: TeamMember) => {
    if (member.role === 'leader') return;
    if (supabase && !member.id.startsWith('invite-')) await supabase.from('team_members').delete().eq('id', member.id).eq('team_id', team.id);
    setTeams((items) => items.map((item) => item.id === team.id ? { ...item, members: item.members.filter((entry) => entry.id !== member.id) } : item));
  };

  const handleDeleteAccount = React.useCallback(async () => {
    if (!user) return;
    if (!window.confirm('Delete your Ummedo Arena account permanently? This removes your profile, wallet history, and registrations.')) return;
    setDeleteBusy(true);
    if (supabase) {
      await supabase.from('users').delete().eq('id', user.uid);
    }
    if (auth?.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch {
        setProfileMessage('Your profile was removed, but Firebase requires a recent login before the account can be deleted.');
        setDeleteBusy(false);
        setDeleteOpen(false);
        return;
      }
    }
    setDeleteBusy(false);
    setDeleteOpen(false);
    setUser(null);
  }, [user]);

  React.useEffect(() => {
    if (!deleteOpen) return;
    setDeleteOpen(false);
    void handleDeleteAccount();
  }, [deleteOpen, handleDeleteAccount]);

  const openAdminEditor = (tournament?: Tournament) => {
    setAdminTournament(tournament || null);
    setAdminMessage('');
    if (tournament) setAdminForm({ game: tournament.game, title: tournament.title, format: tournament.format, entry: tournament.entry.replace(/[^0-9.]/g, '') || '0', prize: tournament.prize.replace(/[^0-9.]/g, ''), matchStatus: tournament.matchStatus, roomId: tournament.roomId || '', roomPassword: tournament.roomPassword || '', streamUrl: tournament.streamUrl || '' });
    else setAdminForm({ game: 'BGMI', title: '', format: 'Solo', entry: '0', prize: '10000', matchStatus: 'upcoming', roomId: '', roomPassword: '', streamUrl: '' });
  };

  const saveTournament = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin || !adminForm.title.trim()) return;
    const tournamentKey = adminTournament?.tournamentKey || `${adminForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    const values = { tournament_key: tournamentKey, game: adminForm.game, title: adminForm.title.trim(), format: adminForm.format, entry_fee: Number(adminForm.entry) || 0, prize_pool: Number(adminForm.prize) || 0, match_status: adminForm.matchStatus, room_id: adminForm.roomId.trim() || null, room_password: adminForm.roomPassword.trim() || null, stream_url: adminForm.streamUrl.trim() || null, updated_at: new Date().toISOString() };
    if (supabase) {
      const response = adminTournament ? await supabase.from('tournaments').update(values).eq('tournament_key', tournamentKey) : await supabase.from('tournaments').insert(values);
      if (response.error) { setAdminMessage(response.error.message); return; }
    }
    const next: Tournament = { game: values.game, title: values.title, format: values.format, prize: `₹${values.prize_pool.toLocaleString('en-IN')}`, entry: values.entry_fee ? `₹${values.entry_fee.toLocaleString('en-IN')}` : 'Free', players: adminTournament?.players || '0 / 100', accent: adminTournament?.accent || 'lime', icon: adminTournament?.icon || <Swords size={22} strokeWidth={1.8} />, status: values.match_status === 'live' ? 'Live now' : values.match_status === 'completed' ? 'Completed' : 'Upcoming', tournamentKey, matchStatus: values.match_status as Tournament['matchStatus'], roomId: values.room_id || undefined, roomPassword: values.room_password || undefined, streamUrl: values.stream_url || undefined, spectatorCount: adminTournament?.spectatorCount || 0 };
    setTournamentList((items) => adminTournament ? items.map((item) => item.tournamentKey === tournamentKey ? next : item) : [next, ...items]);
    setAdminMessage('Tournament saved.');
    setAdminTournament(next);
  };

  const declareWinner = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin || !adminTournament || !user || !resultForm.ign.trim()) return;
    const prize = Number(resultForm.prize) || 0;
    let winnerUserId = user.uid;
    if (supabase) {
      const registration = await supabase.from('tournament_registrations').select('user_id').eq('tournament_key', adminTournament.tournamentKey).eq('ign', resultForm.ign.trim()).eq('character_id', resultForm.characterId.trim()).single();
      if (registration.data) winnerUserId = registration.data.user_id;
      const result = await supabase.from('tournament_results').upsert({ tournament_key: adminTournament.tournamentKey, user_id: winnerUserId, rank: 1, prize_amount: prize }, { onConflict: 'tournament_key,user_id' });
      if (result.error) { setAdminMessage(result.error.message); return; }
      if (prize > 0) {
        const profile = await supabase.from('users').select('wallet_balance').eq('id', winnerUserId).single();
        if (profile.data) {
          const nextBalance = Number(profile.data.wallet_balance) + prize;
          await supabase.from('users').update({ wallet_balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', winnerUserId);
          await supabase.from('wallet_transactions').insert({ user_id: winnerUserId, title: `Prize winnings · ${adminTournament.title}`, transaction_type: 'win', amount: prize });
        }
      }
      await supabase.from('tournaments').update({ match_status: 'completed', winner_user_id: winnerUserId, winner_prize: prize, updated_at: new Date().toISOString() }).eq('tournament_key', adminTournament.tournamentKey);
    }
    setTournamentList((items) => items.map((item) => item.tournamentKey === adminTournament.tournamentKey ? { ...item, matchStatus: 'completed', status: 'Completed', winnerName: resultForm.ign } : item));
    setAdminMessage(`Winner declared${prize ? ` and ₹${prize.toLocaleString('en-IN')} paid out` : ''}.`);
    setResultForm({ ign: '', characterId: '', prize: '' });
  };

  const profileName = user?.displayName || user?.email?.split('@')[0] || 'Player';
  const profileInitials = profileName.slice(0, 2).toUpperCase();
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
        <div className="sidebar-footer"><div className="upgrade-card"><span className="upgrade-icon"><CircleDollarSign size={17} /></span><strong>Go Pro</strong><p>Unlock private leagues and more.</p><button>Explore pro <ArrowUpRight size={13} /></button></div><button className="nav-item logout nav-button" onClick={handleLogout}><LogOut size={18} /> Log out</button></div>
      </aside>

      <main className="main-content">
        {adminOpen && isAdmin && <div className="admin-stream-quick"><label>Live stream URL or video ID<input value={adminForm.streamUrl} onChange={(event) => setAdminForm({ ...adminForm, streamUrl: event.target.value })} placeholder="youtube.com/watch?v=..." /></label><small>Choose a tournament in the admin panel, then save changes.</small></div>}
        {activeTab === 'tournaments' && <div className="stream-strip">{tournamentList.filter((item) => item.matchStatus === 'live' && item.streamUrl).map((item) => { const videoId = getYoutubeId(item.streamUrl); return <div className="stream-panel" key={`stream-${item.tournamentKey}`}><div className="insight-heading"><span><i className="live-dot" /> Watch live · {item.title}</span><b className="live-badge">LIVE</b></div><div className="stream-frame"><iframe title={`${item.title} live stream`} src={`https://www.youtube.com/embed/${videoId}?rel=0`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /><div className="spectator-count"><Users size={13} /> {item.spectatorCount || 0} watching</div></div><a className="stream-chat-link" href={`https://www.youtube.com/live_chat?v=${videoId}`} target="_blank" rel="noreferrer">Open live chat <ArrowUpRight size={14} /></a></div>; })}</div>}
        {activeTab === 'tournaments' && <div className="tournament-insights"><div className="tracker-panel"><div className="insight-heading"><span><Activity size={15} /> Live match tracker</span><small>Updates in real time</small></div>{tournamentList.filter((item) => item.matchStatus !== 'completed').slice(0, 3).map((item) => <div className="tracker-row" key={item.tournamentKey}><div><strong>{item.title}</strong><small>{item.mapName || 'Arena map'} · {item.mode || item.format}</small></div><b className={item.matchStatus}>{item.status}</b><span>{Math.max(0, (item.slotsTotal || 100) - (item.slotsFilled || 0))} slots left</span></div>)}</div><div className="results-panel"><div className="insight-heading"><span><Crown size={15} /> Match results & kill matrix</span><small>Completed matches</small></div>{tournamentList.filter((item) => item.matchStatus === 'completed').length === 0 ? <p className="empty-insight">No completed matches yet. Results will appear here after an admin publishes them.</p> : tournamentList.filter((item) => item.matchStatus === 'completed').map((item) => <div className="result-match" key={item.tournamentKey}><strong>{item.title}</strong><span>Winner: {item.winnerName || 'Pending'} · {item.kills || 0} kills · {item.matchPoints || 0} points</span></div>)}</div></div>}
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumb"><span>Overview</span><span className="breadcrumb-slash">/</span><strong>Dashboard</strong></div><div className="topbar-actions">
          <label className="search-box"><Search size={17} /><input type="search" placeholder="Search tournaments" aria-label="Search tournaments" /><kbd>⌘ K</kbd></label><button className="header-wallet" onClick={() => openWallet()}><Wallet size={15} /><span><small>Wallet balance</small><strong>₹{walletBalance.toLocaleString('en-IN')}</strong></span></button>
          <button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></button><div className="profile-chip"><button className="profile-trigger" onClick={() => openAuthModal()} aria-label={user ? 'Open account menu' : 'Log in'}><div className="avatar">{user?.photoURL ? <img src={user.photoURL} alt="" /> : profileInitials}</div><div className="profile-copy"><strong>{user ? profileName : 'Guest player'}</strong><span>{user ? 'Arena member' : 'Log in to compete'}</span></div><ChevronDown size={16} /></button>{user && <button className="profile-logout" onClick={handleLogout} aria-label="Log out"><LogOut size={15} /></button>}</div>
        </div></header>

        {activeTab !== 'dashboard' && <div className="page-content subpage-view"><div className="subpage-header"><div><p className="eyebrow">Ummedo Arena</p><h1>{activeTab === 'tournaments' ? 'Tournaments' : activeTab === 'teams' ? 'My teams' : activeTab === 'wallet' ? 'Wallet activity' : activeTab === 'leaderboard' ? 'Leaderboard' : 'Settings'}</h1><p className="subheading">{activeTab === 'tournaments' ? 'Find your next match and secure your spot.' : activeTab === 'teams' ? 'Build a squad that is ready for anything.' : activeTab === 'wallet' ? 'Your deposits, entries, and winnings in one place.' : activeTab === 'leaderboard' ? 'See who is making noise in the arena.' : 'Tune your arena experience.'}</p></div>{activeTab === 'wallet' && <button className="primary-button" onClick={() => openWallet('add')}><Wallet size={16} /> Manage wallet</button>}</div>{activeTab === 'tournaments' && <div className="tournament-grid">{tournamentList.map((tournament) => <article className="tournament-card" key={tournament.tournamentKey}><div className={`game-icon ${tournament.accent}`}>{tournament.icon}</div><div className="card-topline"><span>{tournament.game}</span><b className={`open-status ${tournament.matchStatus}`}><i /> {tournament.status}</b></div><h3>{tournament.title}</h3><p className="format">{tournament.format}</p><div className="card-data"><div><span>Prize pool</span><strong>{tournament.prize}</strong></div><div><span>Entry fee</span><strong>{tournament.entry}</strong></div></div><div className="card-footer"><span className="player-count"><Users size={14} /> {tournament.players}</span><span className="start-time">{tournament.status}</span></div>{canShowRoom(tournament) && <div className="room-credentials"><div><span>Room ID</span><strong>{tournament.roomId}</strong></div><div><span>Password</span><strong>{tournament.roomPassword || '—'}</strong></div><button onClick={() => { void navigator.clipboard?.writeText(`${tournament.roomId} / ${tournament.roomPassword || ''}`); }} aria-label="Copy room credentials"><Copy size={14} /></button></div>}<button className="join-button" onClick={() => handleJoin(tournament)} disabled={registeredTournaments.includes(tournament.tournamentKey)}>{registeredTournaments.includes(tournament.tournamentKey) ? 'Joined' : 'Join tournament'} <ArrowUpRight size={15} /></button></article>)}</div>}{activeTab === 'teams' && <div className="empty-panel"><Users size={28} /><h2>Your squad is waiting</h2><p>Create a team and invite players to enter squad tournaments together.</p><button className="primary-button">Create a team <Plus size={15} /></button></div>}{activeTab === 'wallet' && <div className="detail-grid"><div className="detail-panel balance-panel"><Wallet size={22} /><span>Available balance</span><strong>₹{walletBalance.toLocaleString('en-IN')}</strong><button className="primary-button" onClick={() => openWallet('add')}>Add cash <Plus size={15} /></button></div><div className="detail-panel"><div className="panel-title"><History size={16} /> Recent transactions</div>{transactions.map((transaction) => <div className="compact-transaction" key={`${transaction.title}-${transaction.date}`}><span>{transaction.title}<small>{transaction.date}</small></span><b className={transaction.amount > 0 ? 'positive' : ''}>{transaction.amount > 0 ? '+' : ''}₹{Math.abs(transaction.amount).toLocaleString('en-IN')}</b></div>)}</div></div>}{activeTab === 'leaderboard' && <div className="detail-panel leaderboard-panel"><div className="panel-title"><Crown size={16} /> Season rankings</div>{['ShadowMaverick', 'Tfnobitayt', 'NexxusOP', 'ClutchQueen', 'RogueViper'].map((name, index) => <div className="rank-row" key={name}><strong>0{index + 1}</strong><span className="avatar rank-avatar">{name.slice(0, 2)}</span><span>{name}<small>{index === 0 ? 'Champion tier' : 'Arena contender'}</small></span><b>{index === 0 ? '2,840' : `${2340 - index * 218}`} pts</b></div>)}</div>}{activeTab === 'settings' && <div className="detail-panel settings-panel"><div className="panel-title"><Settings size={16} /> Account settings</div><label>Display name<input defaultValue={profileName} /></label><label>Notification updates<select defaultValue="all"><option value="all">All tournament updates</option><option value="important">Important only</option></select></label><button className="primary-button"><Save size={15} /> Save settings</button></div>}</div>}
        <div className="page-content" id="dashboard" style={{ display: activeTab === 'dashboard' ? undefined : 'none' }}><section className="welcome-row"><div><p className="eyebrow">Thursday, 17 September 2026</p><h1>Good evening, Arjun<span className="neon-dot">.</span></h1><p className="subheading">The arena is live. Find your next challenge.</p></div><button className="wallet-card" id="wallet" onClick={() => openWallet()}><div className="wallet-heading"><span><Wallet size={16} /> UPI wallet</span><span className="wallet-status"><i /> Connected</span></div><strong>₹{walletBalance.toLocaleString('en-IN')}<span>.00</span></strong><span className="wallet-action">Manage wallet <ArrowUpRight size={14} /></span></button></section>
          <section className="hero-banner" aria-label="Featured tournament"><div className="hero-grid" /><div className="hero-glow" /><div className="hero-copy"><div className="live-pill"><span /> Live registrations</div><p className="hero-kicker">Featured tournament · BGMI</p><h2>Own the <em>drop.</em><br />Rule the arena.</h2><p className="hero-description">The biggest squad battle of the season is here. Assemble your team and take the crown.</p><button className="primary-button">View tournament <ArrowUpRight size={17} /></button></div><div className="hero-stats"><div><span>Prize pool</span><strong>₹1,00,000</strong></div><div><span>Teams registered</span><strong>184 <small>/ 256</small></strong></div><div><span>Starts in</span><strong>02<span className="time-divider">:</span>14<span className="time-divider">:</span>38</strong></div></div><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /></section>
          <section className="tournaments-section" id="tournaments"><div className="section-heading"><div><p className="eyebrow">Compete & win</p><h2>Active tournaments <span>({tournamentList.length})</span></h2></div><div className="section-controls"><button className="filter-button">All games <ChevronDown size={15} /></button><a href="#all">View all <ArrowUpRight size={15} /></a></div></div><div className="tournament-grid">{tournamentList.map((tournament) => <article className="tournament-card" key={tournament.tournamentKey}><div className={`game-icon ${tournament.accent}`}>{tournament.icon}</div><div className="card-topline"><span>{tournament.game}</span><b className={`open-status ${tournament.matchStatus}`}><i /> {tournament.status}</b></div><h3>{tournament.title}</h3><p className="format">{tournament.format}</p><div className="card-data"><div><span>Prize pool</span><strong>{tournament.prize}</strong></div><div><span>Entry fee</span><strong>{tournament.entry}</strong></div></div><div className="card-footer"><span className="player-count"><Users size={14} /> {tournament.players}</span><span className="start-time">{tournament.status}</span></div>{canShowRoom(tournament) && <div className="room-credentials"><div><span>Room ID</span><strong>{tournament.roomId}</strong></div><div><span>Password</span><strong>{tournament.roomPassword || '—'}</strong></div><button onClick={() => { void navigator.clipboard?.writeText(`${tournament.roomId} / ${tournament.roomPassword || ''}`); }} aria-label="Copy room credentials"><Copy size={14} /></button></div>}<button className="join-button" onClick={() => handleJoin(tournament)} disabled={registeredTournaments.includes(tournament.tournamentKey)}>{registeredTournaments.includes(tournament.tournamentKey) ? 'Joined' : tournament.matchStatus === 'completed' ? 'Results declared' : 'Join tournament'} {registeredTournaments.includes(tournament.tournamentKey) ? <Check size={15} /> : <ArrowUpRight size={15} />}</button></article>)}</div></section>
        </div>
        {activeTab === 'settings' && <div className="profile-page"><div className="profile-page-header"><div><p className="eyebrow">Account center</p><h2>Profile & account</h2><p>Make your arena identity yours. Changes sync across your devices.</p></div>{!user && <button className="primary-button" onClick={() => openAuthModal('login')}>Log in <ArrowUpRight size={15} /></button>}</div><form className="profile-layout" onSubmit={saveProfile}><div className="profile-main"><section className="profile-section profile-identity"><div className="profile-avatar-wrap"><div className="profile-large-avatar">{profileForm.avatarUrl ? <img src={profileForm.avatarUrl} alt="Profile" /> : <UserRound size={34} />}</div><div><h3>Profile picture</h3><p>Use a public image URL for your arena avatar.</p><div className="profile-url-field"><Image size={15} /><input value={profileForm.avatarUrl} onChange={(event) => updateProfileField('avatarUrl', event.target.value)} placeholder="https://..." /></div></div></div><label>Real name<input value={profileForm.realName} onChange={(event) => updateProfileField('realName', event.target.value)} placeholder="Your real name" /></label><label>Bio<textarea value={profileForm.bio} maxLength={160} onChange={(event) => updateProfileField('bio', event.target.value)} placeholder="Tell the arena who you are..." /><small>{profileForm.bio.length}/160</small></label></section><section className="profile-section"><div className="section-title"><Gamepad2 size={17} /><div><h3>Preferred games</h3><p>Pick the games you want to see first.</p></div></div><div className="game-preferences">{preferredGames.map((game) => <button type="button" className={profileForm.preferredGames.includes(game) ? 'game-preference selected' : 'game-preference'} key={game} onClick={() => updateProfileField('preferredGames', profileForm.preferredGames.includes(game) ? profileForm.preferredGames.filter((item) => item !== game) : [...profileForm.preferredGames, game])}>{profileForm.preferredGames.includes(game) && <Check size={14} />}{game}</button>)}</div></section></div><aside className="profile-side"><section className="profile-section gaming-identity"><div className="section-title"><Trophy size={17} /><div><h3>Gaming identity</h3><p>Used for tournament check-ins.</p></div></div><label>Game name (IGN)<div className="copyable-field"><input value={profileForm.gameName} onChange={(event) => updateProfileField('gameName', event.target.value)} placeholder="Your in-game name" /><button type="button" onClick={() => copyProfileField(profileForm.gameName, 'ign')} disabled={!profileForm.gameName}>{copyField === 'ign' ? <Check size={15} /> : <Copy size={15} />}</button></div></label><label>In-game character ID<div className="copyable-field"><input value={profileForm.characterId} onChange={(event) => updateProfileField('characterId', event.target.value.replace(/[^0-9]/g, ''))} placeholder="Your player ID" /><button type="button" onClick={() => copyProfileField(profileForm.characterId, 'characterId')} disabled={!profileForm.characterId}>{copyField === 'characterId' ? <Check size={15} /> : <Copy size={15} />}</button></div></label><button className="quick-save" type="submit" disabled={profileBusy}>{profileBusy ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{profileBusy ? 'Saving...' : 'Save profile'}</button>{profileMessage && <p className="profile-message">{profileMessage}</p>}</section><section className="profile-section account-section"><div className="section-title"><UserRound size={17} /><div><h3>Account management</h3><p>{user?.email || 'You are browsing as a guest.'}</p></div></div>{user ? <button type="button" className="account-action" onClick={handleLogout}><LogOut size={15} /> Log out</button> : <button type="button" className="account-action" onClick={() => openAuthModal('login')}><ArrowUpRight size={15} /> Log in</button>}<div className="danger-zone"><div><strong>Danger zone</strong><p>Delete your profile and wallet data permanently.</p></div><button type="button" onClick={() => setDeleteOpen(true)} disabled={!user}><Trash2 size={15} /> Delete account</button></div></section></aside></form></div>}
        {activeTab === 'teams' && <div className="teams-page"><div className="teams-toolbar"><div><p className="eyebrow">Squad management</p><h2>Your teams</h2><p className="subheading">Build a roster, then register your full squad for tournaments.</p></div><button className="primary-button" onClick={() => { setTeamMessage(''); setTeamModalOpen(true); }}><Plus size={16} /> Create a team</button></div>{teamMessage && <p className="profile-message">{teamMessage}</p>}{teams.length === 0 ? <div className="empty-panel"><Users size={28} /><h2>Your squad is waiting</h2><p>Create a team and invite players to enter squad tournaments together.</p><button className="primary-button" onClick={() => setTeamModalOpen(true)}>Create a team <Plus size={15} /></button></div> : <div className="teams-grid">{teams.map((team) => <article className="team-card" key={team.id}><div className="team-card-heading"><div className="team-logo">{team.logoUrl ? <img src={team.logoUrl} alt="" /> : <Users size={22} />}</div><div><h3>{team.name}</h3><span>[{team.tag}] · {team.members.length} players</span></div><button className="icon-button" aria-label="Team options"><MoreHorizontal size={18} /></button></div><div className="roster-heading"><span>Squad roster</span><button onClick={() => { setInviteModal(team); setTeamMessage(''); }}><UserPlus size={14} /> Add teammate</button></div><div className="roster-list">{team.members.map((member) => <div className="roster-member" key={member.id}><span className={`roster-avatar ${member.role}`}>{member.ign.slice(0, 2).toUpperCase() || '??'}</span><div><strong>{member.ign || member.email || 'Invited player'}</strong><small>{member.role === 'leader' ? 'Leader' : 'Member'} · ID {member.characterId || 'Pending'}{member.status === 'invited' ? ' · Invite pending' : ''}</small></div>{member.role !== 'leader' && <button className="icon-button remove-member" onClick={() => removeTeammate(team, member)} aria-label="Remove teammate"><X size={15} /></button>}</div>)}</div><button className="team-register" onClick={() => navigateTo('tournaments')}>Register squad for tournament <ArrowUpRight size={15} /></button></article>)}</div>}</div>}
      {teamModalOpen && <div className="team-backdrop"><section className="team-modal"><button className="wallet-close icon-button" onClick={() => setTeamModalOpen(false)} aria-label="Close"><X size={19} /></button><p className="eyebrow">Squad builder</p><h2>Create a team</h2><p>Set up your squad identity.</p><form className="team-form" onSubmit={createTeam}><label>Team name<input required value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} /></label><label>Team tag<input required maxLength={5} value={teamForm.tag} onChange={(event) => setTeamForm({ ...teamForm, tag: event.target.value })} /></label><label>Logo / avatar URL<input value={teamForm.logoUrl} onChange={(event) => setTeamForm({ ...teamForm, logoUrl: event.target.value })} /></label><button className="team-primary" type="submit" disabled={teamBusy}><Plus size={16} /> Create team</button></form></section></div>}
      {inviteModal && <div className="team-backdrop"><section className="team-modal"><button className="wallet-close icon-button" onClick={() => setInviteModal(null)} aria-label="Close"><X size={19} /></button><p className="eyebrow">{inviteModal.name} · [{inviteModal.tag}]</p><h2>Add teammate</h2><p>Invite by email, username, or Game ID.</p><form className="team-form" onSubmit={addTeammate}><label>Email, username, or Game ID<input required value={inviteForm.lookup} onChange={(event) => setInviteForm({ ...inviteForm, lookup: event.target.value })} /></label><label>IGN<input value={inviteForm.ign} onChange={(event) => setInviteForm({ ...inviteForm, ign: event.target.value })} /></label><label>Character ID<input value={inviteForm.characterId} onChange={(event) => setInviteForm({ ...inviteForm, characterId: event.target.value })} /></label><button className="team-primary" type="submit" disabled={teamBusy}><UserPlus size={16} /> Send invite</button></form></section></div>}
      {teamModalOpen && <label className="team-file-float">Upload a logo from your device<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0] || null; setTeamLogoFile(file); if (file) setTeamForm((form) => ({ ...form, logoUrl: URL.createObjectURL(file) })); }} /></label>}
      </main>
      {adminOpen && isAdmin && <div className="admin-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAdminOpen(false)}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title"><button className="wallet-close icon-button" onClick={() => setAdminOpen(false)} aria-label="Close admin panel"><X size={19} /></button><div className="admin-heading"><p className="eyebrow">Restricted workspace</p><h2 id="admin-title">Arena control room</h2><p>Create tournaments, publish rooms, and settle winners.</p></div><div className="admin-tabs"><button className={!adminTournament ? 'selected' : ''} onClick={() => openAdminEditor()}>New tournament <Plus size={14} /></button>{tournamentList.map((item) => <button className={adminTournament?.tournamentKey === item.tournamentKey ? 'selected' : ''} key={item.tournamentKey} onClick={() => openAdminEditor(item)}>{item.title}</button>)}</div><form className="admin-form" onSubmit={saveTournament}><label>Game<input value={adminForm.game} onChange={(event) => setAdminForm({ ...adminForm, game: event.target.value })} /></label><label>Tournament title<input required value={adminForm.title} onChange={(event) => setAdminForm({ ...adminForm, title: event.target.value })} placeholder="Weekend Arena Cup" /></label><div className="admin-fields"><label>Format<input value={adminForm.format} onChange={(event) => setAdminForm({ ...adminForm, format: event.target.value })} /></label><label>Entry fee<input type="number" min="0" value={adminForm.entry} onChange={(event) => setAdminForm({ ...adminForm, entry: event.target.value })} /></label><label>Prize pool<input type="number" min="0" value={adminForm.prize} onChange={(event) => setAdminForm({ ...adminForm, prize: event.target.value })} /></label><label>Status<select value={adminForm.matchStatus} onChange={(event) => setAdminForm({ ...adminForm, matchStatus: event.target.value })}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option></select></label></div><div className="admin-fields"><label>Room ID<input value={adminForm.roomId} onChange={(event) => setAdminForm({ ...adminForm, roomId: event.target.value })} placeholder="Publish when ready" /></label><label>Room password<input value={adminForm.roomPassword} onChange={(event) => setAdminForm({ ...adminForm, roomPassword: event.target.value })} placeholder="Publish when ready" /></label></div><button className="admin-save" type="submit"><Save size={15} /> Save tournament</button></form>{adminTournament && <form className="results-form" onSubmit={declareWinner}><div className="results-heading"><span><Crown size={15} /> Match results</span><small>Declare rank #1 and pay the prize</small></div><div className="admin-fields"><label>Winner IGN<input required value={resultForm.ign} onChange={(event) => setResultForm({ ...resultForm, ign: event.target.value })} /></label><label>Character ID<input required value={resultForm.characterId} onChange={(event) => setResultForm({ ...resultForm, characterId: event.target.value })} /></label><label>Prize payout<input type="number" min="0" value={resultForm.prize} onChange={(event) => setResultForm({ ...resultForm, prize: event.target.value })} /></label></div><button className="declare-button" type="submit"><Crown size={15} /> Declare winner & pay</button></form>}{adminMessage && <p className="admin-message">{adminMessage}</p>}</section></div>}
      {pendingTournament && <div className="join-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeJoinModal()}><section className="join-modal" role="dialog" aria-modal="true" aria-labelledby="join-title"><button className="wallet-close icon-button" onClick={closeJoinModal} aria-label="Close tournament confirmation"><X size={19} /></button><div className={`join-game-icon ${pendingTournament.accent}`}>{pendingTournament.icon}</div><p className="eyebrow">Confirm your slot</p><h2 id="join-title">{pendingTournament.title}</h2><p className="join-copy">Enter your BGMI details exactly as they appear in-game. Your entry fee will be deducted from your wallet.</p><div className="join-summary"><span>Entry fee <strong>{pendingTournament.entry}</strong></span><span>Remaining after entry <strong>₹{Math.max(0, walletBalance - (pendingTournament.entry === 'Free' ? 0 : Number(pendingTournament.entry.replace(/[^0-9.]/g, '')))).toLocaleString('en-IN')}</strong></span></div><form className="join-form" onSubmit={handleJoinConfirm}><label>BGMI In-Game Name (IGN)<div className="join-input"><Users size={16} /><input required maxLength={24} value={joinForm.ign} onChange={(event) => setJoinForm({ ...joinForm, ign: event.target.value })} placeholder="e.g. UmmedoHunter" /></div></label><label>Character ID<div className="join-input"><HashIcon /><input required inputMode="numeric" pattern="[0-9]+" maxLength={16} value={joinForm.characterId} onChange={(event) => setJoinForm({ ...joinForm, characterId: event.target.value.replace(/[^0-9]/g, '') })} placeholder="Enter your BGMI ID" /></div></label>{joinError && <p className="join-error">{joinError}</p>}<button className="join-confirm" type="submit" disabled={joinBusy}>{joinBusy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{joinBusy ? 'Confirming slot...' : 'Confirm and join'}</button></form></section></div>}
      {walletOpen && <div className="wallet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setWalletOpen(false)}><section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title"><button className="wallet-close icon-button" onClick={() => setWalletOpen(false)} aria-label="Close wallet"><X size={19} /></button>{walletView === 'payment' ? <><button className="back-wallet" onClick={() => setWalletView('wallet')}><ArrowLeft size={15} /> Back to wallet</button><div className="wallet-modal-heading"><p className="eyebrow">Secure UPI payment</p><h2 id="wallet-title">Add ₹{activeAmount.toLocaleString('en-IN')}</h2><p>Scan the QR or use your preferred UPI app to complete the payment.</p></div><div className="payment-layout"><div className="qr-frame"><QRCodeSVG value={`upi://pay?pa=ummedoarena@upi&pn=Ummedo%20Arena&am=${activeAmount}&cu=INR`} size={158} bgColor="#FFFFFF" fgColor="#0B0E14" level="M" /></div><div className="payment-details"><span className="payment-label">Pay to</span><strong>Ummedo Arena</strong><div className="upi-row"><span>ummedoarena@upi</span><button onClick={copyUpiId} aria-label="Copy UPI ID">{upiCopied ? <Check size={15} /> : <Copy size={15} />}</button></div><div className="payment-apps"><span>Open in</span><div><a href={`tez://upi/pay?pa=ummedoarena@upi&pn=Ummedo%20Arena&am=${activeAmount}&cu=INR`} aria-label="Open in Google Pay"><b className="app-dot gpay">G</b></a><a href={`phonepe://pay?pa=ummedoarena@upi&pn=Ummedo%20Arena&am=${activeAmount}&cu=INR`} aria-label="Open in PhonePe"><b className="app-dot phonepe">P</b></a><a href={`paytmmp://pay?pa=ummedoarena@upi&pn=Ummedo%20Arena&am=${activeAmount}&cu=INR`} aria-label="Open in Paytm"><b className="app-dot paytm">₹</b></a></div></div></div></div><div className="mock-payment"><span><CreditCard size={15} /> Demo checkout</span><button onClick={handleMockPayment}>Simulate payment success <Check size={14} /></button></div></> : <><div className="wallet-modal-heading"><p className="eyebrow">Your funds</p><h2 id="wallet-title">UPI wallet</h2><p>Manage your balance and keep your tournament entries ready.</p></div><div className="wallet-balance"><span>Available balance</span><strong>₹{walletBalance.toLocaleString('en-IN')}<small>.00</small></strong><span className="balance-secure"><Check size={13} /> Secured by UPI</span></div><div className="wallet-tabs"><button className={walletTab === 'add' ? 'selected' : ''} onClick={() => { setWalletTab('add'); setWalletMessage(''); }}>Add cash</button><button className={walletTab === 'withdraw' ? 'selected' : ''} onClick={() => { setWalletTab('withdraw'); setWalletMessage(''); }}>Withdraw</button></div>{walletTab === 'add' ? <form className="cash-form" onSubmit={handlePaymentStart}><label>Choose amount</label><div className="amount-presets">{[50, 100, 200, 500].map((amount) => <button type="button" className={!customAmount && selectedAmount === amount ? 'amount-selected' : ''} key={amount} onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}>{`₹${amount}`}</button>)}</div><label className="custom-amount-label">Custom amount<div className="amount-input"><span>₹</span><input type="number" min="1" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="Enter amount" /></div></label>{walletMessage && <p className="wallet-message success-message">{walletMessage}</p>}<button className="wallet-primary" type="submit">Continue to payment <ArrowUpRight size={16} /></button></form> : <form className="cash-form" onSubmit={handleWithdraw}><label>Amount to withdraw</label><label className="custom-amount-label"><div className="amount-input"><span>₹</span><input type="number" min="1" max={walletBalance} value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="Enter amount" /></div></label>{walletMessage && <p className="wallet-message">{walletMessage}</p>}<button className="wallet-primary" type="submit">Withdraw to UPI <ArrowUpRight size={16} /></button></form>}<div className="transaction-heading"><span><History size={15} /> Recent activity</span><small>Last 30 days</small></div><div className="transactions">{transactions.map((transaction) => <div className="transaction" key={`${transaction.title}-${transaction.date}`}><span className={`transaction-icon ${transaction.kind}`}>{transaction.kind === 'deposit' ? <ArrowUpRight size={15} /> : transaction.kind === 'win' ? <Trophy size={15} /> : <CreditCard size={15} />}</span><div><strong>{transaction.title}</strong><small>{transaction.date}</small></div><b className={transaction.amount > 0 ? 'positive' : ''}>{transaction.amount > 0 ? '+' : ''}₹{Math.abs(transaction.amount).toLocaleString('en-IN')}</b></div>)}</div></>}</section></div>}
      {authModalOpen && <div className="auth-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeAuthModal()}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="auth-close icon-button" onClick={closeAuthModal} aria-label="Close authentication"><X size={19} /></button><div className="auth-brand"><div className="brand-mark"><Trophy size={17} /></div><span>UMMEDO <b>ARENA</b></span></div><div className="auth-heading"><p className="eyebrow">Welcome to the arena</p><h2 id="auth-title">{authMode === 'login' ? 'Ready to play?' : 'Join the squad.'}</h2><p>{authMode === 'login' ? 'Sign in to join tournaments and track your wins.' : 'Create your account and start climbing the leaderboard.'}</p></div><button className="google-button" onClick={handleGoogleSignIn} disabled={authBusy}><Globe2 size={17} /> Continue with Google</button><div className="auth-divider"><span>or continue with email</span></div><form onSubmit={handleAuthSubmit}><label>Email address<div className="auth-input"><Mail size={16} /><input type="email" required autoComplete="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@example.com" /></div></label><label>Password<div className="auth-input"><LockKeyhole size={16} /><input type="password" required minLength={6} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="6+ characters" /></div></label>{authError && <p className="auth-error">{authError}</p>}<button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? <LoaderCircle className="spin" size={17} /> : null}{authMode === 'login' ? 'Log in' : 'Create account'} <ArrowUpRight size={15} /></button></form><p className="auth-switch">{authMode === 'login' ? 'New to Ummedo Arena?' : 'Already have an account?'} <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}>{authMode === 'login' ? 'Create an account' : 'Log in'}</button></p>{!isFirebaseConfigured && <p className="config-note">Auth is in preview mode. Configure Firebase to enable sign in.</p>}</section></div>}
    </div>
  );
}

export default App;
