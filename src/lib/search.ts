import { format } from 'date-fns';
import type {
  BudgetData, CalendarEvent, InboxItem, SectionId, Topic,
} from './types';

export interface SearchEntry {
  id: string;
  label: string;
  sub: string;
  group: string;
  section: SectionId;
}

export interface SearchSources {
  budget: BudgetData;
  inbox: InboxItem[];
  feedEvents: CalendarEvent[];
  topics?: Topic[];
}

const SETTINGS_ENTRIES = [
  'Mood', 'Font', 'Text size', 'Default section', 'Navigation',
  'Calendar feeds', 'Currency', 'Launch at startup', 'Reset',
];

export function buildSearchIndex(s: SearchSources): SearchEntry[] {
  const out: SearchEntry[] = [];

  // Topics + their items first — these are the user's own content, the most
  // likely jump target. Done items (in a `done: true` stage) are skipped so the
  // palette stays focused on live work.
  for (const topic of s.topics ?? []) {
    out.push({
      id: `topic:${topic.id}`,
      label: topic.name || 'New topic',
      sub: 'Topic',
      group: 'Topics', section: topic.id as SectionId,
    });
    const doneStageIds = new Set((topic.stages ?? []).filter(st => st.done).map(st => st.id));
    for (const item of topic.items ?? []) {
      if (doneStageIds.has(item.stageId)) continue;
      out.push({
        id: `item:${topic.id}:${item.id}`,
        label: item.text,
        sub: topic.name || 'Topic',
        group: 'Tasks', section: topic.id as SectionId,
      });
    }
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

  for (const e of s.feedEvents) {
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
