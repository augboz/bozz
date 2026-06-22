/**
 * Onboarding — guided "getting started" cards shown on the Home page for new
 * users (and replayable from Settings). Each step can highlight the real button
 * to click via a pulsing ring (HighlightPulse), and auto-checks off as the user
 * completes the action. Two walkthroughs: connect email + add a widget, and
 * create a topic inside a folder.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, ChevronRight, Mail, FolderTree } from 'lucide-react';
import type { SectionId, Theme } from '../../lib/types';

// ── Pulsing highlight ring over a [data-onb="id"] element ──────────────────────

export function HighlightPulse({ targetId, accent }: { targetId: string | null; accent: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!targetId) { setRect(null); return; }
    const update = () => {
      const el = document.querySelector(`[data-onb="${targetId}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    const id = window.setInterval(update, 250); // catch elements that appear / move
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [targetId]);

  if (!targetId || !rect) return null;
  const pad = 6;
  return createPortal(
    <>
      <div style={{
        position: 'fixed', left: rect.left - pad, top: rect.top - pad,
        width: rect.width + pad * 2, height: rect.height + pad * 2,
        borderRadius: '12px', border: `2px solid ${accent}`,
        pointerEvents: 'none', zIndex: 9998,
        animation: 'onbPulse 1.3s ease-in-out infinite',
      }} />
      <style>{`@keyframes onbPulse {
        0%,100% { box-shadow: 0 0 0 0 ${accent}66; }
        50%     { box-shadow: 0 0 0 7px ${accent}00; }
      }`}</style>
    </>,
    document.body,
  );
}

// ── Step row ───────────────────────────────────────────────────────────────────

function Step({ t, done, label, actionLabel, onAction }: {
  t: Theme; done: boolean; label: string; actionLabel: string; onAction: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0' }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${done ? t.doneAccent : t.borderStrong}`,
        background: done ? t.doneAccent : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.2s, border-color 0.2s',
      }}>
        {done && <Check size={12} strokeWidth={3} color={t.bg} />}
      </div>
      <span style={{
        flex: 1, fontSize: '0.82rem', color: done ? t.textMuted : t.text,
        textDecoration: done ? 'line-through' : 'none',
      }}>
        {label}
      </span>
      {!done && (
        <button
          onClick={onAction}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
            background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
            padding: '0.25rem 0.6rem', color: t.text, fontSize: '0.74rem',
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {actionLabel} <ChevronRight size={13} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

// ── Walkthrough card ───────────────────────────────────────────────────────────

function WalkCard({ t, icon: Icon, title, subtitle, children, complete }: {
  t: Theme; icon: React.ElementType; title: string; subtitle: string;
  children: React.ReactNode; complete: boolean;
}) {
  return (
    <div style={{
      flex: '1 1 280px', minWidth: 0,
      border: `1px solid ${complete ? t.doneAccent + '55' : t.border}`,
      borderRadius: '14px', padding: '1rem 1.1rem',
      background: t.bgAlt,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '9px', flexShrink: 0,
          background: complete ? t.doneAccent + '22' : t.input,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {complete ? <Check size={16} strokeWidth={2.4} color={t.doneAccent} /> : <Icon size={16} strokeWidth={1.7} color={t.textMuted} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: t.text }}>{title}</div>
          <div style={{ fontSize: '0.72rem', color: t.textMuted }}>{complete ? 'All done — nice!' : subtitle}</div>
        </div>
      </div>
      {!complete && <div style={{ paddingLeft: '0.1rem' }}>{children}</div>}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────────

export interface OnboardingProps {
  t: Theme;
  gmailConnected: boolean;
  emailsWidgetAdded: boolean;
  topicAdded: boolean;
  topicInFolder: boolean;
  onHighlight: (id: string | null) => void;
  onGo: (section: SectionId) => void;
  onDismiss: () => void;
}

export default function Onboarding({
  t, gmailConnected, emailsWidgetAdded, topicAdded, topicInFolder,
  onHighlight, onGo, onDismiss,
}: OnboardingProps) {
  const emailComplete = gmailConnected && emailsWidgetAdded;
  const topicsComplete = topicAdded && topicInFolder;

  // Point the highlight at a target and (optionally) navigate there.
  const guide = (target: string, section?: SectionId) => {
    if (section) onGo(section);
    // let the section mount before measuring the target
    window.setTimeout(() => onHighlight(target), section ? 120 : 0);
  };

  return (
    <div style={{
      border: `1px solid ${t.border}`, borderRadius: '16px',
      padding: '1.1rem 1.2rem', marginBottom: '1.5rem', background: t.panel ?? t.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
        <div>
          <div style={{ fontSize: '0.98rem', fontWeight: 700, color: t.text }}>Getting started</div>
          <div style={{ fontSize: '0.76rem', color: t.textMuted, marginTop: '0.1rem' }}>
            Two quick walkthroughs. Click “Show me” and Bozz will point you to each button.
          </div>
        </div>
        <button
          onClick={() => { onHighlight(null); onDismiss(); }}
          aria-label="Dismiss getting started"
          title="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: '0.25rem', display: 'flex', flexShrink: 0 }}
        >
          <X size={17} strokeWidth={1.7} />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <WalkCard t={t} icon={Mail} title="Set up your email" subtitle="Connect Gmail and add the widget" complete={emailComplete}>
          <Step t={t} done={gmailConnected} label="Connect your Gmail account"
            actionLabel="Show me" onAction={() => guide('apps', 'apps')} />
          <Step t={t} done={emailsWidgetAdded} label="On Home, click Edit → Add widget → “Recent emails”"
            actionLabel="Show me" onAction={() => guide('home-edit', 'home')} />
        </WalkCard>

        <WalkCard t={t} icon={FolderTree} title="Organize with topics" subtitle="Create a topic inside a folder" complete={topicsComplete}>
          <Step t={t} done={topicAdded} label="Create your first topic"
            actionLabel="Show me" onAction={() => guide('edit-nav')} />
          <Step t={t} done={topicInFolder} label="Put a topic into a new folder"
            actionLabel="Show me" onAction={() => guide('edit-nav')} />
        </WalkCard>
      </div>
    </div>
  );
}
