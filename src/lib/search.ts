import { format } from 'date-fns';
import { deadlineEvents } from './calendar';
import type {
  Application, BudgetData, CalendarEvent, InboxItem, ListItem, SectionId, TaskListKey,
} from './types';

export interface SearchEntry {
  id: string;
  label: string;
  sub: string;
  group: string;
  section: SectionId;
}

export interface SearchSources {
  lists: Record<TaskListKey, ListItem[]>;
  applications: Application[];
  budget: BudgetData;
  inbox: InboxItem[];
  feedEvents: CalendarEvent[];
}

const LIST_LABEL: Record<TaskListKey, string> = {
  music: 'Music', life: 'Life', cv: 'CV', other: 'Other',
};

const SETTINGS_ENTRIES = [
  'Mood', 'Font', 'Text size', 'Default section', 'Navigation',
  'Calendar feeds', 'Currency', 'Launch at startup', 'Reset',
];

export function buildSearchIndex(s: SearchSources): SearchEntry[] {
  const out: SearchEntry[] = [];

  (Object.keys(s.lists) as TaskListKey[]).forEach(k => {
    for (const i of s.lists[k]) {
      out.push({
        id: `task:${k}:${i.id}`,
        label: i.text,
        sub: `${LIST_LABEL[k]} · ${i.status}`,
        group: 'Tasks',
        section: k,
      });
    }
  });

  for (const a of s.applications) {
    out.push({
      id: `app:${a.id}`, label: a.name, sub: `Application · ${a.status}`,
      group: 'Applications', section: 'applications',
    });
  }

  for (const tx of s.budget.transactions) {
    out.push({
      id: `tx:${tx.id}`,
      label: tx.note || tx.category,
      sub: `${tx.type} · ${tx.amount} ${s.budget.currency}`,
      group: 'Budget', section: 'budget',
    });
  }

  for (const it of s.inbox) {
    out.push({ id: `inbox:${it.id}`, label: it.text, sub: 'Inbox', group: 'Inbox', section: 'inbox' });
  }

  const calEvents = [...deadlineEvents(s.lists), ...s.feedEvents];
  for (const e of calEvents) {
    out.push({
      id: `cal:${e.id}`,
      label: e.title,
      sub: `Calendar · ${format(new Date(e.start), 'd MMM')}`,
      group: 'Calendar', section: 'calendar',
    });
  }

  for (const label of SETTINGS_ENTRIES) {
    out.push({ id: `set:${label}`, label, sub: 'Settings', group: 'Settings', section: 'settings' });
  }

  return out;
}
