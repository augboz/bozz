/**
 * Onboarding — guided "getting started" walkthroughs.
 *
 * Two flows: "Set up your email" and "Organise with topics". Each flow dims
 * the entire app and spotlights only the specific UI element the user needs
 * to interact with next, then auto-advances once the action is detected.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Mail, FolderTree, X } from 'lucide-react';
import type { SectionId, Theme } from '../../lib/types';

// ── Spotlight overlay (4-panel dim + pulsing ring + bottom bar) ───────────────

interface SpotlightProps {
  rects: DOMRect[];
  tip: string;
  step: number;
  total: number;
  accent: string;
  onExit: () => void;
}

function SpotlightOverlay({ rects, tip, step, total, accent, onExit }: SpotlightProps) {
  if (rects.length === 0) return null;

  const PAD = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const BAR_H = 52;

  const minX = Math.max(0, Math.min(...rects.map(r => r.left)) - PAD);
  // Keep hole below the top instruction bar so it's never hidden under it
  const minY = Math.max(BAR_H + 4, Math.min(...rects.map(r => r.top)) - PAD);
  const maxX = Math.min(vw, Math.max(...rects.map(r => r.right)) + PAD);
  const maxY = Math.min(vh, Math.max(...rects.map(r => r.bottom)) + PAD);

  const DIM = 'rgba(0,0,0,0.62)';

  return createPortal(
    <>
      {/* 4 panels that dim everything outside the spotlight hole.
          The top panel goes from 0→minY (the instruction bar at z-index 9992
          sits on top of it and is always visible). */}
      <div style={{ position:'fixed', zIndex:9990, pointerEvents:'all', top:0, left:0, right:0, height:minY, background:DIM }} />
      <div style={{ position:'fixed', zIndex:9990, pointerEvents:'all', top:maxY, left:0, right:0, bottom:0, background:DIM }} />
      <div style={{ position:'fixed', zIndex:9990, pointerEvents:'all', top:minY, bottom:vh-maxY, left:0, width:minX, background:DIM }} />
      <div style={{ position:'fixed', zIndex:9990, pointerEvents:'all', top:minY, bottom:vh-maxY, left:maxX, right:0, background:DIM }} />

      {/* Pulsing highlight ring around the hole */}
      <div style={{
        position:'fixed', zIndex:9991, pointerEvents:'none',
        left:minX, top:minY, width:maxX-minX, height:maxY-minY,
        borderRadius:12, border:`2px solid ${accent}`,
        animation:'spotPulse 1.4s ease-in-out infinite',
      }} />

      {/* Top bar: step counter + instruction + exit */}
      <div style={{
        position:'fixed', zIndex:9992, pointerEvents:'all',
        left:0, right:0, top:0, height:BAR_H,
        background:'rgba(10,10,16,0.92)',
        backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
        borderBottom:'1px solid rgba(255,255,255,0.08)',
        display:'flex', alignItems:'center', padding:'0 1.25rem', gap:'1rem',
      }}>
        <span style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.4)', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>
          {step + 1} / {total}
        </span>
        <span style={{ flex:1, fontSize:'0.82rem', color:'rgba(255,255,255,0.88)', lineHeight:1.3 }}>
          {tip}
        </span>
        <button
          onClick={onExit}
          style={{
            flexShrink:0, background:'transparent',
            border:'1px solid rgba(255,255,255,0.18)', borderRadius:'8px',
            padding:'0.3rem 0.75rem', color:'rgba(255,255,255,0.65)',
            fontSize:'0.73rem', fontFamily:'inherit', cursor:'pointer',
            display:'flex', alignItems:'center', gap:'0.35rem',
          }}
        >
          <X size={12} strokeWidth={1.7} /> Exit walkthrough
        </button>
      </div>

      <style>{`@keyframes spotPulse {
        0%,100% { box-shadow: 0 0 0 4px ${accent}33; }
        50%      { box-shadow: 0 0 0 10px ${accent}00; }
      }`}</style>
    </>,
    document.body,
  );
}

// ── Step definitions ──────────────────────────────────────────────────────────

interface StepCtx {
  section: string;
  gmailConnected: boolean;
  emailsWidgetAdded: boolean;
  topicAdded: boolean;
  folderCreated: boolean;
  topicInFolder: boolean;
  domHas: (id: string) => boolean;
}

interface WalkStep {
  targets: string[];
  tip: string;
  advance: (ctx: StepCtx) => boolean;
}

const EMAIL_STEPS: WalkStep[] = [
  {
    targets: ['apps'],
    tip: 'Click Apps to open the connected accounts page.',
    advance: (ctx) => ctx.section === 'apps',
  },
  {
    targets: ['gmail-card', 'imap-card'],
    tip: 'Connect your Gmail account — or connect another email account below it.',
    advance: (ctx) => ctx.gmailConnected,
  },
  {
    targets: ['nav-home'],
    tip: 'Head back to Home.',
    advance: (ctx) => ctx.section === 'home',
  },
  {
    targets: ['home-edit'],
    tip: 'Click Edit to enter widget edit mode.',
    advance: (ctx) => ctx.domHas('add-widget'),
  },
  {
    targets: ['add-widget'],
    tip: 'Click "Add widget" to open the widget picker.',
    advance: (ctx) => ctx.domHas('recent-emails-option'),
  },
  {
    targets: ['recent-emails-option'],
    tip: 'Add the "Recent emails" widget to your home screen.',
    advance: (ctx) => ctx.emailsWidgetAdded,
  },
];

const TOPICS_STEPS: WalkStep[] = [
  {
    targets: ['nav-settings'],
    tip: 'Click Settings to manage your topics and folders.',
    advance: (ctx) => ctx.section === 'settings',
  },
  {
    targets: ['add-topic'],
    tip: 'Click "Add topic" to create your first topic.',
    advance: (ctx) => ctx.topicAdded,
  },
  {
    targets: ['add-folder'],
    tip: 'Click "New folder" to create a folder for your topics.',
    advance: (ctx) => ctx.folderCreated,
  },
  {
    targets: ['edit-nav'],
    tip: 'Click Edit in the sidebar, then drag your topic into a folder.',
    advance: (ctx) => ctx.topicInFolder,
  },
];

// ── Walk engine hook ──────────────────────────────────────────────────────────

interface WalkState {
  flow: 'email' | 'topics';
  step: number;
}

function useWalkEngine(
  walkState: WalkState | null,
  ctx: Omit<StepCtx, 'domHas'>,
  onAdvance: () => void,
  onComplete: () => void,
) {
  const steps = walkState?.flow === 'email' ? EMAIL_STEPS : TOPICS_STEPS;
  const step = walkState ? steps[walkState.step] ?? null : null;
  const total = steps.length;

  // Throttle callbacks to fire once per activation
  const firedRef = useRef(false);
  useEffect(() => { firedRef.current = false; }, [walkState?.step, walkState?.flow]);

  // Poll advance condition every 250 ms
  useEffect(() => {
    if (!step || !walkState) return;
    const fullCtx: StepCtx = {
      ...ctx,
      domHas: (id) => document.querySelector(`[data-onb="${id}"]`) !== null,
    };
    const id = window.setInterval(() => {
      if (firedRef.current) return;
      if (step.advance(fullCtx)) {
        firedRef.current = true;
        if (walkState.step >= total - 1) onComplete();
        else onAdvance();
      }
    }, 250);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, walkState?.step, walkState?.flow,
      ctx.section, ctx.gmailConnected, ctx.emailsWidgetAdded,
      ctx.topicAdded, ctx.folderCreated, ctx.topicInFolder]);

  // Measure target rects, re-poll on resize/scroll
  const [rects, setRects] = useState<DOMRect[]>([]);
  useEffect(() => {
    if (!step) { setRects([]); return; }
    const update = () => {
      const found = step.targets
        .flatMap(id => Array.from(document.querySelectorAll(`[data-onb="${id}"]`)))
        .map(el => el.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0);
      setRects(found);
    };
    update();
    const tid = window.setInterval(update, 200);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearInterval(tid);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step]);

  // Scroll first target into view when step activates
  useEffect(() => {
    if (!step) return;
    const tid = window.setTimeout(() => {
      const el = document.querySelector(`[data-onb="${step.targets[0]}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 120);
    return () => window.clearTimeout(tid);
  }, [step]);

  return { step, rects, total };
}

// ── Walk entry card ───────────────────────────────────────────────────────────

function WalkCard({ t, icon: Icon, title, subtitle, complete, replay, onStart }: {
  t: Theme; icon: React.ElementType; title: string; subtitle: string;
  complete: boolean; replay?: boolean; onStart: () => void;
}) {
  return (
    <div style={{
      flex:'1 1 240px', minWidth:0,
      border:`1px solid ${complete && !replay ? t.doneAccent + '55' : t.border}`,
      borderRadius:'14px', padding:'1rem 1.1rem', background:t.bgAlt,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.65rem' }}>
        <div style={{
          width:32, height:32, borderRadius:'9px', flexShrink:0,
          background: complete && !replay ? t.doneAccent + '22' : t.input,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {complete && !replay
            ? <Check size={16} strokeWidth={2.4} color={t.doneAccent} />
            : <Icon size={16} strokeWidth={1.7} color={t.textMuted} />}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:'0.88rem', fontWeight:600, color:t.text }}>{title}</div>
          <div style={{ fontSize:'0.72rem', color:t.textMuted }}>
            {complete && !replay ? 'All done — nice!' : subtitle}
          </div>
        </div>
      </div>
      {(!complete || replay) && (
        <button
          onClick={onStart}
          style={{
            display:'inline-flex', alignItems:'center', gap:'0.3rem',
            background:'transparent', border:`1px solid ${t.borderStrong}`,
            borderRadius:'8px', padding:'0.3rem 0.75rem',
            color:t.text, fontSize:'0.75rem',
            fontFamily:'inherit', cursor:'pointer',
          }}
        >
          Start walkthrough →
        </button>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface OnboardingProps {
  t: Theme;
  replay?: boolean;
  activeSection: string;
  gmailConnected: boolean;
  emailsWidgetAdded: boolean;
  topicAdded: boolean;
  folderCreated: boolean;
  topicInFolder: boolean;
  onGo: (section: SectionId) => void;
  onDismiss: () => void;
  onWalkStart: () => void;
  onWalkEnd: () => void;
}

export default function Onboarding({
  t, replay = false, activeSection,
  gmailConnected, emailsWidgetAdded, topicAdded, folderCreated, topicInFolder,
  onDismiss, onWalkStart, onWalkEnd,
}: OnboardingProps) {
  const [walkState, setWalkState] = useState<WalkState | null>(null);

  const startWalk = (flow: 'email' | 'topics') => {
    setWalkState({ flow, step: 0 });
    onWalkStart();
  };

  const exitWalk = () => {
    setWalkState(null);
    onWalkEnd();
  };

  const ctx = { section: activeSection, gmailConnected, emailsWidgetAdded, topicAdded, folderCreated, topicInFolder };

  const { step, rects, total } = useWalkEngine(
    walkState,
    ctx,
    () => setWalkState(prev => prev ? { ...prev, step: prev.step + 1 } : null),
    () => { setWalkState(null); onWalkEnd(); },
  );

  const emailComplete = gmailConnected && emailsWidgetAdded;
  const topicsComplete = topicAdded && topicInFolder;

  return (
    <>
      {/* Getting-started card — only on home, only when no walk is active */}
      {activeSection === 'home' && !walkState && (
        <div style={{
          border:`1px solid ${t.border}`, borderRadius:'16px',
          padding:'1.1rem 1.2rem', marginBottom:'1.5rem', background:t.panel ?? t.bg,
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.9rem' }}>
            <div>
              <div style={{ fontSize:'0.98rem', fontWeight:700, color:t.text }}>Getting started</div>
              <div style={{ fontSize:'0.76rem', color:t.textMuted, marginTop:'0.1rem' }}>
                Two quick walkthroughs — click Start and Bozz will guide you step by step.
              </div>
            </div>
            <button
              onClick={() => { onWalkEnd(); onDismiss(); }}
              aria-label="Dismiss getting started"
              style={{ background:'none', border:'none', cursor:'pointer', color:t.textMuted, padding:'0.25rem', display:'flex', flexShrink:0 }}
            >
              <X size={17} strokeWidth={1.7} />
            </button>
          </div>

          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.75rem' }}>
            <WalkCard
              t={t} icon={Mail}
              title="Set up your email"
              subtitle="Connect Gmail and add the emails widget"
              complete={emailComplete} replay={replay}
              onStart={() => startWalk('email')}
            />
            <WalkCard
              t={t} icon={FolderTree}
              title="Organise with topics"
              subtitle="Create a topic and put it in a folder"
              complete={topicsComplete} replay={replay}
              onStart={() => startWalk('topics')}
            />
          </div>
        </div>
      )}

      {/* Spotlight — active throughout the walk, survives section navigation */}
      {walkState && step && (
        <SpotlightOverlay
          rects={rects}
          tip={step.tip}
          step={walkState.step}
          total={total}
          accent={t.doneAccent}
          onExit={exitWalk}
        />
      )}
    </>
  );
}
