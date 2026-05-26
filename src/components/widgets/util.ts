import { sectionAccents } from '../../lib/themes';
import type { ListItem, SectionId } from '../../lib/types';
import type { WidgetCtx } from './context';

export interface DeadlineEntry {
  item: ListItem;
  section: SectionId;
  accent: string;
}

/** All non-done items that have a deadline, tagged with their section. */
export function deadlineEntries(ctx: WidgetCtx): DeadlineEntry[] {
  const out: DeadlineEntry[] = [];
  const push = (items: ListItem[], section: SectionId) => {
    for (const it of items) {
      if (it.deadline != null && it.status !== 'done') {
        out.push({ item: it, section, accent: sectionAccents[section] });
      }
    }
  };
  push(ctx.musicItems, 'music');
  push(ctx.lifeItems, 'life');
  push(ctx.cvItems, 'cv');
  push(ctx.otherItems, 'other');
  return out;
}
