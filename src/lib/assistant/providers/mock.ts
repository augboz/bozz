// A scripted provider for development and the browser preview: no key, no
// network. It answers a few recognisable requests with the same tool calls a
// real model would make, so the whole propose/apply/undo loop can be
// exercised end to end. Only offered in dev builds.
import type { CompleteRequest, CompleteResult, Provider, ToolCall } from './types';

let n = 0;
const call = (name: string, input: unknown): ToolCall => ({ id: `mock-${++n}`, name, input });

export const mockProvider: Provider = {
  id: 'mock',
  label: 'Mock (dev only)',
  models: ['mock'],
  keyHint: 'no key needed',
  keyUrl: '',
  async complete(req) {
    // Pretend usage, so the token meter can be exercised without a key.
    return { ...(await answer(req)), usage: { input: 1800, output: 60, cacheRead: 6400, cacheWrite: 0 } };
  },
};

async function answer(req: CompleteRequest): Promise<CompleteResult> {
    await new Promise(r => setTimeout(r, 400));
    const last = [...req.messages].reverse().find(m => m.role === 'user');
    const text = last && last.role === 'user' ? last.text.toLowerCase() : '';
    const system = `${req.system}\n${req.systemContext}`;
    const sysPage = /current page: (\S+)/.exec(system)?.[1] ?? 'home';
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
    if (/prettier|nicer|look better|organi[sz]e/.test(text) && page) {
      const ids = [...system.matchAll(new RegExp(`#${page}[^\\n]*widgets=\\[([^\\]]*)\\]`, 'g'))][0]?.[1]?.split(', ').map(w => /#(\S+?)\(/.exec(w)?.[1]).filter((x): x is string => !!x) ?? [];
      return { text: '', toolCalls: [call('apply_changes', { summary: 'Tidy the layout and give the page a backdrop', ops: [
        ...(ids.length > 1 ? [{ op: 'arrange_page', page, rows: [ids.slice(0, 2), ...ids.slice(2).map(id => [id])] }] : []),
        { op: 'set_background', target: page, colors: ['#1b2a41', '#2f6b5f'], worldId: null, dim: 0.35, remove: null },
        { op: 'update_page', topicId: page, name: null, folderId: null, icon: null, color: null, description: null, pageTitle: null, pageTitleSize: 'l', pageTitleColor: '#ffffff', status: null },
      ] })] };
    }
    if (/easier to read|readab/.test(text)) {
      return { text: '', toolCalls: [call('apply_changes', { summary: 'Larger text with wider line and letter spacing', ops: [
        { op: 'set_appearance', colorBank: null, mood: null, font: null, fontSize: 'large', widgetShape: null, widgetBorder: null },
        { op: 'set_readability', lineHeight: 1.5, letterSpacing: 0.12, wordSpacing: 0.16, reducedMotion: null, reset: null },
      ] })] };
    }
    if (/warm|theme|colour|color/.test(text)) {
      return { text: '', toolCalls: [call('apply_changes', { summary: 'Switch to the warm theme', ops: [
        { op: 'set_appearance', colorBank: null, mood: 'warm', font: null, fontSize: null, widgetShape: null, widgetBorder: null },
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
}
