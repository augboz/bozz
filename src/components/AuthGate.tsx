/**
 * AuthGate — login screen + session provider.
 *
 * Renders a login UI if no session exists, otherwise renders children with
 * the session object passed via the SessionContext (consumers can call
 * `useSession()` to get the current user).
 *
 * Supports magic-link email and Google OAuth. On Tauri desktop the OAuth
 * callback URL needs to be a localhost address that matches the dev server
 * (1420) or production build origin. Add it to Supabase Auth Redirect URLs.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { Mail, LogIn } from 'lucide-react';
import { supabase, isSupabaseConfigured, type Session } from '../lib/supabase';
import { themes } from '../lib/themes';
import { DEFAULT_APPEARANCE } from '../lib/appearance';
import type { Theme } from '../lib/types';

interface SessionContextValue {
  session: Session | null;
}

const SessionContext = createContext<SessionContextValue>({ session: null });

export function useSession(): Session | null {
  return useContext(SessionContext).session;
}

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const sendMagicLink = async () => {
    const cleaned = email.trim();
    if (!cleaned) return;
    setSending(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleaned,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        setStatus(`✓ Check ${cleaned} for the sign-in link.`);
      }
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    }
    setSending(false);
  };

  const signInWithGoogle = async () => {
    setStatus(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) setStatus(`Error: ${error.message}`);
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    }
  };

  if (loading) {
    return <SplashScreen text="loading" />;
  }

  if (session) {
    return <SessionContext.Provider value={{ session }}>{children}</SessionContext.Provider>;
  }

  // ── Login screen ──────────────────────────────────────────────────────
  const t = themes[DEFAULT_APPEARANCE.mood];
  const configured = isSupabaseConfigured();

  return (
    <div style={{
      minHeight: '100vh', background: t.bg, color: t.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--app-font)', padding: '1.5rem',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px',
        background: t.bgAlt, border: `1px solid ${t.border}`,
        borderRadius: '16px', padding: '2rem 1.75rem',
      }}>
        <div style={{
          fontSize: '0.7rem', letterSpacing: '0.16em', textTransform: 'uppercase',
          color: t.textDim, marginBottom: '0.45rem', textAlign: 'center',
        }}>
          Life Bozz
        </div>
        <h1 style={{
          fontSize: '1.3rem', fontWeight: 500, margin: 0, textAlign: 'center',
          color: t.text, letterSpacing: '-0.01em',
        }}>
          Sign in
        </h1>
        <p style={{
          fontSize: '0.8rem', color: t.textMuted, margin: '0.5rem 0 1.5rem',
          textAlign: 'center', lineHeight: 1.5,
        }}>
          Your data syncs across devices when you're signed in.
        </p>

        {!configured && (
          <div style={{
            background: t.alertBg, border: `1px solid ${t.alertBorder}`,
            color: t.alert, padding: '0.6rem 0.8rem', borderRadius: '8px',
            fontSize: '0.75rem', marginBottom: '1rem',
          }}>
            Supabase isn't configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_KEY
            to .env.local and restart.
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          disabled={!configured}
          style={btnPrimary(t, !configured)}
        >
          <LogIn size={15} strokeWidth={1.6} /> Continue with Google
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          margin: '1.1rem 0 0.85rem',
        }}>
          <div style={{ flex: 1, height: 1, background: t.border }} />
          <span style={{ fontSize: '0.65rem', color: t.textDim, letterSpacing: '0.1em' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: t.border }} />
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMagicLink()}
          placeholder="you@email.com"
          disabled={!configured}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: t.input, border: `1px solid ${t.border}`,
            borderRadius: '8px', padding: '0.7rem 0.85rem',
            color: t.text, fontFamily: 'inherit', fontSize: '0.9rem',
            outline: 'none', marginBottom: '0.6rem',
          }}
        />
        <button
          onClick={sendMagicLink}
          disabled={!configured || sending || !email.trim()}
          style={btnSecondary(t, !configured || sending || !email.trim())}
        >
          <Mail size={15} strokeWidth={1.6} /> {sending ? 'Sending…' : 'Send magic link'}
        </button>

        {status && (
          <div style={{
            marginTop: '1rem', fontSize: '0.78rem',
            color: status.startsWith('Error') ? t.alert : t.doneAccent,
            textAlign: 'center', lineHeight: 1.4,
          }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

function SplashScreen({ text }: { text: string }) {
  const t = themes[DEFAULT_APPEARANCE.mood];
  return (
    <div style={{
      minHeight: '100vh', background: t.bg, color: t.textMuted,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--app-font)',
      fontWeight: 300, letterSpacing: '0.05em', fontSize: '0.9rem',
    }}>
      {text}
    </div>
  );
}

const btnPrimary = (t: Theme, disabled: boolean): React.CSSProperties => ({
  width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
  background: t.text, color: t.bg, border: 'none', borderRadius: '9px',
  padding: '0.75rem 1rem', cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 500,
  opacity: disabled ? 0.4 : 1,
  transition: 'opacity 0.15s',
});

const btnSecondary = (t: Theme, disabled: boolean): React.CSSProperties => ({
  width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
  background: 'transparent', color: t.text, border: `1px solid ${t.borderStrong}`,
  borderRadius: '9px', padding: '0.7rem 1rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 400,
  opacity: disabled ? 0.4 : 1,
  transition: 'opacity 0.15s, background 0.15s',
});
