import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { WidgetCtx } from './context';
import type { Theme } from '../../lib/types';
import { getWAChats, getWASessionStatus, isWAConfigured, type WAChat } from '../../lib/whatsapp';
import { supabase } from '../../lib/supabase';

const POLL_MS     = 30_000;
const QR_POLL_MS  =  3_000;

export default function WhatsAppWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t } = ctx;
  const [userId, setUserId]       = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [phone, setPhone]         = useState<string | null>(null);
  const [qr, setQr]               = useState<string | null>(null);
  const [chats, setChats]         = useState<WAChat[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const refresh = useCallback(async (uid: string) => {
    try {
      const s = await getWASessionStatus(uid);
      if (s.connected) {
        setConnected(true); setPhone(s.phone ?? null); setQr(null);
        const c = await getWAChats(uid);
        setChats(c); setError(null);
      } else {
        setConnected(false);
        setQr(s.qr ?? null);
      }
    } catch (e) {
      setError(String(e).replace('Error: ', ''));
    }
  }, []);

  useEffect(() => {
    if (!userId || !isWAConfigured()) { setReady(true); return; }
    refresh(userId).finally(() => setReady(true));
  }, [userId, refresh]);

  // Polling — faster while waiting for QR scan
  useEffect(() => {
    if (!userId || !ready || !isWAConfigured()) return;
    const ms = qr ? QR_POLL_MS : POLL_MS;
    const id = setInterval(() => refresh(userId), ms);
    return () => clearInterval(id);
  }, [userId, ready, qr, refresh]);

  if (!ready) return null;

  // Bridge not configured / not running
  if (!isWAConfigured() || (!connected && !qr && error)) {
    return (
      <Shell t={t} phone={null} connected={false}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.76rem', color: t.textMuted, textAlign: 'center', lineHeight: 1.6 }}>
            {!isWAConfigured()
              ? <>Connect WhatsApp in<br />Settings → Integrations</>
              : 'Bridge not reachable — is it running?'}
          </div>
        </div>
      </Shell>
    );
  }

  // Waiting for QR scan
  if (!connected && qr) {
    return (
      <Shell t={t} phone={null} connected={false}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
          <img src={qr} alt="WhatsApp QR" style={{ width: 160, height: 160, borderRadius: '8px', border: `1px solid ${t.border}` }} />
          <div style={{ fontSize: '0.72rem', color: t.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
            Open WhatsApp → ⋮ → Linked devices<br />→ Link a device → scan
          </div>
        </div>
      </Shell>
    );
  }

  // Initialising (no QR yet, no connection, no error)
  if (!connected && !qr && !error) {
    return (
      <Shell t={t} phone={null} connected={false}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.76rem', color: t.textMuted }}>Connecting…</div>
        </div>
      </Shell>
    );
  }

  // Connected — show chats
  return (
    <Shell t={t} phone={phone} connected>
      {error && <div style={{ fontSize: '0.68rem', color: t.alert, marginBottom: '0.3rem', flexShrink: 0 }}>{error}</div>}
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {chats.length === 0 && (
          <div style={{ fontSize: '0.76rem', color: t.textMuted, textAlign: 'center', padding: '1rem 0', lineHeight: 1.5 }}>
            Messages will appear here
          </div>
        )}
        {chats.map(chat => <ChatRow key={chat.id} chat={chat} t={t} />)}
      </div>
    </Shell>
  );
}

function Shell({ t, phone, connected, children }: { t: Theme; phone: string | null; connected: boolean; children: React.ReactNode }) {
  return (
    <div style={{ padding: '0.85rem 1rem 0', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: '6px', flexShrink: 0, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
          💬
        </div>
        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: t.text, flex: 1 }}>WhatsApp</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#25D366' : t.textDim }} />
          <span style={{ fontSize: '0.65rem', color: t.textMuted }}>
            {connected ? (phone ? `+${phone}` : 'Connected') : 'Disconnected'}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

function ChatRow({ chat, t }: { chat: WAChat; t: Theme }) {
  const initials = chat.name.slice(0, 2).toUpperCase();
  const ago = chat.timestamp ? formatDistanceToNow(new Date(chat.timestamp), { addSuffix: true }) : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0', borderBottom: `1px solid ${t.border}` }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: chat.isGroup ? '#075E54' : '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#fff' }}>
        {chat.isGroup ? '👥' : initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: chat.unread > 0 ? 600 : 400, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
            {chat.name}
          </span>
          <span style={{ fontSize: '0.6rem', color: t.textDim, flexShrink: 0 }}>{ago}</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {chat.fromMe ? <span style={{ color: t.textDim }}>You: </span> : null}
          {chat.lastMessage}
        </div>
      </div>
      {chat.unread > 0 && (
        <div style={{ background: '#25D366', color: '#fff', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', minWidth: '18px', textAlign: 'center', flexShrink: 0 }}>
          {chat.unread > 99 ? '99+' : chat.unread}
        </div>
      )}
    </div>
  );
}
