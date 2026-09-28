import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { supabase } from './supabase';
jest.mock('./firebase', () => ({ auth: null }));
jest.mock('./supabase', () => ({ supabase: { auth: { onAuthStateChange: jest.fn(), signOut: jest.fn() }, from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));
const api = supabase!;
let listener: (event: string, session: any) => void;
let rows: Record<string, any>;
let failure: string | null;
let updates: jest.Mock;
beforeEach(() => {
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => '00000000-0000-4000-8000-000000000099' } });
  window.history.replaceState(null, '', '/');
  jest.clearAllMocks(); failure = null; updates = jest.fn();
  rows = {
    tournament_catalog: [{ tournament_key: 'cup', game: 'Valorant', title: 'Test cup', format: 'Solo', entry_fee: 10, prize_pool: 100, slots_filled: 0, slots_total: 2, match_status: 'upcoming' }],
    users: { id: 'player', wallet_balance: 100, avatar_url: '', bio: 'Saved bio', real_name: 'Player', game_name: 'Player', character_id: '001' },
    wallet_transactions: [], tournament_registrations: [], teams: [], admin_users: [],
  };
  (api.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => { listener = cb; return { data: { listener: null, subscription: { unsubscribe: jest.fn() } } }; });
  (api.auth.signOut as jest.Mock).mockImplementation(async () => { listener('SIGNED_OUT', null); return { error: null }; });
  (api.from as jest.Mock).mockImplementation((table: string) => {
    const query: any = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'single']) query[method] = jest.fn(() => query);
    query.update = jest.fn((value) => { updates(table, value); return query; });
    query.then = (resolve: any) => Promise.resolve({ data: failure === table ? null : rows[table], error: failure === table ? { message: 'Database unavailable' } : null }).then(resolve);
    return query;
  });
  (api.rpc as jest.Mock).mockImplementation(async (name) => ({ data: name === 'join_tournament' ? 90 : name === 'ensure_profile' ? null : [], error: null }));
  const channel = { on: jest.fn(), subscribe: jest.fn() }; channel.on.mockReturnValue(channel); channel.subscribe.mockReturnValue(channel);
  (api.channel as jest.Mock).mockReturnValue(channel);
});
async function login() {
  act(() => listener('SIGNED_IN', { user: { id: 'player', email: 'player@example.test', user_metadata: {} } }));
  await waitFor(() => expect(api.rpc).toHaveBeenCalledWith('ensure_profile'));
  await waitFor(() => expect(screen.getByRole('button', { name: /Wallet balance ₹100.00/ })).toBeInTheDocument());
}
test('guests load remote tournaments, including empty catalog', async () => {
  rows.tournament_catalog = [];
  render(<App />);
  expect(await screen.findByText('No tournaments found.')).toBeInTheDocument();
  expect(api.from).toHaveBeenCalledWith('tournament_catalog');
  expect(api.rpc).not.toHaveBeenCalledWith('ensure_profile');
  expect(screen.queryByText('Night Ops: Squad Showdown')).not.toBeInTheDocument();
});
test('failed requests show retry and recover', async () => {
  failure = 'tournament_catalog'; render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
  failure = null; fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Test cup');
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
test('joining calls atomic RPC and never writes balances from the browser', async () => {
  render(<App />); await screen.findByText('Test cup'); await login();
  fireEvent.click(screen.getByRole('button', { name: /Join tournament/ }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByLabelText(/Valorant In-Game Name/)).toHaveValue('Player');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm and join' }));
  await waitFor(() => expect(api.rpc).toHaveBeenCalledWith('join_tournament', { p_key: 'cup', p_ign: 'Player', p_character_id: '001', p_team: null }));
  expect(updates).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
test('profile loads without overwriting it, saves explicitly, and clears on logout', async () => {
  render(<App />); await screen.findByText('Test cup'); await login();
  expect(updates).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  const bio = screen.getByPlaceholderText(/Tell the arena/i);
  expect(bio).toHaveValue('Saved bio');
  fireEvent.change(bio, { target: { value: 'New bio' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  await screen.findByText('Profile saved successfully.');
  expect(updates).toHaveBeenCalledWith('users', expect.objectContaining({ bio: 'New bio' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Log out' })[0]);
  await waitFor(() => expect(bio).toHaveValue(''));
});
test('payment and withdrawal attempts leave wallet unchanged', async () => {
  render(<App />); await screen.findByText('Test cup'); await login();
  fireEvent.click(screen.getByRole('button', { name: /Wallet balance ₹100.00/ }));
  const requestsBefore = (api.rpc as jest.Mock).mock.calls.length;
  const readsBefore = (api.from as jest.Mock).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /Continue to payment/ }));
  expect(screen.getByText(/Payments are currently unavailable/)).toBeInTheDocument();
  expect(screen.queryByText(/Simulate payment success/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
  fireEvent.click(screen.getByRole('button', { name: /Withdraw to UPI/ }));
  expect(screen.getByText(/Your balance has not changed/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Wallet balance ₹100.00/ })).toBeInTheDocument();
  expect((api.rpc as jest.Mock).mock.calls).toHaveLength(requestsBefore);
  expect((api.from as jest.Mock).mock.calls).toHaveLength(readsBefore);
  expect(updates).not.toHaveBeenCalled();
});

test('allowlisted admin creates a tournament through the authorized RPC', async () => {
  rows.admin_users = [{ user_id: 'player' }];
  render(<App />); await screen.findByText('Test cup'); await login();
  fireEvent.click(await screen.findByRole('button', { name: 'Admin panel' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Tournament title'), { target: { value: 'Launch cup' } });
  fireEvent.change(within(dialog).getByLabelText('Entry fee'), { target: { value: '0' } });
  fireEvent.change(within(dialog).getByLabelText('Prize pool'), { target: { value: '0' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save tournament' }));
  await screen.findByText('Tournament saved.');
  expect(api.rpc).toHaveBeenCalledWith('save_tournament', expect.objectContaining({ p_key: expect.stringMatching(/^arena-/), p_title: 'Launch cup', p_entry: 0, p_prize: 0 }));
  expect(updates).not.toHaveBeenCalled();
});

test('failed admin save displays the server error without success feedback', async () => {
  rows.admin_users = [{ user_id: 'player' }];
  const normalRpc = (api.rpc as jest.Mock).getMockImplementation()!;
  (api.rpc as jest.Mock).mockImplementation((name, ...args) => name === 'save_tournament' ? Promise.resolve({ error: { message: 'Admin access required' }, data: null }) : normalRpc(name, ...args));
  render(<App />); await screen.findByText('Test cup'); await login();
  fireEvent.click(await screen.findByRole('button', { name: 'Admin panel' }));
  fireEvent.change(screen.getByLabelText('Tournament title'), { target: { value: 'Launch cup' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save tournament' }));
  expect(await screen.findByText('Admin access required')).toBeInTheDocument();
  expect(screen.queryByText('Tournament saved.')).not.toBeInTheDocument();
});

test('leaderboard aggregates published results and ranks players by points', async () => {
  const normalRpc = (api.rpc as jest.Mock).getMockImplementation()!;
  (api.rpc as jest.Mock).mockImplementation((name, ...args) => name === 'public_results' ? Promise.resolve({ error: null, data: [
    { tournament_key: 'one', user_id: 'alpha', ign: 'Alpha', rank: 1, kills: 2, match_points: 30 },
    { tournament_key: 'two', user_id: 'alpha', ign: 'Alpha', rank: 2, kills: 1, match_points: 20 },
    { tournament_key: 'one', user_id: 'bravo', ign: 'Bravo', rank: 2, kills: 1, match_points: 40 },
  ] }) : normalRpc(name, ...args));
  render(<App />); await screen.findByText('Test cup');
  fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));
  const rankings = document.querySelectorAll('.rank-row');
  expect(rankings).toHaveLength(2);
  expect(rankings[0]).toHaveTextContent('Alpha50 pts');
  expect(rankings[1]).toHaveTextContent('Bravo40 pts');
});

test.each([
  { match_status: 'live' },
  { match_status: 'completed' },
  { slots_filled: 2 },
])('closed or full tournaments cannot be joined: %j', async (state) => {
  Object.assign(rows.tournament_catalog[0], state);
  render(<App />); await screen.findByText('Test cup');
  expect(screen.getByRole('button', { name: /Registration closed|Results declared/ })).toBeDisabled();
});

test('failed join keeps the dialog open and does not change displayed funds', async () => {
  const normalRpc = (api.rpc as jest.Mock).getMockImplementation()!;
  (api.rpc as jest.Mock).mockImplementation((name, ...args) => name === 'join_tournament' ? Promise.resolve({ error: { message: 'Tournament is full' }, data: null }) : normalRpc(name, ...args));
  render(<App />); await screen.findByText('Test cup'); await login();
  fireEvent.click(screen.getByRole('button', { name: /Join tournament/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and join' }));
  expect(await screen.findByText('Tournament is full')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Wallet balance ₹100.00/ })).toBeInTheDocument();
  expect(updates).not.toHaveBeenCalled();
});
