import type { ElementType } from 'react';
import { Disc, Sparkles, FileText, BookOpen } from 'lucide-react';
import { Widget, WidgetHeader, NextItemDisplay, EmptyWidget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import type { ListItem, SectionId, TaskListKey } from '../../lib/types';
import type { WidgetCtx, WidgetComponent } from './context';

const CONFIG: Record<TaskListKey, {
  label: string; icon: ElementType; section: SectionId; empty: string;
}> = {
  music: { label: 'Music', icon: Disc, section: 'music', empty: 'nothing queued' },
  life: { label: 'Life', icon: Sparkles, section: 'life', empty: 'all clear' },
  cv: { label: 'CV', icon: FileText, section: 'cv', empty: 'nothing to add' },
  other: { label: 'Other', icon: BookOpen, section: 'other', empty: 'nothing here yet' },
};

function itemsFor(ctx: WidgetCtx, key: TaskListKey): ListItem[] {
  if (key === 'music') return ctx.musicItems;
  if (key === 'life') return ctx.lifeItems;
  if (key === 'cv') return ctx.cvItems;
  return ctx.otherItems;
}

/** Builds a "next task" widget bound to one list. */
export function makeNextTaskWidget(key: TaskListKey): WidgetComponent {
  const cfg = CONFIG[key];
  const Component: WidgetComponent = ({ ctx }) => {
    const items = itemsFor(ctx, key);
    const next = items.find(i => i.status === 'doing') || items.find(i => i.status === 'todo');
    const accent = sectionAccents[cfg.section];
    return (
      <Widget t={ctx.t} accent={accent} onClick={() => ctx.setActiveSection(cfg.section)}>
        <WidgetHeader label={cfg.label} accent={accent} t={ctx.t} icon={cfg.icon} />
        {next
          ? <NextItemDisplay item={next} t={ctx.t} remaining={items.filter(i => i.status !== 'done').length - 1} />
          : <EmptyWidget text={cfg.empty} t={ctx.t} />}
      </Widget>
    );
  };
  Component.displayName = `NextTaskWidget(${key})`;
  return Component;
}
