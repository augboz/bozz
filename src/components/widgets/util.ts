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

  // Topic items (primary — what most users will have)
  for (const topic of ctx.topics) {
    const doneStageIds = new Set(topic.stages.filter(s => s.done).map(s => s.id));
    for (const item of topic.items) {
      if (item.deadline != null && !doneStageIds.has(item.stageId)) {
        out.push({
          item: { id: item.id, text: item.text, status: 'todo', completedAt: item.completedAt, deadline: item.deadline },
          section: topic.id as SectionId,
          accent: topic.color,
        });
      }
    }
  }

  return out;
}
