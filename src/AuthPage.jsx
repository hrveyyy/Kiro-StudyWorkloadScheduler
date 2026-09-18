import { useState } from 'react';
import { authSignIn, authSignUp } from './supabase.js';

/**
 * AuthPage — full-screen login/register gate.
 * Props:
 *   onAuth : (session) => void  — called after successful sign-in/up
 */
export default function AuthPage({ onAuth }) {
  const [tab, setTab]         = useState('login');   // 'login' | 'register'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [notice, setNotice]   = useState(null);      // e.g. "check your email"

  function switchTab(t) {
    setTab(t);
    setError(null);
    setNotice(null);
    setEmail('');
    setPassword('');
    setConfirm('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (tab === 'register') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        const data = await authSignIn(email.trim(), password);
        onAuth(data.session);
      } else {
        const data = await authSignUp(email.trim(), password);
        // Supabase may require email confirmation depending on project settings
        if (data.session) {
          onAuth(data.session);
        } else {
          setNotice('Account created! Check your email to confirm, then log in.');
          switchTab('login');
        }
      }
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-icon">📚</span>
          <div>
            <h1 className="auth-app-name">Study Workload Scheduler</h1>
            <p className="auth-app-sub">Prioritize smarter, stress less</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'auth-tab-active' : ''}`}
            onClick={() => switchTab('login')}
            type="button"
          >
            Log In
          </button>
          <button
            className={`auth-tab ${tab === 'register' ? 'auth-tab-active' : ''}`}
            onClick={() => switchTab('register')}
            type="button"
          >
            Register
          </button>
        </div>

        {/* Notice (success info) */}
        {notice && (
          <div className="auth-notice" role="status">
            ✅ {notice}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="auth-error" role="alert">
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder={tab === 'register' ? 'At least 6 characters' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {tab === 'register' && (
            <div className="form-field">
              <label htmlFor="auth-confirm">Confirm Password</label>
              <input
                id="auth-confirm"
                type="password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading
              ? (tab === 'login' ? 'Signing in…' : 'Creating account…')
              : (tab === 'login' ? 'Log In' : 'Create Account')}
          </button>
        </form>

        <p className="auth-switch">
          {tab === 'login' ? (
            <>Don't have an account?{' '}
              <button type="button" className="auth-link" onClick={() => switchTab('register')}>
                Register
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => switchTab('login')}>
                Log In
              </button>
            </>
          )}
        </p>

      </div>
    </div>
  );
}
