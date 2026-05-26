import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer } from 'lucide-react';
import { Widget, WidgetHeader } from '../shared/Widget';
import type { WidgetCtx } from './context';

type Mode = 'work' | 'short' | 'long';

const DURATIONS: Record<Mode, number> = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
const MODE_LABEL: Record<Mode, string> = { work: 'Focus', short: 'Short', long: 'Long' };
const ACCENT = '#c9a8d4';

function fmt(secs: number): string {
  return `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
}

export default function PomodoroWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t } = ctx;
  const [mode, setMode] = useState<Mode>('work');
  const [remaining, setRemaining] = useState<number>(DURATIONS.work);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);

  // Refs so interval callbacks always see fresh values
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef<Mode>('work');
  const completedRef = useRef(0);
  modeRef.current = mode;
  completedRef.current = completed;

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => clearTick, [clearTick]);

  const startTick = useCallback(() => {
    clearTick();
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearTick();
          // Defer mode-transition state updates out of the updater function
          Promise.resolve().then(() => {
            setRunning(false);
            const m = modeRef.current;
            const c = completedRef.current;
            if (m === 'work') {
              const nc = c + 1;
              setCompleted(nc);
              const nextMode: Mode = nc % 4 === 0 ? 'long' : 'short';
              setMode(nextMode);
              setRemaining(DURATIONS[nextMode]);
            } else {
              setMode('work');
              setRemaining(DURATIONS.work);
            }
          });
          return 0;
        }
        return next;
      });
    }, 1000);
  }, [clearTick]);

  const toggle = () => {
    if (running) {
      clearTick();
      setRunning(false);
    } else {
      startTick();
      setRunning(true);
    }
  };

  const switchMode = (m: Mode) => {
    clearTick();
    setMode(m);
    setRemaining(DURATIONS[m]);
    setRunning(false);
  };

  const reset = () => {
    clearTick();
    setRemaining(DURATIONS[modeRef.current]);
    setRunning(false);
  };

  const total = DURATIONS[mode];
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;

  const btnBase: React.CSSProperties = {
    background: 'transparent',
    border: `1px solid ${t.border}`,
    borderRadius: '7px',
    padding: '0.3rem 0.7rem',
    color: t.textMuted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.72rem',
  };

  return (
    <Widget t={t} accent={ACCENT}>
      <WidgetHeader label="Pomodoro" accent={ACCENT} t={t} icon={Timer} />

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.85rem' }}>
        {(['work', 'short', 'long'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            style={{
              ...btnBase,
              padding: '0.25rem 0.6rem',
              borderColor: mode === m ? ACCENT : t.border,
              color: mode === m ? ACCENT : t.textMuted,
            }}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {/* Timer display */}
      <div style={{
        textAlign: 'center',
        marginTop: '0.9rem',
        fontSize: '2.5rem',
        fontWeight: 200,
        color: t.text,
        letterSpacing: '0.04em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fmt(remaining)}
      </div>

      {/* Progress bar */}
      <div style={{
        height: '3px',
        background: t.bgAlt,
        borderRadius: '999px',
        overflow: 'hidden',
        marginTop: '0.7rem',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: ACCENT,
          transition: running ? 'width 1s linear' : 'none',
        }} />
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.6rem',
        marginTop: '0.85rem',
      }}>
        <button
          onClick={toggle}
          style={{ ...btnBase, borderColor: ACCENT, color: ACCENT, padding: '0.35rem 1.2rem' }}
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={reset} style={btnBase}>Reset</button>
      </div>

      {/* Session count */}
      {completed > 0 && (
        <div style={{
          textAlign: 'center',
          marginTop: '0.65rem',
          fontSize: '0.67rem',
          color: t.textDim,
        }}>
          {completed} {completed === 1 ? 'pomodoro' : 'pomodoros'} this session
        </div>
      )}
    </Widget>
  );
}
