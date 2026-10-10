/**
 * TopicStatusWidget: "am I on top of this page?" at a glance.
 *
 * A two-way toggle, On track / Needs work, stored on the topic itself
 * (topic.status) so the sidebar can show the same state as a dot next to the
 * page name. The status is always the user's own judgement.
 */
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Widget } from '../shared/Widget';
import type { WidgetCtx } from './context';
import type { Topic } from '../../lib/types';

import { STATUS_COLORS } from '../../lib/topicStatus';

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
    </Widget>
  );
}
