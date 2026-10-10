/**
 * TopicNoteWidget: a freeform note on the current topic page.
 *
 * A page can hold several. Each widget added from the Add panel keeps its own
 * text in its widget config (`config.note`). A widget with no `note` key is a
 * pre-existing one and keeps reading and writing topic.pinnedNote, so notes
 * written before multiple notes existed stay where they were.
 *
 * Notes are rich text (headings, fonts, sizes, bold/italic/underline,
 * alignment, lists). The formatted copy is stored beside the plain text
 * (config.noteHtml / topic.pinnedNoteHtml), never in place of it; see
 * lib/richNote.ts for why that keeps older builds and their data safe.
 */
import { useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import { Widget } from '../shared/Widget';
import RichNoteEditor, { RichNoteView } from '../shared/RichNoteEditor';
import { htmlToPlain, noteHtmlFor, sanitizeNoteHtml } from '../../lib/richNote';
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
  const plain = ownsNote ? (widgetConfig.note as string) : (topic.pinnedNote ?? '');
  const storedHtml = ownsNote ? (widgetConfig.noteHtml as string | undefined) : topic.pinnedNoteHtml;
  const html = noteHtmlFor(plain, storedHtml);

  const startEdit = () => {
    setDraft(html);
    setEditing(true);
  };

  const save = () => {
    const clean = sanitizeNoteHtml(draft);
    const text = htmlToPlain(clean);
    // Plain text is always written too: it is what older builds read.
    if (ownsNote) onWidgetConfig({ ...widgetConfig, note: text, noteHtml: text ? clean : undefined });
    else onTopicChange({ ...topic, pinnedNote: text || undefined, pinnedNoteHtml: text ? clean : undefined });
    setEditing(false);
  };

  const smallBtn: React.CSSProperties = {
    background: 'none', border: `1px solid ${t.border}`, borderRadius: '7px', padding: '0.3rem 0.65rem',
    cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
  };

  return (
    <Widget t={t} accent={accent}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {!editing && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.35rem' }}>
            <button
              onClick={startEdit}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: '2px', display: 'flex' }}
              title="Edit note"
            >
              <Pencil size={13} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {editing ? (
          <>
            <RichNoteEditor initialHtml={draft} onChange={setDraft} t={t} placeholder="Write your note" />
            <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', marginTop: '0.45rem' }}>
              <button onClick={() => setEditing(false)} style={{ ...smallBtn, color: t.textMuted }}>
                Cancel
              </button>
              <button onClick={save} style={{ ...smallBtn, color: t.doneAccent, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Check size={12} strokeWidth={2} /> Save
              </button>
            </div>
          </>
        ) : html ? (
          <div onDoubleClick={startEdit} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <RichNoteView html={html} t={t} />
          </div>
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
      </div>
    </Widget>
  );
}
