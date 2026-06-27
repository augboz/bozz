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
  const BAR_H = 56;
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
        background:'rgba(10,10,16,0.94)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
        borderBottom:'1px solid rgba(255,255,255,0.08)',
        display:'flex', alignItems:'center', padding:'0.5rem 1.25rem', gap:'1rem',
      }}>
        <span style={{ fontSize:'0.68rem', color:accent, flexShrink:0, fontVariantNumeric:'tabular-nums', fontWeight:600 }}>
          {step + 1} / {total}
        </span>
        <span style={{ flex:1, fontSize:'0.84rem', color:'rgba(255,255,255,0.92)', lineHeight:1.35 }}>
          {tip}
        </span>
        <button onClick={onExit} style={{
          flexShrink:0, background:'transparent', border:'1px solid rgba(255,255,255,0.18)', borderRadius:'8px',
          padding:'0.3rem 0.75rem', color:'rgba(255,255,255,0.65)', fontSize:'0.73rem', fontFamily:'inherit',
          cursor:'pointer', display:'flex', alignItems:'center', gap:'0.35rem',
        }}>
          <X size={12} strokeWidth={1.7} /> Exit
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
  { targets:['edit-nav'],         tip:'Step 1. A "topic" is an area of your life, like Uni, Work, or your CV. Click the highlighted "Edit" in your sidebar to start adding one.', advance:c => c.sidebarEditing || c.domHas('nav-add-menu') },
  { targets:['nav-add-menu'],     tip:'Step 2. Click the "+" to add something to your sidebar.', advance:c => c.domHas('nav-new-topic') },
  { targets:['nav-new-topic'],    tip:'Step 3. Choose "New topic".', advance:c => c.domHas('topic-name-input') },
  { targets:['topic-modal'],      tip:'Step 4. Name your topic (for example "Uni"), then tap the icon and the colour to make it yours.', advance:c => c.iconCustomised || !c.domHas('topic-modal'), autoMs:30000 },
  { targets:['topic-modal'],      tip:'Step 5. Set up the stages your to-dos move through, like To do, Doing, Done. Rename, reorder, or add your own.', advance:c => c.stagesCustomised || !c.domHas('topic-modal'), autoMs:20000 },
  { targets:['topic-modal-done'], tip:'Step 6. Happy with it? Click "Done". That is your first topic made.', advance:c => !c.domHas('topic-modal') },
  { targets:['topic-row-edit'],   tip:'Step 7. To edit a topic later, click its pencil in the sidebar. Try it on the topic you just made.', advance:c => c.domHas('topic-modal') },
  { targets:['topic-modal'],      tip:'Step 8. This is the edit card. Change anything you like in here, then click "Done" to come back.', advance:c => !c.domHas('topic-modal') },
  { targets:['topic-row-hide','topic-row-drag','edit-nav'], tip:'Step 9. The eye hides or shows a topic, and the handle lets you drag to reorder them. When you are finished, click "Done" to leave edit mode.', advance:c => !c.sidebarEditing },
];

const TOPICPAGE_STEPS: WalkStep[] = [
  { targets:['topic-nav-item'],                          tip:'Step 1. Open your topic from the sidebar to set up its page.', advance:c => c.currentTopicId != null },
  { targets:['topic-edit'],                              tip:'Step 2. Click the highlighted "Edit" to customise this page.', advance:c => c.domHas('topic-add-widget') },
  { targets:['topic-add-widget','topic-widget-options','topic-add-widget-close'], tip:'Step 3. Click "Add widget" and pick anything you want: tasks, a calendar, notes, music and more. Add as many as you like, then close the picker (the X) when you are done.', advance:c => c.topicWidgetTypes.length > 0 && !c.domHas('topic-add-widget-close') },
];

const CONNECT_STEPS: WalkStep[] = [
  { targets:['apps'],       tip:'Step 1. Email and calendar widgets need an account connected. Open the "Apps" page.', advance:c => c.section === 'apps' },
  { targets:['gmail-card'], tip:'Step 2. Click "Connect" on Gmail to link your inbox. Other providers are just below it.', advance:c => c.emailConnected },
];

const QUICKS_STEPS: WalkStep[] = [
  { targets:['quick-add'],       tip:'Step 1. "Quicks" capture any thought instantly. Click "Quick add", or press Ctrl+B.', advance:c => c.domHas('quick-add-modal') },
  { targets:['quick-add-modal'], tip:'Step 2. Type anything here and add it. It lands in your Quicks to sort later. Take your time.', advance:c => !c.domHas('quick-add-modal') },
  { targets:['nav-quicks'],      tip:'Step 3. Open "Quicks" to see everything you have captured.', advance:c => c.section === 'inbox' },
  { targets:['inbox-row'],       tip:'Step 4. For each quick you can edit the text, pick which topic it belongs to, and set a date if needed, then send it. That is the whole loop: capture now, sort later.', advance:c => !c.domHas('inbox-row') },
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
  return (
    <div style={{
      flex:'1 1 230px', minWidth:0,
      border:`1px solid ${t.border}`, borderRadius:'14px', padding:'0.9rem 1rem',
      background:t.bgAlt, display:'flex', flexDirection:'column',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.55rem', marginBottom:'0.5rem' }}>
        <div style={{ width:30, height:30, borderRadius:'9px', flexShrink:0, background:t.input, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={15} strokeWidth={1.7} color={t.textMuted} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:'0.7rem', color:t.textDim, fontWeight:600, letterSpacing:'0.04em' }}>WALKTHROUGH {num}</div>
          <div style={{ fontSize:'0.88rem', fontWeight:600, color:t.text }}>{title}</div>
        </div>
      </div>
      <div style={{ fontSize:'0.74rem', color:t.textMuted, lineHeight:1.45, flex:1, marginBottom:'0.7rem' }}>{subtitle}</div>
      <button onClick={onStart} style={{
        alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:'0.3rem',
        background:'transparent', border:`1px solid ${t.borderStrong}`, borderRadius:'8px',
        padding:'0.3rem 0.75rem', color:t.text, fontSize:'0.75rem', fontFamily:'inherit', cursor:'pointer',
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
}

export default function Onboarding({
  t, activeSection, currentTopicId, sidebarEditing,
  topicCount, topicWidgetTypes, inboxCount, emailConnected, iconCustomised, stagesCustomised,
  onDismiss, onWalkStart, onWalkEnd,
}: OnboardingProps) {
  const [walkState, setWalkState] = useState<WalkState | null>(null);

  const startWalk = (flow: Flow) => { setWalkState({ flow, step: 0 }); onWalkStart(); };
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
          border:`1px solid ${t.border}`, borderRadius:'16px',
          padding:'1.1rem 1.2rem', marginBottom:'1.5rem', background:t.panel ?? t.bg,
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'0.9rem' }}>
            <div>
              <div style={{ fontSize:'1rem', fontWeight:700, color:t.text }}>Getting started</div>
              <div style={{ fontSize:'0.76rem', color:t.textMuted, marginTop:'0.15rem' }}>
                Four short walkthroughs set Bozz up around your life. Do them in order. Each one guides you click by click, and you can re-run any of them any time.
              </div>
            </div>
            <button onClick={() => { onWalkEnd(); onDismiss(); }} aria-label="Dismiss getting started"
              style={{ background:'none', border:'none', cursor:'pointer', color:t.textMuted, padding:'0.25rem', display:'flex', flexShrink:0 }}>
              <X size={17} strokeWidth={1.7} />
            </button>
          </div>

          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.7rem' }}>
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
