import React from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { supabase } from './supabase';

export default function AuthDialog({ initialMode, onClose }: { initialMode: 'login' | 'signup'; onClose: () => void }) {
  const [mode, setMode] = React.useState(initialMode);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pendingEmail, setPendingEmail] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [retryAt, setRetryAt] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (!pendingEmail) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pendingEmail]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Authentication failed. Please try again.'); }
    finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (pendingEmail) {
        if (!/^[0-9]{8}$/.test(otp)) throw new Error('Enter the complete 8-digit code.');
        if (!supabase) throw new Error('Verification is unavailable.');
        const result = await supabase.auth.verifyOtp({ email: pendingEmail, token: otp, type: 'signup' });
        if (result.error) throw result.error;
        if (!result.data.session) throw new Error('Verification did not create a session. Request a new code.');
        onClose(); return;
      }
      if (supabase) {
        const result = mode === 'login'
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password });
        if (result.error) {
          if (result.error.code === 'email_not_confirmed') {
            setPendingEmail(email.trim()); setPassword('');
            setNotice('Your email needs verification. Request a new code below.'); return;
          }
          throw result.error;
        }
        if (!result.data.session) {
          setPendingEmail(email.trim()); setPassword(''); setOtp('');
          setRetryAt(Date.now() + 60000); setNow(Date.now());
          setNotice('Check your email for your 8-digit verification code.'); return;
        }
      } else if (auth) {
        if (mode === 'login') await signInWithEmailAndPassword(auth, email.trim(), password);
        else await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else throw new Error('Sign in is unavailable until authentication is configured.');
      onClose();
    });
  };
  const google = () => void run(async () => {
    if (supabase) {
      const result = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (result.error) throw result.error;
    } else if (auth) { await signInWithPopup(auth, googleProvider); onClose(); }
    else throw new Error('Google sign in is unavailable until authentication is configured.');
  });
  const resend = () => void run(async () => {
    if (!supabase || Date.now() < retryAt) return;
    const result = await supabase.auth.resend({ type: 'signup', email: pendingEmail });
    if (result.error) throw result.error;
    setRetryAt(Date.now() + 60000); setNow(Date.now()); setOtp('');
    setNotice('A new code has been sent. Use the latest code from your email.');
  });
  return <div className="auth-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="auth-close icon-button" aria-label="Close authentication" disabled={busy} onClick={onClose}>×</button>
      <div className="auth-heading"><p className="eyebrow">Welcome to the arena</p><h2 id="auth-title">{pendingEmail ? 'Verify your email' : mode === 'login' ? 'Ready to play?' : 'Join the squad.'}</h2></div>
      {!pendingEmail && <><button className="google-button" onClick={google} disabled={busy}>Continue with Google</button><div className="auth-divider">or continue with email</div></>}
      <form onSubmit={submit}>
        {pendingEmail ? <><p>Enter the code sent to {pendingEmail}.</p><label>8-digit verification code<div className="auth-input"><input autoFocus aria-label="8-digit verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} required onPaste={(e) => { e.preventDefault(); setOtp(e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 8)); }} value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} /></div></label></> : <>
          <label>Email address<div className="auth-input"><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div></label>
          <label>Password<div className="auth-input"><input type="password" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} /></div></label>
        </>}
        {error && <p className="auth-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        <button className="auth-submit" disabled={busy || Boolean(pendingEmail && otp.length !== 8)}>{busy ? 'Please wait…' : pendingEmail ? 'Verify code' : mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      <p className="auth-switch">{pendingEmail ? <><button disabled={busy || now < retryAt} onClick={resend}>Resend code{now < retryAt ? ` (${Math.ceil((retryAt - now) / 1000)}s)` : ''}</button> · <button disabled={busy} onClick={() => { setPendingEmail(''); setOtp(''); setError(''); setNotice(''); }}>Back to sign in</button></> : <button disabled={busy} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Log in'}</button>}</p>
    </section>
  </div>;
}
