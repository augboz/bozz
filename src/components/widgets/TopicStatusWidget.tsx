/**
 * TopicStatusWidget: "am I on top of this page?" at a glance.
 *
 * A two-way toggle, On track / Needs work, stored on the topic itself
 * (topic.status) so the sidebar can show the same state as a dot next to the
 * page name. Also shows how many tasks are still open and overdue, as a
 * prompt for the call; the status itself is always the user's own judgement.
 */
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Widget } from '../shared/Widget';
import type { WidgetCtx } from './context';
import type { Topic } from '../../lib/types';

import { STATUS_COLORS } from '../../lib/topicStatus';

function ago(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'a week ago' : `${weeks} weeks ago`;
}

export default function TopicStatusWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics, currentTopicId, onTopicChange } = ctx;
  const topic = topics.find(tp => tp.id === currentTopicId);

  if (!topic || !onTopicChange) {
    return (
      <Widget t={t} accent={STATUS_COLORS.onTrack}>
        <div style={{ fontSize: '0.78rem', color: t.textMuted }}>No topic selected.</div>
      </Widget>
    );
  }

  const doneStages = new Set(topic.stages.filter(s => s.done).map(s => s.id));
  const open = topic.items.filter(i => !doneStages.has(i.stageId));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = open.filter(i => i.deadline != null && i.deadline < today.getTime()).length;

  // Clicking the active option clears it, so a page can go back to "not set".
  const set = (status: NonNullable<Topic['status']>) => {
    const next = topic.status === status ? undefined : status;
    onTopicChange({ ...topic, status: next, statusAt: next ? Date.now() : undefined });
  };

  const option = (status: NonNullable<Topic['status']>, label: string, Icon: typeof CheckCircle2) => {
    const on = topic.status === status;
    const c = STATUS_COLORS[status];
    return (
      <button
        onClick={() => set(status)}
        aria-pressed={on}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          padding: '0.6rem 0.5rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '0.82rem', fontWeight: on ? 600 : 400,
          background: on ? c : 'transparent',
          color: on ? '#fff' : t.textMuted,
          border: `1.5px solid ${on ? c : t.border}`,
          transition: 'background 0.12s, color 0.12s, border-color 0.12s',
        }}
      >
        <Icon size={15} strokeWidth={on ? 2.2 : 1.6} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </button>
    );
  };

  return (
    <Widget t={t} accent={topic.status ? STATUS_COLORS[topic.status] : (topic.color ?? t.border)}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {option('onTrack', 'On track', CheckCircle2)}
        {option('needsWork', 'Needs work', AlertCircle)}
      </div>
      <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: t.textMuted, lineHeight: 1.5 }}>
        {open.length === 0 ? 'No open tasks' : `${open.length} open task${open.length === 1 ? '' : 's'}`}
        {overdue > 0 && <span style={{ color: t.alert }}>{` · ${overdue} overdue`}</span>}
        {topic.status && topic.statusAt ? ` · set ${ago(topic.statusAt)}` : ''}
      </div>
    </Widget>
  );
}
