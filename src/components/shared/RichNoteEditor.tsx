/**
 * RichNoteEditor: a small formatting editor for notes (headings, fonts, sizes,
 * bold/italic/underline/strike, alignment, lists, colour).
 *
 * Built on contentEditable + document.execCommand, which WebView2 and every
 * browser Bozz runs in still support. Output always goes through
 * sanitizeNoteHtml before it is stored, and RichNoteView renders stored notes
 * through it too.
 */
import { useEffect, useRef } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, RemoveFormatting,
} from 'lucide-react';
import type { Theme } from '../../lib/types';
import { sanitizeNoteHtml } from '../../lib/richNote';

const FONTS: Array<{ label: string; value: string }> = [
  { label: 'Default font', value: '' },
  { label: 'Geist', value: 'Geist Variable, sans-serif' },
  { label: 'Inter', value: 'Inter Variable, sans-serif' },
  { label: 'Fraunces (serif)', value: 'Fraunces Variable, serif' },
  { label: 'Quicksand (rounded)', value: 'Quicksand Variable, sans-serif' },
  { label: 'Syne (display)', value: 'Syne Variable, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Mono', value: 'JetBrains Mono Variable, monospace' },
];
// execCommand('fontSize') takes 1-7; with styleWithCSS on it writes CSS sizes.
const SIZES: Array<{ label: string; value: string }> = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '4' },
  { label: 'Larger', value: '5' },
  { label: 'Huge', value: '6' },
];
const BLOCKS: Array<{ label: string; value: string }> = [
  { label: 'Text', value: 'div' },
  { label: 'Heading', value: 'h1' },
  { label: 'Subheading', value: 'h2' },
  { label: 'Small heading', value: 'h3' },
  { label: 'Quote', value: 'blockquote' },
];

/** Typography for headings/lists/quotes inside notes, scoped to .bozz-note. */
export function NoteStyles({ t }: { t: Theme }) {
  return (
    <style>{`
      .bozz-note { font-size: 0.85rem; line-height: 1.6; color: ${t.text}; overflow-wrap: anywhere; }
      .bozz-note h1 { font-size: 1.6em; font-weight: 650; line-height: 1.2; margin: 0.35em 0 0.25em; letter-spacing: -0.02em; }
      .bozz-note h2 { font-size: 1.3em; font-weight: 600; line-height: 1.25; margin: 0.35em 0 0.2em; }
      .bozz-note h3 { font-size: 1.08em; font-weight: 600; margin: 0.3em 0 0.15em; color: ${t.textMuted}; text-transform: uppercase; letter-spacing: 0.04em; }
      .bozz-note p, .bozz-note div { margin: 0; }
      .bozz-note ul, .bozz-note ol { margin: 0.2em 0; padding-left: 1.4em; }
      .bozz-note blockquote { margin: 0.3em 0; padding-left: 0.75em; border-left: 3px solid ${t.borderStrong}; color: ${t.textMuted}; }
      .bozz-note > :first-child { margin-top: 0; }
    `}</style>
  );
}

export function RichNoteView({ html, t }: { html: string; t: Theme }) {
  return (
    <>
      <NoteStyles t={t} />
      <div className="bozz-note" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(html) }} />
    </>
  );
}

export default function RichNoteEditor({ initialHtml, onChange, t, placeholder }: {
  initialHtml: string;
  onChange: (html: string) => void;
  t: Theme;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Dropdowns and the colour picker take focus, which drops the selection. Keep
  // the last selection made inside the editor and put it back before a command.
  const saved = useRef<Range | null>(null);

  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection();
      if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeNoteHtml(initialHtml);
    el.focus();
    try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* older engines */ }
    // Only on mount: the editor owns its DOM while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => { if (ref.current) onChange(ref.current.innerHTML); };
  const exec = (cmd: string, value?: string) => {
    ref.current?.focus();
    const sel = document.getSelection();
    if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current); }
    document.execCommand(cmd, false, value);
    emit();
  };

  // mousedown + preventDefault keeps the text selection while clicking buttons.
  const btn = (label: string, Icon: typeof Bold, cmd: string, value?: string) => (
    <button
      key={label} type="button" title={label} aria-label={label}
      onMouseDown={e => { e.preventDefault(); exec(cmd, value); }}
      style={{
        background: 'none', border: '1px solid transparent', borderRadius: '6px', padding: '3px',
        cursor: 'pointer', color: t.text, display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = t.border)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
    >
      <Icon size={14} strokeWidth={1.8} />
    </button>
  );
  const select = (label: string, options: Array<{ label: string; value: string }>, onPick: (v: string) => void) => (
    <select
      aria-label={label} title={label} value=""
      onChange={e => { const v = e.target.value; e.target.value = ''; onPick(v); }}
      style={{
        background: t.input, color: t.text, border: `1px solid ${t.border}`, borderRadius: '6px',
        fontSize: '0.7rem', fontFamily: 'inherit', padding: '2px 4px', maxWidth: '7.5rem', cursor: 'pointer',
      }}
    >
      <option value="" disabled>{label}</option>
      {options.map(o => <option key={o.label} value={o.value || '__default'}>{o.label}</option>)}
    </select>
  );
  const sep = <span style={{ width: 1, alignSelf: 'stretch', background: t.border, margin: '0 2px' }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: 0, flex: 1 }}>
      <NoteStyles t={t} />
      <div role="toolbar" aria-label="Formatting" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px' }}>
        {select('Style', BLOCKS, v => exec('formatBlock', `<${v === '__default' ? 'div' : v}>`))}
        {select('Font', FONTS, v => exec('fontName', v === '__default' ? 'inherit' : v))}
        {select('Size', SIZES, v => exec('fontSize', v))}
        {sep}
        {btn('Bold', Bold, 'bold')}
        {btn('Italic', Italic, 'italic')}
        {btn('Underline', Underline, 'underline')}
        {btn('Strikethrough', Strikethrough, 'strikeThrough')}
        {sep}
        {btn('Align left', AlignLeft, 'justifyLeft')}
        {btn('Centre', AlignCenter, 'justifyCenter')}
        {btn('Align right', AlignRight, 'justifyRight')}
        {sep}
        {btn('Bullet list', List, 'insertUnorderedList')}
        {btn('Numbered list', ListOrdered, 'insertOrderedList')}
        <label title="Text colour" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '0 2px' }}>
          <input
            type="color" aria-label="Text colour" defaultValue="#e8b04a"
            onChange={e => exec('foreColor', e.target.value)}
            style={{ width: '18px', height: '18px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
          />
        </label>
        {btn('Clear formatting', RemoveFormatting, 'removeFormat')}
      </div>
      <div
        ref={ref}
        className="bozz-note"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Note"
        data-placeholder={placeholder}
        onInput={emit}
        style={{
          flex: 1, minHeight: '6rem', overflowY: 'auto', background: t.input,
          border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.55rem 0.75rem', outline: 'none',
        }}
      />
    </div>
  );
}
