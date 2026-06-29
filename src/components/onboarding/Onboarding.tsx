/**
 * Onboarding - guided "getting started" walkthroughs.
 *
 * Four flows. Each dims the app and spotlights the exact control to use next,
 * and advances when you actually do the thing (pick an icon, edit a stage,
 * connect an account, close a picker...). A couple of pure-explanation steps
 * fall back to a generous timer. No "Next" button, and no "completed" state, so
 * every walkthrough can be re-run as many times as you like.
 *   1. sidebar   - edit the sidebar, add & customise a topic, learn row controls
 *   2. topicPage - add the widgets you want on that topic's page
 *   3. connect   - connect an email account
 *   4. quicks    - capture a thought and triage it
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ListTree, LayoutGrid, Plug, Zap, X } from 'lucide-react';
import type { Theme } from '../../lib/types';

// ── Spotlight overlay (dim + ring + instruction bar) ──────────────────────────

interface SpotlightProps {
  rects: DOMRect[];
  tip: string;
  step: number;
  total: number;
  accent: string;
  onExit: () => void;
}

function SpotlightOverlay({ rects, tip, step, total, accent, onExit }: SpotlightProps) {
  const BAR_H = 72;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const hasHole = rects.length > 0;
  const PAD = 10;
  const minX = hasHole ? Math.max(0, Math.min(...rects.map(r => r.left)) - PAD) : 0;
  const minY = hasHole ? Math.max(BAR_H + 6, Math.min(...rects.map(r => r.top)) - PAD) : 0;
  const maxX = hasHole ? Math.min(vw, Math.max(...rects.map(r => r.right)) + PAD) : 0;
  const maxY = hasHole ? Math.min(vh, Math.max(...rects.map(r => r.bottom)) + PAD) : 0;

  const DIM = 'rgba(0,0,0,0.62)';

  return createPortal(
    <>
      {hasHole ? (
        <>
          {/* Dim panels leave the spotlighted element clickable (the hole). */}
          <div style={{ position:'fixed', zIndex:9990, top:0, left:0, right:0, height:minY, background:DIM }} />
          <div style={{ position:'fixed', zIndex:9990, top:maxY, left:0, right:0, bottom:0, background:DIM }} />
          <div style={{ position:'fixed', zIndex:9990, top:minY, bottom:vh-maxY, left:0, width:minX, background:DIM }} />
          <div style={{ position:'fixed', zIndex:9990, top:minY, bottom:vh-maxY, left:maxX, right:0, background:DIM }} />
          <div style={{
            position:'fixed', zIndex:9991, pointerEvents:'none',
            left:minX, top:minY, width:maxX-minX, height:maxY-minY,
            borderRadius:12, border:`2px solid ${accent}`,
            animation:'spotPulse 1.4s ease-in-out infinite',
          }} />
        </>
      ) : (
        <div style={{ position:'fixed', zIndex:9990, inset:0, background:DIM }} />
      )}

      <div style={{
        position:'fixed', zIndex:9992, left:0, right:0, top:0, minHeight:BAR_H,
        background:'rgba(10,10,16,0.94)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
        borderBottom:'1px solid rgba(255,255,255,0.08)',
        display:'flex', alignItems:'center', padding:'0.85rem 1.5rem', gap:'1.1rem',
      }}>
        <span style={{
          flexShrink:0, fontSize:'0.78rem', fontWeight:700, color:accent,
          fontVariantNumeric:'tabular-nums',
          background:accent + '1f', border:`1px solid ${accent}55`, borderRadius:'999px',
          padding:'0.25rem 0.7rem',
        }}>
          {step + 1} / {total}
        </span>
        <span style={{ flex:1, fontSize:'1.02rem', fontWeight:450, color:'rgba(255,255,255,0.95)', lineHeight:1.5 }}>
          {tip}
        </span>
        <button onClick={onExit} style={{
          flexShrink:0, background:'transparent', border:'1px solid rgba(255,255,255,0.22)', borderRadius:'10px',
          padding:'0.45rem 0.95rem', color:'rgba(255,255,255,0.78)', fontSize:'0.86rem', fontFamily:'inherit',
          cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem',
        }}>
          <X size={15} strokeWidth={1.8} /> Exit
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

// ── Step model ────────────────────────────────────────────────────────────────

export type Flow = 'sidebar' | 'topicPage' | 'connect' | 'quicks';

interface StepCtx {
  section: string;
  currentTopicId: string | null;
  sidebarEditing: boolean;
  topicCount: number;
  topicWidgetTypes: string[];
  inboxCount: number;
  emailConnected: boolean;
  iconCustomised: boolean;
  stagesCustomised: boolean;
  domHas: (id: string) => boolean;
}

interface WalkStep {
  targets: string[];
  tip: string;
  advance: (ctx: StepCtx) => boolean;
  autoMs?: number; // generous fallback for optional / explanation-only steps
}

const SIDEBAR_STEPS: WalkStep[] = [
  { targets:['edit-nav'],      tip:'A topic is an area of your life, like Uni, Work or the gym. Click Edit to start.', advance:c => c.sidebarEditing || c.domHas('nav-add-menu') },
  { targets:['nav-add-menu'],  tip:'Click + to add to your sidebar.', advance:c => c.domHas('nav-new-topic') },
  { targets:['nav-new-topic'], tip:'Choose New topic.', advance:c => c.domHas('topic-name-input') },
  { targets:['topic-modal'],   tip:'Name it, pick an icon and colour, set your stages, then click Done.', advance:c => !c.domHas('topic-modal') },
  { targets:['topic-row-edit'],tip:'To change a topic later, click its pencil.', advance:c => c.domHas('topic-modal') },
  { targets:['topic-modal'],   tip:'Change anything here, then click Done.', advance:c => !c.domHas('topic-modal') },
  { targets:['sidebar-nav'],   tip:'Use 👁 to hide a topic and ⠿ to drag it. Click Done when you are finished.', advance:c => !c.sidebarEditing },
];

const TOPICPAGE_STEPS: WalkStep[] = [
  { targets:['topic-nav-item'],   tip:'Open your topic from the sidebar.', advance:c => c.currentTopicId != null },
  { targets:['topic-edit'],       tip:'Click Edit to customise this page.', advance:c => c.domHas('topic-add-widget') },
  { targets:['topic-add-widget'], tip:'Click Add widget and pick what you want. Add as many as you like.', advance:c => c.topicWidgetTypes.length > 0 },
];

const CONNECT_STEPS: WalkStep[] = [
  { targets:['apps'],       tip:'Step 1. Email and calendar widgets need an account connected. Open the "Apps" page.', advance:c => c.section === 'apps' },
  { targets:['gmail-card'], tip:'Step 2. Click "Connect" on Gmail to link your inbox. Other providers are just below it.', advance:c => c.emailConnected },
];

const QUICKS_STEPS: WalkStep[] = [
  { targets:['quick-add'],       tip:'Quicks capture any thought fast. Click Quick add, or press Ctrl+B from anywhere.', advance:c => c.domHas('quick-add-modal') },
  { targets:['quick-add-modal'], tip:'Type anything and add it. Take your time.', advance:c => !c.domHas('quick-add-modal') },
  { targets:['nav-quicks'],      tip:'Open Quicks to see what you captured.', advance:c => c.section === 'inbox' },
  { targets:['inbox-row'],       tip:'Edit it, pick a topic, add a date, then send it. Capture now, sort later.', advance:c => !c.domHas('inbox-row') },
];

const FLOW_STEPS: Record<Flow, WalkStep[]> = {
  sidebar: SIDEBAR_STEPS, topicPage: TOPICPAGE_STEPS, connect: CONNECT_STEPS, quicks: QUICKS_STEPS,
};

// ── Walk engine ────────────────────────────────────────────────────────────────

interface WalkState { flow: Flow; step: number }

function useWalkEngine(
  walkState: WalkState | null,
  ctx: Omit<StepCtx, 'domHas'>,
  onAdvance: () => void,
  onComplete: () => void,
) {
  const steps = walkState ? FLOW_STEPS[walkState.flow] : [];
  const step = walkState ? steps[walkState.step] ?? null : null;
  const total = steps.length;

  const firedRef = useRef(false);
  useEffect(() => { firedRef.current = false; }, [walkState?.step, walkState?.flow]);

  const fire = useRef(() => {});
  fire.current = () => {
    if (firedRef.current || !walkState) return;
    firedRef.current = true;
    if (walkState.step >= total - 1) onComplete();
    else onAdvance();
  };

  // Flag the body so first-hover hints don't clash with the spotlight.
  useEffect(() => {
    if (walkState) document.body.dataset.walkActive = '1';
    else delete document.body.dataset.walkActive;
    return () => { delete document.body.dataset.walkActive; };
  }, [walkState]);

  // Poll the action condition.
  useEffect(() => {
    if (!step || !walkState) return;
    const fullCtx: StepCtx = { ...ctx, domHas: (id) => document.querySelector(`[data-onb="${id}"]`) !== null };
    const id = window.setInterval(() => { if (!firedRef.current && step.advance(fullCtx)) fire.current(); }, 250);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, walkState?.step, walkState?.flow,
      ctx.section, ctx.currentTopicId, ctx.sidebarEditing, ctx.topicCount,
      ctx.inboxCount, ctx.emailConnected, ctx.iconCustomised, ctx.stagesCustomised, ctx.topicWidgetTypes.length]);

  // Generous fallback timer (only on steps that opt in via autoMs).
  useEffect(() => {
    if (!step || step.autoMs == null) return;
    const id = window.setTimeout(() => fire.current(), step.autoMs);
    return () => window.clearTimeout(id);
  }, [step, walkState?.step, walkState?.flow]);

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
    return () => { window.clearInterval(tid); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [step]);

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

// ── Walk entry card (always re-runnable, no "done" state) ─────────────────────

function WalkCard({ t, icon: Icon, num, title, subtitle, onStart }: {
  t: Theme; icon: React.ElementType; num: number; title: string; subtitle: string; onStart: () => void;
}) {
  const accent = t.doneAccent;
  return (
    <div style={{
      flex:'1 1 240px', minWidth:0,
      border:`1px solid ${t.border}`, borderRadius:'18px', padding:'1.25rem 1.35rem',
      background:t.bgAlt, display:'flex', flexDirection:'column',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.7rem', marginBottom:'0.85rem' }}>
        <div style={{ width:42, height:42, borderRadius:'12px', flexShrink:0, background:accent + '1f', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={21} strokeWidth={1.8} color={accent} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:'0.72rem', color:t.textDim, fontWeight:700, letterSpacing:'0.07em' }}>WALKTHROUGH {num}</div>
          <div style={{ fontSize:'1.12rem', fontWeight:650, color:t.text, letterSpacing:'-0.01em' }}>{title}</div>
        </div>
      </div>
      <div style={{ fontSize:'0.92rem', color:t.textMuted, lineHeight:1.55, flex:1, marginBottom:'1.1rem' }}>{subtitle}</div>
      <button onClick={onStart} style={{
        alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:'0.4rem',
        background:accent, border:'none', borderRadius:'10px',
        padding:'0.55rem 1.15rem', color:'#fff', fontSize:'0.92rem', fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      }}>
        Start
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface OnboardingProps {
  t: Theme;
  activeSection: string;
  currentTopicId: string | null;
  sidebarEditing: boolean;
  topicCount: number;
  topicWidgetTypes: string[];
  inboxCount: number;
  emailConnected: boolean;
  iconCustomised: boolean;
  stagesCustomised: boolean;
  onDismiss: () => void;
  onWalkStart: () => void;
  onWalkEnd: () => void;
  /** Leave sidebar edit mode (used when a non-sidebar walkthrough starts). */
  onExitSidebarEdit: () => void;
}

export default function Onboarding({
  t, activeSection, currentTopicId, sidebarEditing,
  topicCount, topicWidgetTypes, inboxCount, emailConnected, iconCustomised, stagesCustomised,
  onDismiss, onWalkStart, onWalkEnd, onExitSidebarEdit,
}: OnboardingProps) {
  const [walkState, setWalkState] = useState<WalkState | null>(null);

  const startWalk = (flow: Flow) => {
    // The topic-page walkthrough drives the topic page, not the sidebar — if the
    // user left the sidebar in edit mode, drop out of it so the steps line up.
    if (flow !== 'sidebar') onExitSidebarEdit();
    setWalkState({ flow, step: 0 });
    onWalkStart();
  };
  const exitWalk = () => { setWalkState(null); onWalkEnd(); };

  const ctx = { section: activeSection, currentTopicId, sidebarEditing, topicCount, topicWidgetTypes, inboxCount, emailConnected, iconCustomised, stagesCustomised };

  const { step, rects, total } = useWalkEngine(
    walkState,
    ctx,
    () => setWalkState(prev => prev ? { ...prev, step: prev.step + 1 } : null),
    exitWalk,
  );

  return (
    <>
      {activeSection === 'home' && !walkState && (
        <div style={{
          border:`1px solid ${t.border}`, borderRadius:'20px',
          padding:'1.5rem 1.6rem', marginBottom:'1.5rem', background:t.panel ?? t.bg,
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', marginBottom:'1.25rem' }}>
            <div>
              <h2 style={{ margin:0, fontSize:'1.4rem', fontWeight:750, color:t.text, letterSpacing:'-0.02em' }}>Getting started</h2>
              <div style={{ fontSize:'0.95rem', color:t.textMuted, marginTop:'0.35rem', lineHeight:1.5, maxWidth:'52ch' }}>
                Four short walkthroughs set Bozz up around your life. Do them in order. Each one guides you click by click, and you can re-run any of them any time.
              </div>
            </div>
            <button onClick={() => { onWalkEnd(); onDismiss(); }} aria-label="Dismiss getting started"
              style={{ background:'none', border:'none', cursor:'pointer', color:t.textMuted, padding:'0.25rem', display:'flex', flexShrink:0 }}>
              <X size={20} strokeWidth={1.7} />
            </button>
          </div>

          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.9rem' }}>
            <WalkCard t={t} icon={ListTree}   num={1} title="Sidebar & topics"  subtitle="Make your sidebar yours: add a topic (Uni, Work, CV), give it an icon, colour and stages, then learn how to edit, hide and reorder topics and folders." onStart={() => startWalk('sidebar')} />
            <WalkCard t={t} icon={LayoutGrid} num={2} title="Build a topic page" subtitle="Open a topic and pick the widgets you want on its page: tasks, calendar, notes, music and more." onStart={() => startWalk('topicPage')} />
            <WalkCard t={t} icon={Plug}       num={3} title="Connect your apps"  subtitle="Hook up an email account so your inbox and calendar widgets can show your data." onStart={() => startWalk('connect')} />
            <WalkCard t={t} icon={Zap}        num={4} title="Quicks"             subtitle="Capture any thought in a flash, then sort it into a topic (with a date) later." onStart={() => startWalk('quicks')} />
          </div>
        </div>
      )}

      {walkState && step && (
        <SpotlightOverlay rects={rects} tip={step.tip} step={walkState.step} total={total} accent={t.doneAccent} onExit={exitWalk} />
      )}
    </>
  );
}
