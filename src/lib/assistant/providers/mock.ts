// A scripted provider for development and the browser preview: no key, no
// network. It answers a few recognisable requests with the same tool calls a
// real model would make, so the whole propose/apply/undo loop can be
// exercised end to end. Only offered in dev builds.
import type { Provider, ToolCall } from './types';

let n = 0;
const call = (name: string, input: unknown): ToolCall => ({ id: `mock-${++n}`, name, input });

export const mockProvider: Provider = {
  id: 'mock',
  label: 'Mock (dev only)',
  models: ['mock'],
  keyHint: 'no key needed',
  keyUrl: '',
  async complete(req) {
    await new Promise(r => setTimeout(r, 400));
    const last = [...req.messages].reverse().find(m => m.role === 'user');
    const text = last && last.role === 'user' ? last.text.toLowerCase() : '';
    const sysPage = /current page: (\S+)/.exec(req.system)?.[1] ?? 'home';
    const page = sysPage === 'home' ? null : sysPage;
    // How many tool rounds this turn has had so far.
    const lastUserIdx = req.messages.map(m => m.role).lastIndexOf('user');
    const rounds = req.messages.slice(lastUserIdx).filter(m => m.role === 'tool').length;
    const lastMsg = req.messages[req.messages.length - 1];
    if (lastMsg?.role === 'tool' && lastMsg.results.some(x => x.isError)) return { text: `I couldn't do that: ${lastMsg.results.find(x => x.isError)?.content}`, toolCalls: [] };
    // "two steps": add a timer, then, seeing its id in the working copy, move it to the top.
    if (/two steps/.test(text) && page) {
      if (rounds === 0) return { text: '', toolCalls: [call('apply_changes', { summary: 'Add a study timer', ops: [{ op: 'add_widget', page, type: 'topicTimer', size: null, placement: null, anchorId: null, config: null }] })] };
      if (rounds === 1 && lastMsg?.role === 'tool') {
        const id = /topicTimer#(\S+?)\(/.exec(lastMsg.results[0].content)?.[1];
        if (id) return { text: '', toolCalls: [call('apply_changes', { summary: 'Move it to the top', ops: [{ op: 'move_widget', widgetId: id, size: null, placement: 'top', anchorId: null }] })] };
      }
    }
    if (lastMsg?.role === 'tool') return { text: 'Done. Tell me if you want anything adjusted.', toolCalls: [] };
    if (/easier to read|readab/.test(text)) {
      return { text: '', toolCalls: [call('apply_changes', { summary: 'Larger text with wider line and letter spacing', ops: [
        { op: 'set_appearance', mood: null, font: null, fontSize: 'large', widgetShape: null, widgetBorder: null },
        { op: 'set_readability', lineHeight: 1.5, letterSpacing: 0.12, wordSpacing: 0.16, reducedMotion: null, reset: null },
      ] })] };
    }
    if (/warm|theme|colour|color/.test(text)) {
      return { text: '', toolCalls: [call('apply_changes', { summary: 'Switch to the warm theme', ops: [
        { op: 'set_appearance', mood: 'warm', font: null, fontSize: null, widgetShape: null, widgetBorder: null },
      ] })] };
    }
    if (/delete/.test(text) && page) {
      return { text: '', toolCalls: [call('apply_changes', { summary: 'Delete this page', ops: [{ op: 'delete_page', topicId: page }] })] };
    }
    if (/timer|note|status|set (this|the) page up|set up/.test(text) && page) {
      return { text: '', toolCalls: [call('apply_changes', { summary: 'Add a study timer, a note and a status to this page', ops: [
        { op: 'add_widget', page, type: 'topicTimer', size: null, placement: null, anchorId: null, config: null },
        { op: 'add_widget', page, type: 'topicNote', size: null, placement: null, anchorId: null, config: { note: '' } },
        { op: 'add_widget', page, type: 'topicStatus', size: null, placement: null, anchorId: null, config: null },
      ] })] };
    }
    if (/new page|page for/.test(text)) {
      const name = /for (.+?)( with|$)/.exec(last && last.role === 'user' ? last.text : '')?.[1] ?? 'New module';
      return { text: '', toolCalls: [call('apply_changes', { summary: `Create a page for ${name}`, ops: [
        { op: 'create_page', name, folderId: null, icon: 'book', color: null, stages: null, widgets: [{ type: 'topicTimer', size: null, config: null }, { type: 'topicNote', size: null, config: null }], description: null, pageTitle: null, pageTitleSize: null, pageTitleColor: null },
      ] })] };
    }
    if (/what('s| is) on|read/.test(text)) {
      return { text: '', toolCalls: [call('read_dashboard', { scope: page ?? 'summary' })] };
    }
    return { text: "I can add or change widgets, pages, themes, notes, tasks and habits. Try: \"set this page up with a timer and a note\" or \"make the text easier to read\".", toolCalls: [] };
  },
};
