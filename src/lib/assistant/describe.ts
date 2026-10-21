// Plain-English lines for a change card, written from the validated ops and
// the current store (so ids become names). This is the "what will happen"
// view; the receipt after apply comes from diff.ts and the real stores.
import type { Op } from './ops';
import type { AssistantStore } from './store';
import { WIDGET_CATALOG } from '../widgetCatalog';
import { findWorld } from '../worlds';

export function describeOp(op: Op, s: AssistantStore): string {
  const pageName = (id: string) => (id === 'home' ? 'Home' : s.topics.find(t => t.id === id)?.name ?? `page ${id}`);
  const widget = (id: string) => {
    const all = [...s.homeLayout.map(w => ({ w, page: 'Home' })), ...s.topics.flatMap(t => (t.widgetLayout ?? []).map(w => ({ w, page: t.name })))];
    const hit = all.find(x => x.w.i === id);
    return hit ? `${WIDGET_CATALOG[hit.w.type]?.label ?? hit.w.type} on ${hit.page}` : `widget ${id}`;
  };
  const size = (sz: { w: number; h: number } | null) => (sz ? ` (${sz.w}×${sz.h})` : '');
  switch (op.op) {
    case 'add_widget': return `Add ${WIDGET_CATALOG[op.type]?.label ?? op.type}${size(op.size)} to ${pageName(op.page)}${op.placement === 'top' ? ', at the top' : ''}`;
    case 'configure_widget': return `Change settings of ${widget(op.widgetId)}: ${Object.keys(op.config).join(', ') || 'nothing'}`;
    case 'move_widget': return `${op.size ? `Resize ${widget(op.widgetId)}${size(op.size)}` : `Move ${widget(op.widgetId)}`}${op.placement ? ` to the ${op.placement}` : ''}`;
    case 'remove_widget': return `Remove ${widget(op.widgetId)}`;
    case 'create_page': return `Create page "${op.name}"${op.folderId ? ` in folder ${s.topicFolders.find(f => f.id === op.folderId)?.name ?? op.folderId}` : ''}${op.widgets?.length ? ` with ${op.widgets.map(w => WIDGET_CATALOG[w.type]?.label ?? w.type).join(', ')}` : ''}`;
    case 'update_page': {
      const bits: string[] = [];
      if (op.name !== null) bits.push(`rename to "${op.name}"`);
      if (op.pageTitle !== null) bits.push(op.pageTitle ? `page title "${op.pageTitle}"` : 'clear page title');
      if (op.pageTitleSize !== null) bits.push(`title size ${op.pageTitleSize.toUpperCase()}`);
      if (op.pageTitleColor !== null) bits.push(`title colour ${op.pageTitleColor}`);
      if (op.icon !== null) bits.push(`icon ${op.icon}`);
      if (op.color !== null) bits.push(`colour ${op.color}`);
      if (op.folderId !== null) bits.push(op.folderId === 'none' ? 'move out of its folder' : `move to folder ${s.topicFolders.find(f => f.id === op.folderId)?.name ?? op.folderId}`);
      if (op.description !== null) bits.push('description');
      if (op.status !== null) bits.push(op.status === 'none' ? 'clear status' : `status ${op.status === 'onTrack' ? 'On track' : 'Needs work'}`);
      return `Update "${pageName(op.topicId)}": ${bits.join(', ') || 'nothing'}`;
    }
    case 'delete_page': return `Delete page "${pageName(op.topicId)}" and its ${s.topics.find(t => t.id === op.topicId)?.items.length ?? 0} tasks`;
    case 'create_folder': return `Create folder "${op.name}"`;
    case 'set_appearance': {
      const bits = (['mood', 'font', 'fontSize', 'widgetShape', 'widgetBorder'] as const).filter(k => op[k] !== null).map(k => `${k === 'mood' ? 'theme' : k === 'fontSize' ? 'text size' : k === 'widgetShape' ? 'corners' : k === 'widgetBorder' ? 'borders' : k} ${op[k]}`);
      return `Appearance: ${bits.join(', ') || 'no change'}`;
    }
    case 'set_readability': {
      if (op.reset) return 'Readability: back to defaults';
      const bits = [op.lineHeight !== null && `line height ${op.lineHeight}`, op.letterSpacing !== null && `letter spacing ${op.letterSpacing}em`, op.wordSpacing !== null && `word spacing ${op.wordSpacing}em`, op.reducedMotion !== null && (op.reducedMotion ? 'reduce motion' : 'normal motion')].filter(Boolean);
      return `Readability: ${bits.join(', ') || 'no change'}`;
    }
    case 'apply_world': {
      const w = findWorld(op.worldId)?.name ?? op.worldId;
      return op.scope === 'global' ? `Apply the "${w}" world everywhere` : op.scope === 'newPage' ? `New page "${op.name ?? w}" from the "${w}" template` : `Apply the "${w}" look to "${pageName(op.topicId ?? '')}"`;
    }
    case 'edit_note': return `${op.mode === 'append' ? 'Add to' : 'Replace'} the note on ${op.target === 'page' ? pageName(op.id) : widget(op.id)}`;
    case 'add_task': return `Add task "${op.text}" to ${pageName(op.topicId)}${op.deadline ? `, due ${op.deadline}` : ''}`;
    case 'complete_task': return `Mark task "${s.topics.find(t => t.id === op.topicId)?.items.find(i => i.id === op.itemId)?.text ?? op.itemId}" done on ${pageName(op.topicId)}`;
    case 'add_habit': return `Add ${op.frequency} habit "${op.name}"${op.topicId ? ` to ${pageName(op.topicId)}` : ''}`;
  }
}
