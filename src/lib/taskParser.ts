/**
 * taskParser — local, offline task extraction from voice transcripts.
 *
 * No API keys, no network calls, no token costs.
 * Works for any number of users.
 *
 * Pipeline:
 *   1. Split transcript into individual task clauses
 *   2. Clean filler words from each clause
 *   3. Predict topic via keyword scoring (reuses voiceRouter logic)
 *   4. Extract deadline from natural language date phrases
 */

import type { Topic } from './types';

export interface ParsedTask {
  id: string;
  text: string;
  topicId: string | null;
  topicName: string | null;
  topicColor: string | null;
  deadline: number | null;   // unix ms at local midnight, or null
  deadlineLabel: string | null;
}

// ── 1. Transcript splitting ────────────────────────────────────────────────────

/**
 * Action verbs that, when they follow a bare "and" / "then" / "also" / comma,
 * signal a NEW task rather than a continuation of the current one. This is the
 * cheap, offline stand-in for an LLM "understanding intent": we split
 *   "call Adrien and buy strings"   → ["call Adrien", "buy strings"]   (verb)
 * but leave a trailing noun object alone:
 *   "book a hotel and flight"       → ["book a hotel and flight"]      (noun)
 *   "buy milk and eggs"             → ["buy milk and eggs"]            (noun)
 * The gate is the verb itself — a determiner ("and a coffee", "and the dog")
 * or noun ("and eggs") never matches, which is what keeps over-splitting in check.
 */
const ACTION_VERB = '(?:call|phone|ring|text|email|message|contact|ping|reply|' +
  'buy|order|purchase|get|grab|pick|collect|fetch|renew|cancel|return|' +
  'book|reserve|schedule|arrange|plan|organise|organize|set|sort|file|' +
  'pay|send|transfer|refund|charge|split|' +
  'finish|start|complete|do|make|build|create|write|draft|read|review|' +
  'check|submit|prepare|prep|print|sign|update|edit|fix|test|deploy|commit|push|install|download|upload|' +
  'clean|tidy|wash|cook|water|walk|feed|empty|fill|drop|take|bring|put|move|pack|unpack|hang|' +
  'meet|see|visit|ask|tell|remind|invite|thank|follow|' +
  'apply|register|confirm|research|study|learn|revise|practice|practise|watch|listen|' +
  'find|search|look|add|remove|delete|change|go)';

/**
 * Splits a raw voice transcript into individual task clauses.
 *
 * Handles patterns like:
 *   "I need to book a hotel for Nice and I also need to meet Adrien"
 *   → ["book a hotel for Nice", "meet Adrien"]
 */
export function splitIntoTasks(transcript: string): string[] {
  // Normalise: trim and collapse whitespace
  let text = transcript.trim().replace(/\s+/g, ' ');

  // Remove trailing "you said that" artefacts
  text = text.replace(/\.\s*you said that\.?$/i, '').trim();

  // 1. Split on hard sentence boundaries (. ! ?) — handles both "Hello. World"
  //    and "Hello.World" (no space) by requiring an uppercase letter after.
  const sentences = text
    .split(/(?<=[.!?])\s*(?=[A-Z])/)
    .map(s => s.trim())
    .filter(Boolean);

  const rawClauses: string[] = [];

  for (const sentence of sentences) {
    // 2. Within each sentence, split on transition markers that indicate
    //    a NEW task starting.
    const VERB = '(?:need\\s+to|want\\s+to|have\\s+to|should|must|will|am\\s+going\\s+to|gotta|got\\s+to)';
    const parts = sentence.split(
      new RegExp(
        `,?\\s+and\\s+then(?:\\s+I(?:\\s+${VERB})?)?` +          // "and then [I [need to]]"
        `|,?\\s+then\\s+I(?:\\s+${VERB})?` +                     // ", then I [need to]"
        `|,?\\s+and\\s+I(?:\\s+also)?(?:\\s+${VERB})?` +         // "and I [also] [need to]"
        `|,?\\s+I\\s+(?:then\\s+)?also(?:\\s+${VERB})?` +        // "I [then] also [need to]"
        `|,\\s+I\\s+${VERB}` +                                    // ", I need to" — comma + subject + verb
        `|,?\\s+also\\s+I` +
        `|,?\\s+additionally` +
        // Bare conjunction / comma immediately followed by an action verb — split
        // only when a verb starts the next clause (lookahead keeps the verb).
        `|,?\\s+and\\s+(?=${ACTION_VERB}\\b)` +                  // "… and buy strings"
        `|,?\\s+then\\s+(?=${ACTION_VERB}\\b)` +                 // "… then call mum"
        `|,?\\s+also\\s+(?=${ACTION_VERB}\\b)` +                 // "… also email landlord"
        `|,\\s+(?=${ACTION_VERB}\\b)`,                            // "call Adrien, buy strings"
        'i'
      ),
    );

    for (const part of parts) {
      const trimmed = part.trim().replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
      if (trimmed) rawClauses.push(trimmed);
    }
  }

  // 3. Post-split pass: merge fragments and filter noise.
  // Standalone words/phrases that are never tasks on their own.
  const NOISE_EXACT = new Set([
    'ok','okay','right','so','well','anyway','alright','yeah','yep','yes','no',
    'before','after','earlier','later','then','also','and','but','however',
    'um','uh','er','hmm','oh','ah','hey','hi',
  ]);

  // Sentence-level noise patterns (whole clause is useless)
  const NOISE_PATTERN = /^(?:that(?:'s|\s+is)\s+(?:very\s+)?important|this\s+is\s+(?:very\s+)?important|i\s+(?:really\s+)?need\s+to\s+do\s+this|(?:that\s+)?(?:is\s+)?very\s+important|(?:super\s+)?important|please\s+remind\s+me|(?:ok\s+)?so\s+yeah|and\s+that(?:'s|\s+is)\s+it|that(?:'s|\s+is)\s+all|you\s+know|urgent(?:ly)?|asap|etc\.?)\.?$/i;

  const clauses: string[] = [];
  for (const clause of rawClauses) {
    const lower = clause.trim().toLowerCase().replace(/[.!?,]+$/, '');

    // Single-word or known-noise exact match
    if (NOISE_EXACT.has(lower)) continue;
    if (NOISE_PATTERN.test(clause.trim())) continue;

    // Prepositional fragment starting with "In/At/With/On" (≤5 words, no verb)
    // e.g. "In Ableton", "At the gym" — merge into previous task as context
    const PREP_FRAGMENT = /^(?:in|at|with|on|via|using|through)\s+\S/i;
    if (PREP_FRAGMENT.test(clause) && clause.trim().split(/\s+/).length <= 5 && clauses.length > 0) {
      clauses[clauses.length - 1] += ' ' + clause.trim();
      continue;
    }

    // "To [verb]…" context phrase — merge into previous task
    if (/^to\s+[a-z]/i.test(clause) && clauses.length > 0) {
      clauses[clauses.length - 1] += '. ' + clause;
      continue;
    }

    // Pure date sentence (e.g. "On the 5th of June") — attach deadline to previous
    const dl = extractDeadline(clause);
    if (dl) {
      const stripped = stripDeadlinePhrase(clause, dl.strip).replace(/\bon\b|\bby\b|\bfor\b/gi, '').trim();
      if (stripped.length < 3 && clauses.length > 0) {
        clauses[clauses.length - 1] += ', ' + clause;
        continue;
      }
    }

    clauses.push(clause);
  }

  // Fall back to original text if nothing split
  return clauses.length > 0 ? clauses : [text];
}

// ── 2. Filler word removal ─────────────────────────────────────────────────────

const FILLER_PREFIXES = [
  // Discourse starters: "OK so", "so I", "right so", "and then", "so basically"
  /^(?:(?:ok(?:ay)?|right|so|well|alright)\s+)+(?:so\s+|then\s+|basically\s+|actually\s+)?/i,
  /^(?:and\s+then\s+|and\s+also\s+)/i,
  // Bare leading conjunction before a subject/verb: "And I need to call" → "I need
  // to call" (the subject+verb stripper below then finishes the job). Sentence
  // splitting can leave these at the head of a clause when a ramble runs on.
  /^(?:and|but|plus)\s+(?=i\b|i'|we\b|to\b|the\b|a\b|my\b)/i,
  // Subject + verb helpers: "I need to", "I want to", etc.
  /^(?:i\s+)?(?:also\s+)?(?:need\s+to|want\s+to|have\s+to|gotta|got\s+to|should|must|will|am\s+going\s+to|gonna)\s+/i,
  /^(?:remind\s+me\s+to|don'?t\s+forget\s+to|remember\s+to|make\s+sure\s+to)\s+/i,
  /^(?:i\s+)?(?:also\s+)?(?:would\s+like\s+to|plan\s+to|intend\s+to)\s+/i,
  /^(?:add\s+(?:a\s+)?(?:task|todo|reminder)\s+(?:to\s+)?(?:for\s+)?)\s*/i,
  /^(?:todo|task|note|reminder)[:\s]+/i,
  // Bare "To [lowercase verb]" prefix: "To buy apples" → "Buy apples"
  /^to\s+(?=[a-z])/,
];

export function cleanTaskText(raw: string): string {
  let text = raw.trim();
  let prev = '';
  // Apply prefix strippers repeatedly until stable
  while (text !== prev) {
    prev = text;
    for (const re of FILLER_PREFIXES) {
      text = text.replace(re, '');
    }
    text = text.trim();
  }
  // Capitalise first letter
  if (text.length > 0) text = text[0].toUpperCase() + text.slice(1);
  return text;
}

// ── 3. Topic scoring (same heuristics as voiceRouter) ─────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  music:     ['guitar', 'piano', 'bass', 'drum', 'song', 'chord', 'scale', 'gig', 'rehearsal', 'band', 'track', 'album', 'studio', 'record'],
  work:      ['meeting', 'deadline', 'project', 'client', 'office', 'presentation', 'report', 'colleague', 'manager', 'email', 'call', 'zoom', 'contract', 'invoice'],
  fitness:   ['gym', 'workout', 'exercise', 'run', 'lift', 'weights', 'cardio', 'training', 'class', 'yoga', 'pilates', 'swim'],
  travel:    ['hotel', 'flight', 'trip', 'holiday', 'vacation', 'airbnb', 'hostel', 'train', 'passport', 'visa', 'pack', 'luggage', 'airport'],
  social:    ['meet', 'dinner', 'lunch', 'coffee', 'drinks', 'catch', 'call', 'friend', 'birthday', 'party', 'invite', 'visit', 'see'],
  finance:   ['pay', 'bill', 'transfer', 'bank', 'money', 'rent', 'insurance', 'tax', 'invoice', 'refund', 'subscription'],
  health:    ['doctor', 'dentist', 'appointment', 'prescription', 'medication', 'hospital', 'physio', 'therapist', 'checkup'],
  shopping:  ['buy', 'order', 'purchase', 'shop', 'groceries', 'store', 'supermarket', 'amazon', 'online', 'delivery'],
  home:      ['clean', 'tidy', 'fix', 'repair', 'washing', 'laundry', 'dishes', 'vacuum', 'cook', 'garden'],
  study:     ['study', 'read', 'research', 'learn', 'course', 'lecture', 'essay', 'assignment', 'exam', 'revision'],
  code:      ['code', 'bug', 'feature', 'deploy', 'test', 'debug', 'pr', 'commit', 'review', 'api', 'database', 'frontend', 'backend'],
  cv:        ['cv', 'resume', 'interview', 'linkedin', 'portfolio', 'cover letter', 'application', 'apply', 'applying'],
  job:       ['job', 'interview', 'application', 'cv', 'resume', 'linkedin', 'hiring', 'apply', 'applying', 'cover letter'],
  career:    ['cv', 'resume', 'interview', 'linkedin', 'portfolio', 'application', 'cover letter', 'career', 'apply'],
};

function topicScore(text: string, topic: Topic): number {
  const words = text.toLowerCase().split(/\W+/);
  const nameWords = topic.name.toLowerCase().split(/\W+/);
  const userKeywords = (topic.keywords ?? []).map(k => k.toLowerCase());

  let score = 0;

  // Exact topic name word match (strong signal)
  for (const nw of nameWords) {
    if (nw.length < 2) continue;
    if (words.includes(nw)) score += 4;
  }

  // User-defined manual keywords (strongest signal)
  for (const kw of userKeywords) {
    if (text.toLowerCase().includes(kw)) score += 6;
  }

  // Description-derived keywords (comma/semicolon-separated terms user wrote)
  if (topic.description) {
    const descTerms = topic.description
      .split(/[,;]/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 2);
    for (const term of descTerms) {
      if (text.toLowerCase().includes(term)) score += 3;
    }
  }

  // Semantic domain expansion
  for (const nw of nameWords) {
    const expansions = DOMAIN_KEYWORDS[nw] ?? [];
    for (const ex of expansions) {
      if (text.toLowerCase().includes(ex)) score += 1;
    }
  }

  // Also check all domain entries whose key appears in topic name
  for (const [key, expansions] of Object.entries(DOMAIN_KEYWORDS)) {
    if (topic.name.toLowerCase().includes(key)) {
      for (const ex of expansions) {
        if (text.toLowerCase().includes(ex)) score += 1;
      }
    }
  }

  return score;
}

/**
 * Predicts the best-matching topic for a piece of text, scored against
 * whatever topics currently exist. Always re-run this against the live
 * topics list rather than caching the result — a topic created after a
 * Quicks item was captured should still be predictable for it.
 */
export function predictTopic(text: string, topics: Topic[]): Topic | null {
  if (topics.length === 0) return null;
  let best: Topic | null = null;
  let bestScore = 1; // minimum threshold
  for (const topic of topics) {
    const s = topicScore(text, topic);
    if (s > bestScore) { best = topic; bestScore = s; }
  }
  return best;
}

// ── 4. Deadline extraction + phrase stripping ─────────────────────────────────

/**
 * Deadline result includes the regex that matched the date phrase so we can
 * strip it from the task text afterwards.
 */
type DeadlineResult = { label: string; date: Date; strip: RegExp } | null;

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

const PREP = '(?:on|by|for|until|before)?\\s*';      // optional leading preposition
const THE  = '(?:the\\s+)?';                          // optional "the"

function nextWeekday(dayIndex: number): Date {
  const now = new Date();
  const result = new Date(now);
  result.setHours(0, 0, 0, 0);
  const diff = (dayIndex - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + (diff === 0 ? 7 : diff));
  return result;
}

function startOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}

function extractDeadline(text: string): DeadlineResult {
  const t = text.toLowerCase();
  const now = new Date();

  // "today" / "tonight"
  if (/\btoday\b|\btonight\b/.test(t))
    return { label: 'today', date: startOfDay(now), strip: /,?\s*\b(?:on\s+)?tonight?\b/gi };

  // "tomorrow"
  if (/\btomorrow\b/.test(t)) {
    const d = startOfDay(now); d.setDate(d.getDate() + 1);
    return { label: 'tomorrow', date: d, strip: /,?\s*\b(?:by\s+|for\s+)?tomorrow\b/gi };
  }

  // "this weekend" / "the weekend"
  if (/\b(?:this\s+)?weekend\b/.test(t)) {
    const d = nextWeekday(6);
    return { label: 'this weekend', date: d, strip: /,?\s*\b(?:on\s+|by\s+)?(?:this\s+)?weekend\b/gi };
  }

  // "next week"
  if (/\bnext\s+week\b/.test(t)) {
    const d = startOfDay(now); d.setDate(d.getDate() + 7);
    return { label: 'next week', date: d, strip: /,?\s*\bnext\s+week\b/gi };
  }

  // "the Nth of [month]" — e.g. "on the 4th of June"
  for (let mi = 0; mi < MONTHS.length; mi++) {
    const re = new RegExp(
      `${PREP}${THE}(\\d{1,2})(?:st|nd|rd|th)?\\s+of\\s+${MONTHS[mi]}\\b`, 'i'
    );
    const m = t.match(re);
    if (m) {
      const day = parseInt(m[1], 10);
      const year = now.getMonth() > mi || (now.getMonth() === mi && now.getDate() > day)
        ? now.getFullYear() + 1 : now.getFullYear();
      const stripRe = new RegExp(
        `,?\\s*${PREP}${THE}\\d{1,2}(?:st|nd|rd|th)?\\s+of\\s+${MONTHS[mi]}\\b`, 'gi'
      );
      return { label: `${MONTHS[mi]} ${day}`, date: new Date(year, mi, day), strip: stripRe };
    }
  }

  // "[month] [day]th" — e.g. "by June 15" / "June 15th" / "on the 4th June"
  for (let mi = 0; mi < MONTHS.length; mi++) {
    const re = new RegExp(
      `${PREP}${MONTHS[mi]}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b|${PREP}${THE}(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTHS[mi]}\\b`, 'i'
    );
    const m = t.match(re);
    if (m) {
      const day = parseInt(m[1] ?? m[2], 10);
      const year = now.getMonth() > mi || (now.getMonth() === mi && now.getDate() > day)
        ? now.getFullYear() + 1 : now.getFullYear();
      const stripRe = new RegExp(
        `,?\\s*${PREP}(?:${MONTHS[mi]}\\s+\\d{1,2}(?:st|nd|rd|th)?|${THE}\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTHS[mi]})\\b`, 'gi'
      );
      return { label: `${MONTHS[mi]} ${day}`, date: new Date(year, mi, day), strip: stripRe };
    }
  }

  // "next [weekday]" / "on [weekday]" / "this [weekday]"
  for (let i = 0; i < DAYS.length; i++) {
    const re = new RegExp(`\\b(?:(next|this)\\s+)?${DAYS[i]}\\b`);
    if (re.test(t)) {
      const d = nextWeekday(i);
      const stripRe = new RegExp(`,?\\s*\\b(?:on\\s+|by\\s+)?(?:next\\s+|this\\s+)?${DAYS[i]}\\b`, 'gi');
      return { label: DAYS[i], date: d, strip: stripRe };
    }
  }

  // "in X days / weeks / months"
  const inMatch = t.match(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|days|week|weeks|month|months)\b/);
  if (inMatch) {
    const numStr = inMatch[1];
    const unit = inMatch[2];
    const num = ({ a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10 } as Record<string,number>)[numStr] ?? parseInt(numStr, 10);
    const d = startOfDay(now);
    if (unit.startsWith('day')) d.setDate(d.getDate() + num);
    else if (unit.startsWith('week')) d.setDate(d.getDate() + num * 7);
    else d.setMonth(d.getMonth() + num);
    const phrase = inMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { label: inMatch[0], date: d, strip: new RegExp(`,?\\s*${phrase}`, 'gi') };
  }

  // "end of [month]"
  const eomMatch = t.match(/\bend\s+of\s+(this\s+month|(?:january|february|march|april|may|june|july|august|september|october|november|december))\b/);
  if (eomMatch) {
    const monthStr = eomMatch[1];
    let mi = monthStr === 'this month' ? now.getMonth() : MONTHS.indexOf(monthStr);
    if (mi < 0) mi = now.getMonth();
    const d = new Date(now.getFullYear(), mi + 1, 0);
    const phrase = eomMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { label: eomMatch[0], date: d, strip: new RegExp(`,?\\s*${phrase}`, 'gi') };
  }

  return null;
}

/** Strip the matched deadline phrase from a task text. */
function stripDeadlinePhrase(text: string, strip: RegExp): string {
  return text.replace(strip, '').replace(/\s{2,}/g, ' ').replace(/[,\s]+$/, '').trim();
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function parseVoiceTasks(transcript: string, topics: Topic[]): ParsedTask[] {
  const clauses = splitIntoTasks(transcript);

  return clauses
    .map((clause, i) => {
      const rawText = cleanTaskText(clause);
      if (rawText.length < 3) return null;

      const dl = extractDeadline(rawText);
      // Strip the date phrase so it only lives in the deadline field
      const text = dl ? stripDeadlinePhrase(rawText, dl.strip) : rawText;
      const cleanedText = text.length >= 3 ? text : rawText; // fallback if strip went too far

      const topic = predictTopic(cleanedText, topics);

      return {
        id: `voice-${Date.now()}-${i}`,
        text: cleanedText,
        topicId: topic?.id ?? null,
        topicName: topic?.name ?? null,
        topicColor: topic?.color ?? null,
        deadline: dl ? dl.date.getTime() : null,
        deadlineLabel: dl ? dl.label : null,
      };
    })
    .filter((t): t is ParsedTask => t !== null);
}
