import { type ElementType, type CSSProperties } from 'react';
import { Newspaper, Briefcase, Bell, MessageSquare, Users, ExternalLink } from 'lucide-react';
import { Widget, WidgetHeader } from '../shared/Widget';
import type { WidgetCtx } from './context';
import { isTauri } from '../../lib/platform';

// LinkedIn's API doesn't allow reading your feed/messages/notifications, so this
// is a quick-access launcher: one tap opens the right LinkedIn section in your
// browser, where you're already signed in. No OAuth, no developer app needed.
const ACCENT = '#0a66c2'; // LinkedIn blue

// lucide dropped its brand glyphs, so render the LinkedIn "in" mark inline. Props
// mirror a lucide icon so it drops into WidgetHeader unchanged.
function LinkedInMark({ size = 16, color = 'currentColor', style }: { size?: number; color?: string; strokeWidth?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
    </svg>
  );
}

async function openLink(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

const SHORTCUTS: Array<{ label: string; url: string; Icon: ElementType }> = [
  { label: 'Feed',          url: 'https://www.linkedin.com/feed/',          Icon: Newspaper },
  { label: 'Jobs',          url: 'https://www.linkedin.com/jobs/',          Icon: Briefcase },
  { label: 'Notifications', url: 'https://www.linkedin.com/notifications/', Icon: Bell },
  { label: 'Messaging',     url: 'https://www.linkedin.com/messaging/',     Icon: MessageSquare },
  { label: 'My network',    url: 'https://www.linkedin.com/mynetwork/',     Icon: Users },
];

export default function LinkedInWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t } = ctx;
  return (
    <Widget t={t} accent={ACCENT}>
      <WidgetHeader label="LinkedIn" icon={LinkedInMark} accent={ACCENT} t={t} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.7rem' }}>
        {SHORTCUTS.map(({ label, url, Icon }) => (
          <button
            key={label}
            onClick={() => openLink(url)}
            title={`Open LinkedIn ${label} in your browser`}
            onMouseEnter={e => { e.currentTarget.style.background = ACCENT + '22'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ACCENT + '12'; }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.55rem',
              width: '100%', textAlign: 'left',
              background: ACCENT + '12', border: `1px solid ${ACCENT}33`,
              borderRadius: '9px', padding: '0.5rem 0.65rem',
              color: t.text, fontFamily: 'inherit', fontSize: '0.82rem',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            <Icon size={15} strokeWidth={1.6} color={ACCENT} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            <ExternalLink size={12} strokeWidth={1.5} color={t.textDim} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </Widget>
  );
}
