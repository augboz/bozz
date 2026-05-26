// Naive keyword-based routing for voice input. Takes the raw transcript
// and decides which section the captured thought belongs in.
//
// The routing is intentionally simple — keyword matching + a couple of
// regex extractions. The user can correct anything that lands in the
// wrong place from the destination section.

import type {
  ListItem, OneOffTransaction, TaskListKey, TransactionType,
} from './types';

export type VoiceRoute =
  | { kind: 'task'; list: TaskListKey; item: ListItem }
  | { kind: 'budget'; transaction: OneOffTransaction }
  | { kind: 'inbox'; text: string };

/** Pull a money figure (e.g. £20, 4.50, 12 pounds) out of free text. */
function parseAmount(s: string): number | null {
  const m = s.match(/(?:£|\$|€)\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:pounds?|dollars?|euros?|quid|bucks?|p)\b/i);
  if (m) return parseFloat(m[1] ?? m[2]);
  // Last-resort: any standalone number.
  const n = s.match(/\b(\d+(?:\.\d{1,2})?)\b/);
  return n ? parseFloat(n[1]) : null;
}

/** Best-effort category extraction — picks the noun phrase after on/for/at. */
function extractCategory(s: string): string {
  const m = s.match(/\b(?:on|for|at)\s+([^.,!?]+?)(?:\s+(?:yesterday|today|tomorrow|last|this|next|to|from)|$)/i);
  if (m) return m[1].trim();
  const words = s.replace(/[.,!?]/g, '').split(/\s+/);
  // Last 1–3 tokens as a fallback
  return words.slice(-Math.min(3, words.length)).join(' ');
}

/** Strip filler-prefixes so the saved task reads naturally. */
function cleanTaskText(s: string): string {
  return s
    .replace(/^(remind me to|i need to|i have to|i must|i should|todo:?|task:?|remember to|don'?t forget to|add(?:\s+a)?\s+task(?:\s+to)?)\s+/i, '')
    .replace(/[.!?]+$/, '')
    .trim();
}

function makeTask(list: TaskListKey, text: string): VoiceRoute {
  return {
    kind: 'task', list,
    item: {
      id: Date.now() + Math.floor(Math.random() * 1000),
      text: text || 'untitled',
      status: 'todo',
      completedAt: null,
      deadline: null,
    },
  };
}

export function routeVoice(transcript: string): VoiceRoute {
  const t = transcript.trim();
  const lo = t.toLowerCase();

  // ── Budget signals ─────────────────────────────────────────────────────
  const hasMoney =
    /[£$€]\s*\d/.test(t) ||
    /\b\d+(?:\.\d{1,2})?\s*(?:pounds?|dollars?|euros?|quid|bucks?|p)\b/i.test(t) ||
    /\b(?:spent|bought|paid|cost|costs?|charged?|expense|earned|salary|received|owes?)\b/i.test(lo);

  if (hasMoney) {
    let type: TransactionType | null = null;
    if (/\bowes? me\b/.test(lo) || /\bowed to me\b/.test(lo)) type = 'owed-to-me';
    else if (/\bi owe\b/.test(lo)) type = 'i-owe';
    else if (/\b(?:earned|got paid|salary|received|income|paid me)\b/.test(lo)) type = 'income';
    else if (/\b(?:spent|bought|paid|cost|costs?|charged?|expense)\b/.test(lo)) type = 'expense';

    if (type) {
      const amount = parseAmount(t) ?? 0;
      return {
        kind: 'budget',
        transaction: {
          id: Date.now(),
          date: Date.now(),
          amount,
          type,
          category: extractCategory(t) || 'misc',
          note: t,
        },
      };
    }
  }

  // ── Task lists by keyword cue ─────────────────────────────────────────
  if (/\b(?:music|practice|guitar|piano|drum|song|chord|scale|gig|rehearsal)\b/.test(lo)) {
    return makeTask('music', cleanTaskText(t));
  }
  if (/\b(?:cv|resume|portfolio|interview|application|career|cover letter|linkedin)\b/.test(lo)) {
    return makeTask('cv', cleanTaskText(t));
  }
  if (/\b(?:remind|todo|task|need to|have to|must|gotta|should|don'?t forget|book|appointment|call|email|message)\b/.test(lo)) {
    return makeTask('life', cleanTaskText(t));
  }
  if (/\b(?:read|watch|book|article|recipe|note|idea|thought|movie|film|show|series)\b/.test(lo)) {
    return makeTask('other', cleanTaskText(t));
  }

  return { kind: 'inbox', text: t };
}

/** Human-readable label for the route — shown as feedback on capture. */
export function describeRoute(r: VoiceRoute): string {
  switch (r.kind) {
    case 'task':   return `task → ${r.list}`;
    case 'budget': return `budget → ${r.transaction.type} £${r.transaction.amount.toFixed(2)}`;
    case 'inbox':  return 'inbox';
  }
}
