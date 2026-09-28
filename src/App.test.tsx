import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
jest.mock('./firebase', () => ({ auth: null }));
jest.mock('./supabase', () => ({ supabase: null }));
beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => window.localStorage.clear());
test('renders a clearly labelled preview without fabricated funds or authentication', () => {
  window.localStorage.setItem('ummedo-arena-user', JSON.stringify({ uid: 'fake', email: 'admin@example.test' }));
  render(<App />);
  expect(screen.getByText(/Preview: sample tournaments/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  expect(screen.queryByText(/2,840/)).not.toBeInTheDocument();
  expect(screen.queryByText('Admin panel')).not.toBeInTheDocument();
});
test('search filters tournaments and shows an empty state', () => {
  render(<App />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'does not exist' } });
  expect(screen.getByText('No tournaments found.')).toBeInTheDocument();
  expect(screen.queryByText('Night Ops: Squad Showdown')).not.toBeInTheDocument();
});
test('unconfigured login fails visibly rather than creating a fake session', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'player@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Log in' })[1]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign in is unavailable');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
test('leaderboard shows real empty state and teams has one create flow', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Leaderboard' }));
  expect(screen.getByText('No results published yet.')).toBeInTheDocument();
  expect(screen.queryByText('ShadowMaverick')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'My teams' }));
  expect(screen.getAllByText('Your squad is waiting')).toHaveLength(1);
});
