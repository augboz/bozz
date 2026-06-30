import { format } from 'date-fns';
import type {
  BudgetData, CalendarEvent, InboxItem, SectionId,
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
}

const SETTINGS_ENTRIES = [
  'Mood', 'Font', 'Text size', 'Default section', 'Navigation',
  'Calendar feeds', 'Currency', 'Launch at startup', 'Reset',
];

export function buildSearchIndex(s: SearchSources): SearchEntry[] {
  const out: SearchEntry[] = [];

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
