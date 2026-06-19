/**
 * voiceRouter — automatically routes a voice transcript to the right
 * destination without the user ever setting keywords manually.
 *
 * Priority:
 *   1. Budget (money signals — currency / spend / earn words)
 *   2. User-defined topics  — scored by:
 *        a. exact topic-name words in the transcript
 *        b. semantic expansions of topic-name words (see DOMAIN_KEYWORDS)
 *        c. user's optional manual keywords (extra bonus weight)
 *   3. Inbox (fallback)
 */

import type { Topic, TopicItem, OneOffTransaction, TransactionType } from './types';

// ── Public route types ────────────────────────────────────────────────────────

export type VoiceRoute =
  | { kind: 'topic';  topicId: string; topicName: string; item: TopicItem }
  | { kind: 'budget'; transaction: OneOffTransaction }
  | { kind: 'inbox';  text: string };

// ── Semantic expansion dictionary ─────────────────────────────────────────────
// Keyed by lowercased words that might appear in a topic name.
// Values are related words that, when spoken, should route to that topic.
// Deliberately skews towards words unique to a domain so we don't
// accidentally route unrelated things.

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  music:     ['guitar', 'piano', 'bass', 'drum', 'song', 'chord', 'scale', 'gig', 'rehearsal', 'band', 'melody', 'lyric', 'track', 'album'],
  guitar:    ['guitar', 'chord', 'scale', 'riff', 'strum', 'tab', 'fret', 'pick', 'arpeggio', 'capo'],
  piano:     ['piano', 'keys', 'chord', 'scale', 'piece', 'sheet', 'octave'],
  drums:     ['drums', 'drum', 'beat', 'snare', 'kick', 'hi-hat', 'rhythm', 'groove'],
  singing:   ['singing', 'vocals', 'voice', 'pitch', 'breath', 'song', 'choir'],
  work:      ['work', 'meeting', 'deadline', 'project', 'client', 'office', 'presentation', 'report', 'colleague', 'manager'],
  job:       ['job', 'interview', 'application', 'cv', 'resume', 'linkedin', 'hiring', 'apply', 'cover letter'],
  career:    ['cv', 'resume', 'interview', 'linkedin', 'portfolio', 'application', 'cover letter', 'career'],
  cv:        ['cv', 'resume', 'interview', 'linkedin', 'portfolio', 'cover letter', 'application'],
  fitness:   ['gym', 'workout', 'exercise', 'run', 'lift', 'weights', 'cardio', 'training', 'reps', 'sets'],
  gym:       ['gym', 'workout', 'lift', 'weights', 'squat', 'bench', 'deadlift', 'rep', 'set', 'protein'],
  run:       ['run', 'running', 'jog', 'mile', 'pace', 'marathon', 'sprint', '5k', '10k'],
  running:   ['run', 'running', 'jog', 'mile', 'pace', 'marathon', 'sprint', '5k', '10k'],
  sport:     ['practice', 'training', 'match', 'game', 'team', 'coach', 'tournament', 'league'],
  study:     ['study', 'lecture', 'assignment', 'essay', 'exam', 'revision', 'notes', 'tutorial', 'homework'],
  uni:       ['university', 'lecture', 'assignment', 'essay', 'exam', 'module', 'seminar', 'coursework', 'dissertation'],
  university:['lecture', 'assignment', 'essay', 'exam', 'module', 'seminar', 'coursework', 'dissertation'],
  college:   ['lecture', 'assignment', 'essay', 'exam', 'class', 'professor', 'coursework'],
  school:    ['school', 'homework', 'assignment', 'class', 'teacher', 'exam', 'test'],
  health:    ['doctor', 'appointment', 'medication', 'therapy', 'dentist', 'prescription', 'hospital', 'physio'],
  medical:   ['doctor', 'appointment', 'medication', 'prescription', 'hospital', 'clinic'],
  travel:    ['trip', 'flight', 'hotel', 'booking', 'passport', 'visa', 'packing', 'itinerary', 'airbnb'],
  holiday:   ['trip', 'flight', 'hotel', 'booking', 'passport', 'packing', 'itinerary', 'beach'],
  shopping:  ['buy', 'order', 'purchase', 'shop', 'grocery', 'store', 'amazon', 'delivery', 'pick up'],
  groceries: ['grocery', 'supermarket', 'buy', 'milk', 'bread', 'shop', 'food', 'shopping list'],
  finance:   ['savings', 'invest', 'bank', 'bill', 'payment', 'debt', 'pension', 'tax'],
  money:     ['money', 'pay', 'bill', 'savings', 'transfer', 'bank', 'cost'],
  code:      ['code', 'bug', 'feature', 'deploy', 'test', 'debug', 'commit', 'pr', 'branch', 'github'],
  coding:    ['code', 'bug', 'feature', 'deploy', 'test', 'debug', 'programming', 'commit'],
  dev:       ['code', 'bug', 'feature', 'deploy', 'test', 'api', 'backend', 'frontend', 'database'],
  software:  ['code', 'bug', 'feature', 'deploy', 'test', 'api', 'server', 'database'],
  reading:   ['book', 'article', 'read', 'chapter', 'library', 'kindle', 'paper', 'blog'],
  books:     ['book', 'read', 'chapter', 'author', 'library', 'kindle', 'novel'],
  writing:   ['write', 'draft', 'edit', 'article', 'blog', 'essay', 'story', 'chapter', 'proofread'],
  blog:      ['blog', 'write', 'post', 'publish', 'article', 'content', 'draft'],
  social:    ['friend', 'event', 'party', 'meet', 'hangout', 'birthday', 'dinner', 'drinks'],
  cooking:   ['recipe', 'cook', 'bake', 'ingredients', 'meal', 'dinner', 'kitchen', 'oven', 'fridge'],
  baking:    ['bake', 'recipe', 'flour', 'oven', 'cake', 'bread', 'dough', 'cookie'],
  home:      ['clean', 'fix', 'repair', 'chore', 'house', 'garden', 'laundry', 'tidy', 'hoover'],
  house:     ['clean', 'fix', 'repair', 'chore', 'garden', 'laundry', 'tidy', 'paint', 'landlord'],
  research:  ['research', 'paper', 'article', 'study', 'read', 'source', 'citation', 'literature'],
  photo:     ['photo', 'camera', 'shoot', 'edit', 'lightroom', 'print', 'album', 'photograph'],
  photography:['photo', 'camera', 'shoot', 'edit', 'lightroom', 'lens', 'aperture'],
  art:       ['draw', 'paint', 'sketch', 'design', 'create', 'artwork', 'canvas', 'brush'],
  design:    ['design', 'mockup', 'wireframe', 'figma', 'ui', 'ux', 'layout', 'typography'],
  film:      ['movie', 'film', 'watch', 'cinema', 'director', 'scene', 'script', 'video'],
  gaming:    ['game', 'play', 'level', 'quest', 'achievement', 'stream', 'controller'],
  language:  ['vocabulary', 'grammar', 'practice', 'lesson', 'translate', 'duolingo', 'spanish', 'french'],
  project:   ['build', 'launch', 'plan', 'milestone', 'deadline', 'progress', 'feature'],
  startup:   ['build', 'launch', 'mvp', 'pitch', 'investor', 'product', 'market', 'user'],
  side:      ['build', 'launch', 'feature', 'mvp', 'product', 'project', 'deploy'],
  content:   ['video', 'post', 'film', 'edit', 'upload', 'youtube', 'instagram', 'tiktok', 'script'],
  youtube:   ['video', 'film', 'edit', 'upload', 'thumbnail', 'script', 'subscribe'],
  podcast:   ['episode', 'record', 'edit', 'publish', 'interview', 'guest', 'audio'],
  mental:    ['journal', 'meditate', 'therapy', 'breathing', 'mindfulness', 'gratitude', 'mood'],
  meditation:['meditate', 'breathing', 'mindfulness', 'sit', 'calm', 'focus', 'breath'],
  journal:   ['write', 'journal', 'reflect', 'entry', 'diary', 'morning pages'],
  family:    ['family', 'parent', 'mum', 'dad', 'sibling', 'birthday', 'visit', 'call home'],
  garden:    ['garden', 'plant', 'water', 'prune', 'weed', 'soil', 'seeds', 'flowers'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** All lowercased words from a topic name that are longer than 2 chars. */
function nameWords(name: string): string[] {
  return name.toLowerCase().split(/\W+/).filter(w => w.length > 2);
}

/**
 * Derive the full keyword set for a topic automatically from its name,
 * then supplement with any manual keywords the user added.
 */
export function expandTopicKeywords(topic: Pick<Topic, 'name' | 'keywords' | 'description'>): string[] {
  const words = nameWords(topic.name);
  const expanded = new Set<string>([
    ...words,
    ...topic.keywords.map(k => k.toLowerCase()),
  ]);
  for (const w of words) {
    const extra = DOMAIN_KEYWORDS[w];
    if (extra) extra.forEach(k => expanded.add(k));
  }
  if (topic.description) {
    topic.description
      .split(/[,;]/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 2)
      .forEach(term => expanded.add(term));
  }
  return Array.from(expanded);
}

/** Score how strongly a transcript matches a keyword set (0–∞). */
function scoreMatch(lo: string, keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    // Use word-boundary match; multi-word phrases are matched literally
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = kw.includes(' ')
      ? new RegExp(escaped, 'i')
      : new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(lo)) score += 1;
  }
  return score;
}

// ── Budget helpers (unchanged) ────────────────────────────────────────────────

function parseAmount(s: string): number | null {
  const m = s.match(/(?:£|\$|€)\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:pounds?|dollars?|euros?|quid|bucks?|p)\b/i);
  if (m) return parseFloat(m[1] ?? m[2]);
  const n = s.match(/\b(\d+(?:\.\d{1,2})?)\b/);
  return n ? parseFloat(n[1]) : null;
}

function extractCategory(s: string): string {
  const m = s.match(/\b(?:on|for|at)\s+([^.,!?]+?)(?:\s+(?:yesterday|today|tomorrow|last|this|next|to|from)|$)/i);
  if (m) return m[1].trim();
  const words = s.replace(/[.,!?]/g, '').split(/\s+/);
  return words.slice(-Math.min(3, words.length)).join(' ');
}

/** Strip filler-prefixes so the saved task reads naturally. */
function cleanTaskText(s: string): string {
  return s
    .replace(/^(remind me to|i need to|i have to|i must|i should|todo:?|task:?|remember to|don'?t forget to|add(?:\s+a)?\s+task(?:\s+to)?)\s+/i, '')
    .replace(/[.!?]+$/, '')
    .trim();
}

function makeTopicItem(text: string, topic: Topic): TopicItem {
  const firstStage = topic.stages.find(s => !s.done) ?? topic.stages[0];
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    text: text || 'untitled',
    stageId: firstStage?.id ?? '',
    completedAt: null,
    deadline: null,
  };
}

// ── Main router ───────────────────────────────────────────────────────────────

/**
 * Route a voice transcript to the best destination.
 *
 * @param transcript  Raw speech-to-text output
 * @param topics      User's current topic list (used for auto-classification)
 */
export function routeVoice(transcript: string, topics: Topic[] = []): VoiceRoute {
  const t = transcript.trim();
  const lo = t.toLowerCase();
  const cleaned = cleanTaskText(t);

  // ── 1. Budget detection ────────────────────────────────────────────────────
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
      return {
        kind: 'budget',
        transaction: {
          id: Date.now(),
          date: Date.now(),
          amount: parseAmount(t) ?? 0,
          type,
          category: extractCategory(t) || 'misc',
          note: t,
        },
      };
    }
  }

  // ── 2. Topic matching ──────────────────────────────────────────────────────
  if (topics.length > 0) {
    let bestTopic: Topic | null = null;
    let bestScore = 0;

    for (const topic of topics) {
      const keywords = expandTopicKeywords(topic);
      const score = scoreMatch(lo, keywords);

      // Exact topic name match gives a heavy bonus
      const nameLo = topic.name.toLowerCase();
      const nameBonus = lo.includes(nameLo) ? 3 : 0;
      const total = score + nameBonus;

      if (total > bestScore) {
        bestScore = total;
        bestTopic = topic;
      }
    }

    // Require at least 1 keyword match to claim a route
    if (bestTopic && bestScore >= 1) {
      return {
        kind: 'topic',
        topicId: bestTopic.id,
        topicName: bestTopic.name,
        item: makeTopicItem(cleaned, bestTopic),
      };
    }
  }

  // ── 3. Inbox fallback ──────────────────────────────────────────────────────
  return { kind: 'inbox', text: t };
}

/** Human-readable label for the route — shown as feedback on capture. */
export function describeRoute(r: VoiceRoute): string {
  switch (r.kind) {
    case 'topic':  return `→ ${r.topicName}`;
    case 'budget': return `→ budget · ${r.transaction.type} £${r.transaction.amount.toFixed(2)}`;
    case 'inbox':  return '→ inbox';
  }
}
