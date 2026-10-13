/**
 * TopicTimerWidget: a study stopwatch for one topic page.
 *
 * Start when you sit down to work on the module, Stop when you're done; every
 * session is kept on the topic (topic.timeLog) so the totals sync across
 * devices. The running session is stored as a start time, so closing Bozz (or
 * the laptop sleeping) doesn't lose it: the clock just keeps counting from when
 * it was started.
 */
import { useEffect, useState } from 'react';
import { Play, Square, Timer } from 'lucide-react';
import { Widget, WidgetHeader } from '../shared/Widget';
import type { WidgetCtx } from './context';
import { formatClock, formatDuration, startTimer, stopTimer, studyTotals } from '../../lib/studyTime';

const ACCENT = '#7da7d9';

export default function TopicTimerWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics, currentTopicId, onTopicChange } = ctx;
  const topic = topics.find(tp => tp.id === currentTopicId);
  const running = !!topic?.timeLog?.runningSince;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!topic || !onTopicChange) {
    return (
      <Widget t={t} accent={ACCENT}>
        <div style={{ fontSize: '0.78rem', color: t.textMuted }}>No topic selected.</div>
      </Widget>
    );
  }

  const accent = topic.color ?? ACCENT;
  const log = topic.timeLog;
  const live = running ? Math.max(0, now - (log!.runningSince as number)) : 0;
  const totals = studyTotals(log, running ? now : Date.now());

  const toggle = () => {
    const at = Date.now();
    setNow(at);
    onTopicChange({ ...topic, timeLog: running ? stopTimer(log, at) : startTimer(log, at) });
  };
  const discard = () => onTopicChange({ ...topic, timeLog: { sessions: log?.sessions ?? [] } });

  const stat = (label: string, ms: number) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.62rem', color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '0.95rem', color: t.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatDuration(ms)}</div>
    </div>
  );

  return (
    <Widget t={t} accent={accent}>
      <WidgetHeader label="Study timer" accent={accent} t={t} icon={Timer} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.7rem' }}>
        <button
          onClick={toggle}
          aria-pressed={running}
          aria-label={running ? 'Stop timer' : 'Start timer'}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0,
            padding: '0.55rem 0.95rem', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '0.85rem', fontWeight: 600, border: 'none',
            background: running ? t.alert : accent, color: '#fff',
          }}
        >
          {running ? <Square size={14} strokeWidth={2.5} fill="#fff" /> : <Play size={14} strokeWidth={2.5} fill="#fff" />}
          {running ? 'Stop' : 'Start'}
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: '1.6rem', fontWeight: 650, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
            color: running ? t.text : t.textDim,
          }}>
            {formatClock(live)}
          </div>
          {running && (
            <button onClick={discard} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.68rem', color: t.textDim, textDecoration: 'underline',
            }}>
              Started by mistake? Discard
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.85rem', borderTop: `1px solid ${t.border}`, paddingTop: '0.6rem' }}>
        {stat('Today', totals.today)}
        {stat('This week', totals.week)}
        {stat('All time', totals.total)}
      </div>
    </Widget>
  );
}
