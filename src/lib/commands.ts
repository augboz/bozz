/**
 * commands — the Ctrl+K command palette's ACTION layer.
 *
 * Turns a typed line into an executable action that runs through engines the
 * Dashboard already owns (addTopicItem, addDeadline, addToInbox, routeVoice,
 * the budget setter, predictTopic, parseVoiceTasks, setActiveSection). Pure
 * parsing here; the actual side-effects are supplied by the host via CommandDeps
 * so this module stays testable and side-effect free.
 *
 * Recognised verbs (all optional — plain text still falls through to jump-only):
 *   add task <text> [> Topic] [friday]   → addTopicItem / addToInbox (predicted)
 *   deadline <text> friday               → addDeadline (date parsed from text)
 *   expense 12 coffee  /  spent 12 …     → routeVoice → budget setter
 *   income 1200 salary                   → routeVoice → budget setter
 *   start pomodoro                       → onStartPomodoro
 *   go to <topic/section>                → setActiveSection
 *   file all predicted                   → onFileAllPredicted (triage Quicks)
 */

import type { Topic, OneOffTransaction } from './types';
import { parseVoiceTasks, predictTopic } from './taskParser';
import { routeVoice } from './voiceRouter';

export interface CommandDeps {
  topics: Topic[];
  /** Section/topic ids that "go to" can navigate to, with display labels. */
  navTargets: Array<{ id: string; label: string }>;
  addTopicItem: (topicId: string, text: string, deadline: number | null) => void;
  addDeadline?: (text: string, deadline: number | null) => void;
  addToInbox: (text: string, deadline: number | null) => void;
  addTransaction: (tx: OneOffTransaction) => void;
  setActiveSection: (id: string) => void;
  /** Start a focus timer. Optional — omitted when no pomodoro surface is around. */
  onStartPomodoro?: () => void;
  /** File every predicted Quicks item into its predicted topic. Optional. */
  onFileAllPredicted?: () => void;
}

export interface CommandAction {
  id: string;
  /** Short verb-style label, e.g. "Add task". */
  label: string;
  /** What it will do, e.g. "Stats essay → Study · friday". */
  detail: string;
  /** Lucide icon name hint (resolved in the modal). */
  icon: 'plus' | 'flag' | 'wallet' | 'timer' | 'arrow' | 'inbox';
  run: () => void;
}

/** Strip a leading verb phrase (and optional filler) from a query. */
function after(q: string, re: RegExp): string | null {
  const m = q.match(re);
  return m ? q.slice(m[0].length).trim() : null;
}

/** Parse an inline "> Topic" suffix, returning the topic + the cleaned text. */
function splitExplicitTopic(text: string, topics: Topic[]): { text: string; topic: Topic | null } {
  const m = text.match(/\s*>\s*([^>]+)$/);
  if (!m) return { text: text.trim(), topic: null };
  const name = m[1].trim().toLowerCase();
  const topic = topics.find(tp => tp.name.trim().toLowerCase() === name)
    ?? topics.find(tp => tp.name.trim().toLowerCase().startsWith(name))
    ?? null;
  return { text: text.slice(0, m.index).trim(), topic };
}

/**
 * Match a typed query to executable actions. Returns the actions that apply
 * (usually 0 or 1), most-specific first. Plain text with no recognised verb
 * returns an empty list so the modal falls back to jump-only results.
 */
export function matchCommands(raw: string, deps: CommandDeps): CommandAction[] {
  const q = raw.trim();
  if (q.length < 2) return [];
  const lo = q.toLowerCase();
  const out: CommandAction[] = [];

  // ── start pomodoro ──────────────────────────────────────────────────────────
  if (/^(?:start\s+)?(?:a\s+)?pomodoro$|^start\s+focus$|^focus$/.test(lo)) {
    if (deps.onStartPomodoro) {
      out.push({
        id: 'cmd:pomodoro', label: 'Start pomodoro', detail: '25-minute focus block',
        icon: 'timer', run: () => deps.onStartPomodoro!(),
      });
    }
    return out;
  }

  // ── file all predicted ──────────────────────────────────────────────────────
  if (/^file\s+all(?:\s+predicted)?$/.test(lo)) {
    if (deps.onFileAllPredicted) {
      out.push({
        id: 'cmd:fileall', label: 'File all predicted', detail: 'Triage Quicks into predicted topics',
        icon: 'inbox', run: () => deps.onFileAllPredicted!(),
      });
    }
    return out;
  }

  // ── go to <topic/section> ───────────────────────────────────────────────────
  const navText = after(lo, /^(?:go\s+to|open|jump\s+to|nav(?:igate)?\s+to)\s+/);
  if (navText != null && navText.length > 0) {
    const target = deps.navTargets.find(n => n.label.toLowerCase() === navText)
      ?? deps.navTargets.find(n => n.label.toLowerCase().startsWith(navText))
      ?? deps.navTargets.find(n => n.label.toLowerCase().includes(navText));
    if (target) {
      out.push({
        id: `cmd:goto:${target.id}`, label: 'Go to', detail: target.label,
        icon: 'arrow', run: () => deps.setActiveSection(target.id),
      });
    }
    return out;
  }

  // ── expense / income (money) ────────────────────────────────────────────────
  // "expense 12 coffee", "income 1200 salary", or any money-shaped phrase.
  const expenseBody = after(lo, /^(?:expense|spent|spend|paid|bought)\s+/);
  const incomeBody = after(lo, /^(?:income|earned|got\s+paid|received)\s+/);
  if (expenseBody != null || incomeBody != null) {
    const body = (expenseBody ?? incomeBody) as string;
    // Pull leading "<amount> <category>" so the category drops the amount + verb
    // (routeVoice's category extractor keys off "on/for/at", which a bare
    // "expense 12 coffee" lacks). Re-form as "spent <amount> on <category>" so
    // the existing budget parsing produces a clean category.
    const m = body.match(/^[£$€]?\s*(\d+(?:\.\d{1,2})?)\s*(.*)$/);
    const amountStr = m ? m[1] : '';
    const category = (m ? m[2] : body).trim();
    const verb = expenseBody != null ? 'spent' : 'earned';
    const phrase = category
      ? `${verb} ${amountStr} on ${category}`
      : `${verb} ${body}`;
    const route = routeVoice(phrase, deps.topics);
    if (route.kind === 'budget') {
      const tx = route.transaction;
      out.push({
        id: 'cmd:budget', label: tx.type === 'income' ? 'Log income' : 'Log expense',
        detail: `${tx.category} · ${tx.amount}`,
        icon: 'wallet', run: () => deps.addTransaction(tx),
      });
      return out;
    }
  }

  // ── deadline <text> <date> ──────────────────────────────────────────────────
  const deadlineBody = after(lo === q ? q : raw.trim(), /^deadline\s+/i);
  if (deadlineBody != null && deadlineBody.length > 0) {
    const parsed = parseVoiceTasks(deadlineBody, deps.topics)[0] ?? null;
    const text = parsed?.text?.trim() || deadlineBody;
    const deadline = parsed?.deadline ?? null;
    const label = parsed?.deadlineLabel ? ` · ${parsed.deadlineLabel}` : '';
    if (deps.addDeadline) {
      out.push({
        id: 'cmd:deadline', label: 'Add deadline', detail: `${text}${label}`,
        icon: 'flag', run: () => deps.addDeadline!(text, deadline),
      });
    }
    return out;
  }

  // ── add task <text> [> Topic] [date] ────────────────────────────────────────
  const taskBody = after(raw.trim(), /^(?:add\s+task|task|todo|add\s+todo|add)\s+/i);
  if (taskBody != null && taskBody.length > 0) {
    const { text: withoutTopic, topic: explicit } = splitExplicitTopic(taskBody, deps.topics);
    const parsed = parseVoiceTasks(withoutTopic, deps.topics)[0] ?? null;
    const cleanText = parsed?.text?.trim() || withoutTopic;
    const deadline = parsed?.deadline ?? null;
    const dateLabel = parsed?.deadlineLabel ? ` · ${parsed.deadlineLabel}` : '';
    const topic = explicit ?? predictTopic(cleanText, deps.topics);
    if (topic) {
      out.push({
        id: 'cmd:addtask', label: 'Add task', detail: `${cleanText} → ${topic.name}${dateLabel}`,
        icon: 'plus', run: () => deps.addTopicItem(topic.id, cleanText, deadline),
      });
    } else {
      out.push({
        id: 'cmd:addtask', label: 'Add task', detail: `${cleanText} → Quicks${dateLabel}`,
        icon: 'inbox', run: () => deps.addToInbox(cleanText, deadline),
      });
    }
    return out;
  }

  return out;
}
