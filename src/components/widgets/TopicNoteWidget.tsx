/**
 * TopicNoteWidget: a freeform note on the current topic page.
 *
 * A page can hold several. Each widget added from the Add panel keeps its own
 * text in its widget config (`config.note`). A widget with no `note` key is a
 * pre-existing one and keeps reading and writing topic.pinnedNote, so notes
 * written before multiple notes existed stay where they were.
 */
import { useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import { Widget } from '../shared/Widget';
import type { WidgetCtx } from './context';

const ACCENT = '#d9c47d';

export default function TopicNoteWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics, currentTopicId, onTopicChange, widgetConfig, onWidgetConfig } = ctx;
  const topic = topics.find(tp => tp.id === currentTopicId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!topic || !onTopicChange) {
    return (
      <Widget t={t} accent={ACCENT}>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5 }}>
          No topic selected.
        </div>
      </Widget>
    );
  }

  const accent = topic.color ?? ACCENT;

  const ownsNote = typeof widgetConfig?.note === 'string';
  const note = ownsNote ? (widgetConfig.note as string) : (topic.pinnedNote ?? '');

  const startEdit = () => {
    setDraft(note);
    setEditing(true);
  };

  const save = () => {
    if (ownsNote) onWidgetConfig({ ...widgetConfig, note: draft.trim() });
    else onTopicChange({ ...topic, pinnedNote: draft.trim() || undefined });
    setEditing(false);
  };

  return (
    <Widget t={t} accent={accent}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        {!editing && (
          <button
            onClick={startEdit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: '2px', display: 'flex' }}
            title="Edit note"
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={5}
            placeholder="Any notes, context, or reminders for this topic…"
            style={{
              background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.55rem 0.75rem', color: t.text, fontSize: '0.82rem',
              fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6,
              width: '100%', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditing(false)}
              style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '7px', padding: '0.3rem 0.65rem', cursor: 'pointer', color: t.textMuted, fontSize: '0.75rem', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: '7px', padding: '0.3rem 0.7rem', cursor: 'pointer', color: t.doneAccent, display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontFamily: 'inherit' }}
            >
              <Check size={12} strokeWidth={2} /> Save
            </button>
          </div>
        </div>
      ) : note ? (
        <p style={{ margin: 0, fontSize: '0.82rem', color: t.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {note}
        </p>
      ) : (
        <button
          onClick={startEdit}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5 }}>
            No note yet. Click to add one.
          </span>
        </button>
      )}
    </Widget>
  );
}
