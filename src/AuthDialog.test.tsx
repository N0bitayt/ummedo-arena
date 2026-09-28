import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthDialog from './AuthDialog';
import { supabase } from './supabase';
jest.mock('./firebase', () => ({ auth: null }));
jest.mock('./supabase', () => ({ supabase: { auth: { signUp: jest.fn(), signInWithPassword: jest.fn(), verifyOtp: jest.fn(), resend: jest.fn(), signInWithOAuth: jest.fn() } } }));
const api = supabase!.auth as jest.Mocked<NonNullable<typeof supabase>["auth"]>;
beforeEach(() => jest.clearAllMocks());
async function signup() {
  (api.signUp as jest.Mock).mockResolvedValue({ data: { user: { id: 'unconfirmed' }, session: null }, error: null });
  const close = jest.fn();
  render(<AuthDialog initialMode="signup" onClose={close} />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'player@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'valid-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  await screen.findByLabelText('8-digit verification code');
  return close;
}
test('unconfirmed signup requires all 8 digits and preserves leading zeros', async () => {
  const close = await signup();
  expect(close).not.toHaveBeenCalled();
  const input = screen.getByLabelText('8-digit verification code');
  fireEvent.change(input, { target: { value: '0012345' } });
  expect(screen.getByRole('button', { name: 'Verify code' })).toBeDisabled();
  fireEvent.paste(input, { clipboardData: { getData: () => '00 123456' } });
  expect(input).toHaveValue('00123456');
  (api.verifyOtp as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'synthetic' } }, error: null });
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(api.verifyOtp).toHaveBeenCalledWith({ email: 'player@example.test', token: '00123456', type: 'signup' });
});
test('expired OTP shows an error, keeps dialog open and allows retry', async () => {
  const close = await signup();
  (api.verifyOtp as jest.Mock).mockResolvedValue({ data: {}, error: new Error('Code has expired') });
  fireEvent.change(screen.getByLabelText('8-digit verification code'), { target: { value: '12345678' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Code has expired');
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Verify code' })).toBeEnabled();
  expect(screen.getByRole('button', { name: /Resend code/ })).toBeDisabled();
});
test('email-not-confirmed login opens verification and can resend', async () => {
  (api.signInWithPassword as jest.Mock).mockResolvedValue({ error: { code: 'email_not_confirmed' } });
  (api.resend as jest.Mock).mockResolvedValue({ error: null });
  render(<AuthDialog initialMode="login" onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'player@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  await screen.findByLabelText('8-digit verification code');
  fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
  await waitFor(() => expect(api.resend).toHaveBeenCalledWith({ type: 'signup', email: 'player@example.test' }));
});
test('failed login does not close the dialog', async () => {
  const close = jest.fn();
  (api.signInWithPassword as jest.Mock).mockRejectedValue(new Error('Network unavailable'));
  render(<AuthDialog initialMode="login" onClose={close} />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'player@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
  expect(close).not.toHaveBeenCalled();
});

test('successful password login closes only after the provider returns a session', async () => {
  const close = jest.fn();
  (api.signInWithPassword as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'player' } } }, error: null });
  render(<AuthDialog initialMode="login" onClose={close} />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'player@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(api.signInWithPassword).toHaveBeenCalledWith({ email: 'player@example.test', password: 'password' });
});

test('verification without a session never reports success', async () => {
  const close = await signup();
  (api.verifyOtp as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
  fireEvent.change(screen.getByLabelText('8-digit verification code'), { target: { value: '12345678' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Verification did not create a session');
  expect(close).not.toHaveBeenCalled();
});

test('OTP rejects non-digits and truncates pasted extra digits to eight', async () => {
  await signup();
  const input = screen.getByLabelText('8-digit verification code');
  fireEvent.change(input, { target: { value: '12ab34' } });
  expect(input).toHaveValue('1234');
  expect(screen.getByRole('button', { name: 'Verify code' })).toBeDisabled();
  fireEvent.paste(input, { clipboardData: { getData: () => '0012-3456 789' } });
  expect(input).toHaveValue('00123456');
  expect(screen.getByRole('button', { name: 'Verify code' })).toBeEnabled();
});
