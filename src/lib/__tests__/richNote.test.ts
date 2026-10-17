// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeNoteHtml, htmlToPlain, plainToHtml, noteHtmlFor } from '../richNote';

describe('rich notes', () => {
  it('sanitizeNoteHtml keeps formatting and strips scripts, handlers, links and images', () => {
    const out = sanitizeNoteHtml('<h2 onclick="x()">Hi</h2><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:1">link</a><span style="color:red;background:url(evil)">ok</span>');
    expect(out).toBe('<h2>Hi</h2>link<span style="color: red">ok</span>');
  });

  it('htmlToPlain and plainToHtml round-trip line structure', () => {
    expect(htmlToPlain('<div>one</div><div>two <b>bold</b></div>')).toBe('one\ntwo bold');
    expect(plainToHtml('a\n\nb')).toBe('<div>a</div><div><br></div><div>b</div>');
    expect(htmlToPlain(plainToHtml('x <b>not bold</b>\ny'))).toBe('x <b>not bold</b>\ny');
  });

  it('noteHtmlFor ignores a formatted copy once the plain text was edited elsewhere', () => {
    const html = '<h1>Title</h1><div>body</div>';
    expect(noteHtmlFor('Title\nbody', html)).toBe(html);
    // An older build changed the plain text: the newer edit wins.
    expect(noteHtmlFor('Edited on an older Bozz', html)).toBe('<div>Edited on an older Bozz</div>');
    expect(noteHtmlFor('', html)).toBe('');
  });
});
