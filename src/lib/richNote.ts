// Rich-text notes, stored next to the plain text, never instead of it.
//
// A note keeps its plain text where it always lived (topic.pinnedNote or a
// widget's config.note) and adds the formatted version beside it
// (pinnedNoteHtml / config.noteHtml). Builds from before rich notes only know
// the plain field, so they keep showing and saving real text. If one of them
// edits the plain text, the formatted copy no longer matches it and is
// ignored, so the newer edit wins and nothing is lost.

const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3', 'H4',
  'P', 'DIV', 'BR', 'SPAN', 'FONT', 'UL', 'OL', 'LI', 'BLOCKQUOTE',
]);
// Dropped with their contents; anything else unknown is unwrapped (text kept).
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TEMPLATE', 'SVG', 'MATH']);
const ALLOWED_STYLES = [
  'text-align', 'font-family', 'font-size', 'font-weight', 'font-style',
  'text-decoration', 'text-decoration-line', 'color',
];
const FONT_ATTRS = ['face', 'size', 'color'];

function cleanStyle(style: CSSStyleDeclaration): string {
  const out: string[] = [];
  for (const prop of ALLOWED_STYLES) {
    const v = style.getPropertyValue(prop).trim();
    if (v && !/url\(|expression|javascript:/i.test(v)) out.push(`${prop}: ${v}`);
  }
  return out.join('; ');
}

function cleanNode(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) return [doc.createTextNode(node.textContent ?? '')];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  if (DROP_TAGS.has(el.tagName)) return [];
  const kids = Array.from(el.childNodes).flatMap(c => cleanNode(c, doc));
  if (!ALLOWED_TAGS.has(el.tagName)) return kids;
  const copy = doc.createElement(el.tagName.toLowerCase());
  const style = cleanStyle(el.style);
  if (style) copy.setAttribute('style', style);
  if (el.tagName === 'FONT') {
    for (const a of FONT_ATTRS) {
      const v = el.getAttribute(a);
      if (v && !/url\(|javascript:/i.test(v)) copy.setAttribute(a, v);
    }
  }
  kids.forEach(k => copy.appendChild(k));
  return [copy];
}

/** Keep only text formatting: no scripts, links, images, handlers or classes. */
export function sanitizeNoteHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = doc.createElement('div');
  Array.from(doc.body.childNodes).flatMap(n => cleanNode(n, doc)).forEach(n => out.appendChild(n));
  return out.innerHTML;
}

/** Plain text of a formatted note, one line per block, as the plain field stores it. */
export function htmlToPlain(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const lines: string[] = [];
  let cur = '';
  const BLOCK = /^(P|DIV|H1|H2|H3|H4|LI|BLOCKQUOTE|UL|OL)$/;
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) { cur += n.textContent ?? ''; return; }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    if (el.tagName === 'BR') { lines.push(cur); cur = ''; return; }
    const block = BLOCK.test(el.tagName);
    if (block && cur) { lines.push(cur); cur = ''; }
    el.childNodes.forEach(walk);
    if (block && cur) { lines.push(cur); cur = ''; }
  };
  doc.body.childNodes.forEach(walk);
  if (cur) lines.push(cur);
  return lines.join('\n').replace(/ /g, ' ').trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A plain-text note as editable HTML, one paragraph per line. */
export function plainToHtml(text: string): string {
  return text.split('\n').map(l => `<div>${l ? escapeHtml(l) : '<br>'}</div>`).join('');
}

/** The HTML to show for a note: the formatted copy while it still matches the
 *  plain text, otherwise the plain text (edited since, e.g. by an older build). */
export function noteHtmlFor(plain: string | undefined, html: string | undefined): string {
  const p = (plain ?? '').trim();
  if (html && htmlToPlain(html) === p) return sanitizeNoteHtml(html);
  return p ? plainToHtml(p) : '';
}
