// CSV statement importer for UK banks. Detects format from the header row,
// uses a bank-specific parser when we recognise the layout, otherwise falls
// back to a generic "date + amount + description" parser that works for
// most exports.
//
// Dedup is done by an externalId that prefixes the bank name onto a stable
// hash of date + amount + description — importing the same file twice
// produces zero new rows.

import type { OneOffTransaction } from './types';

export type BankFormat =
  | 'monzo' | 'lloyds' | 'revolut' | 'barclays' | 'natwest' | 'hsbc'
  | 'santander' | 'starling' | 'generic';

export interface ParsedTransaction {
  externalId: string;
  date: number;            // unix ms
  amount: number;          // always positive
  type: 'income' | 'expense';
  description: string;
  category: string;
}

export interface ParseResult {
  format: BankFormat;
  formatLabel: string;
  transactions: ParsedTransaction[];
  errors: string[];
}

// ── Format detection ────────────────────────────────────────────────────────

const FORMAT_LABEL: Record<BankFormat, string> = {
  monzo: 'Monzo',
  lloyds: 'Lloyds',
  revolut: 'Revolut',
  barclays: 'Barclays',
  natwest: 'NatWest',
  hsbc: 'HSBC',
  santander: 'Santander',
  starling: 'Starling',
  generic: 'Generic CSV',
};

function detectFormat(headers: string[]): BankFormat {
  const h = headers.map(x => x.toLowerCase().trim());
  if (h.includes('emoji') && h.includes('transaction id')) return 'monzo';
  if (h.includes('debit amount') && h.includes('credit amount') && h.includes('sort code')) return 'lloyds';
  if (h.includes('started date') && h.includes('completed date') && h.includes('product')) return 'revolut';
  if (h.includes('counter party') && h.includes('reference')) return 'starling';
  if (h.includes('value') && h.includes('balance') && h.some(x => x.includes('account name'))) return 'natwest';
  if (h.includes('memo') && (h.includes('subcategory') || h.includes('account'))) return 'barclays';
  if (h.includes('date') && h.includes('description') && h.includes('amount') && h.length <= 5) return 'hsbc';
  if (h.includes('description') && h.includes('amount') && h.includes('balance') && h.includes('date')) return 'santander';
  return 'generic';
}

// ── CSV row parsing (handles quoted fields with embedded commas) ────────────

function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"') { inQuote = true; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(x => x.trim());
}

function splitCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) };
}

// ── Date + hash helpers ────────────────────────────────────────────────────

function tryParseDate(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  // dd/mm/yyyy  or  dd-mm-yyyy
  const uk = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (uk) {
    const d = parseInt(uk[1], 10);
    const m = parseInt(uk[2], 10) - 1;
    const y = uk[3].length === 2 ? 2000 + parseInt(uk[3], 10) : parseInt(uk[3], 10);
    const ms = new Date(y, m, d).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  // ISO 8601 or other JS-parseable
  const iso = Date.parse(t);
  if (!Number.isNaN(iso)) return iso;
  return null;
}

function hash(s: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function makeId(bank: string, date: number, signed: number, description: string): string {
  const dayKey = new Date(date).toISOString().slice(0, 10);
  const key = `${dayKey}|${signed.toFixed(2)}|${description.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  return `${bank}:${hash(key)}`;
}

// ── Format-specific parsers ────────────────────────────────────────────────

const colIdx = (headers: string[], name: string) =>
  headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase());

function parseMonzo(headers: string[], rows: string[][]): ParsedTransaction[] {
  const iDate = colIdx(headers, 'Date');
  const iAmount = colIdx(headers, 'Amount');
  const iName = colIdx(headers, 'Name');
  const iDescription = colIdx(headers, 'Description');
  const iCategory = colIdx(headers, 'Category');
  const iTxId = colIdx(headers, 'Transaction ID');
  const iNotes = colIdx(headers, 'Notes and #tags');
  const out: ParsedTransaction[] = [];
  for (const row of rows) {
    const date = tryParseDate(row[iDate]);
    const amount = parseFloat(row[iAmount]);
    if (date == null || !Number.isFinite(amount)) continue;
    const desc = (row[iName] || row[iDescription] || row[iNotes] || 'Transaction').trim();
    const ext = iTxId >= 0 && row[iTxId] ? `monzo:${row[iTxId]}` : makeId('monzo', date, amount, desc);
    out.push({
      externalId: ext,
      date,
      amount: Math.abs(amount),
      type: amount >= 0 ? 'income' : 'expense',
      description: desc,
      category: row[iCategory] || 'Other',
    });
  }
  return out;
}

function parseLloyds(headers: string[], rows: string[][]): ParsedTransaction[] {
  const iDate = colIdx(headers, 'Transaction Date');
  const iDesc = colIdx(headers, 'Transaction Description');
  const iDebit = colIdx(headers, 'Debit Amount');
  const iCredit = colIdx(headers, 'Credit Amount');
  const iType = colIdx(headers, 'Transaction Type');
  const out: ParsedTransaction[] = [];
  for (const row of rows) {
    const date = tryParseDate(row[iDate]);
    if (date == null) continue;
    const debit = parseFloat(row[iDebit]) || 0;
    const credit = parseFloat(row[iCredit]) || 0;
    if (debit === 0 && credit === 0) continue;
    const amount = debit > 0 ? debit : credit;
    const signed = debit > 0 ? -debit : credit;
    const desc = (row[iDesc] || row[iType] || 'Transaction').trim();
    out.push({
      externalId: makeId('lloyds', date, signed, desc),
      date, amount,
      type: debit > 0 ? 'expense' : 'income',
      description: desc,
      category: 'Other',
    });
  }
  return out;
}

function parseRevolut(headers: string[], rows: string[][]): ParsedTransaction[] {
  const iDate = colIdx(headers, 'Completed Date') >= 0
    ? colIdx(headers, 'Completed Date')
    : colIdx(headers, 'Started Date');
  const iDesc = colIdx(headers, 'Description');
  const iAmount = colIdx(headers, 'Amount');
  const iState = colIdx(headers, 'State');
  const out: ParsedTransaction[] = [];
  for (const row of rows) {
    if (iState >= 0 && row[iState] && row[iState].toUpperCase() !== 'COMPLETED') continue;
    const date = tryParseDate(row[iDate]);
    const amount = parseFloat(row[iAmount]);
    if (date == null || !Number.isFinite(amount) || amount === 0) continue;
    const desc = (row[iDesc] || 'Transaction').trim();
    out.push({
      externalId: makeId('revolut', date, amount, desc),
      date,
      amount: Math.abs(amount),
      type: amount >= 0 ? 'income' : 'expense',
      description: desc,
      category: 'Other',
    });
  }
  return out;
}

function parseStarling(headers: string[], rows: string[][]): ParsedTransaction[] {
  const iDate = colIdx(headers, 'Date');
  const iAmount = colIdx(headers, 'Amount (GBP)') >= 0
    ? colIdx(headers, 'Amount (GBP)')
    : colIdx(headers, 'Amount');
  const iCounter = colIdx(headers, 'Counter Party');
  const iRef = colIdx(headers, 'Reference');
  const out: ParsedTransaction[] = [];
  for (const row of rows) {
    const date = tryParseDate(row[iDate]);
    const amount = parseFloat(row[iAmount]);
    if (date == null || !Number.isFinite(amount) || amount === 0) continue;
    const desc = (row[iCounter] || row[iRef] || 'Transaction').trim();
    out.push({
      externalId: makeId('starling', date, amount, desc),
      date,
      amount: Math.abs(amount),
      type: amount >= 0 ? 'income' : 'expense',
      description: desc,
      category: 'Other',
    });
  }
  return out;
}

function parseGeneric(headers: string[], rows: string[][]): ParsedTransaction[] {
  const h = headers.map(x => x.toLowerCase().trim());
  const iDate = h.findIndex(x => x.includes('date'));
  const iDesc = h.findIndex(x =>
    x.includes('description') || x.includes('payee') || x.includes('memo') ||
    x.includes('reference') || x.includes('name') || x.includes('details'),
  );
  const iAmount = h.findIndex(x => x === 'amount' || x === 'value' || x.includes('amount'));
  const iDebit = h.findIndex(x => x.includes('debit'));
  const iCredit = h.findIndex(x => x.includes('credit'));

  if (iDate < 0) return [];
  if (iAmount < 0 && (iDebit < 0 || iCredit < 0)) return [];

  const out: ParsedTransaction[] = [];
  for (const row of rows) {
    const date = tryParseDate(row[iDate]);
    if (date == null) continue;
    let signed: number;
    if (iAmount >= 0) {
      const a = parseFloat(row[iAmount]);
      if (!Number.isFinite(a) || a === 0) continue;
      signed = a;
    } else {
      const debit = parseFloat(row[iDebit]) || 0;
      const credit = parseFloat(row[iCredit]) || 0;
      if (debit === 0 && credit === 0) continue;
      signed = credit > 0 ? credit : -debit;
    }
    const desc = (iDesc >= 0 ? row[iDesc] : 'Transaction').trim();
    out.push({
      externalId: makeId('generic', date, signed, desc),
      date,
      amount: Math.abs(signed),
      type: signed >= 0 ? 'income' : 'expense',
      description: desc || 'Transaction',
      category: 'Other',
    });
  }
  return out;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function parseStatementCSV(text: string): ParseResult {
  const { headers, rows } = splitCsv(text);
  if (headers.length === 0) {
    return { format: 'generic', formatLabel: 'Empty file', transactions: [], errors: ['No data in file'] };
  }
  const format = detectFormat(headers);
  let transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  try {
    switch (format) {
      case 'monzo':    transactions = parseMonzo(headers, rows); break;
      case 'lloyds':   transactions = parseLloyds(headers, rows); break;
      case 'revolut':  transactions = parseRevolut(headers, rows); break;
      case 'starling': transactions = parseStarling(headers, rows); break;
      default:         transactions = parseGeneric(headers, rows);
    }
  } catch (e) {
    errors.push(String(e));
  }
  if (transactions.length === 0 && errors.length === 0) {
    errors.push('Could not extract any transactions. Check the file format.');
  }
  return { format, formatLabel: FORMAT_LABEL[format], transactions, errors };
}

/** Filter the parsed list to only rows that don't already exist in budget. */
export function findNewTransactions(
  parsed: ParsedTransaction[],
  existing: OneOffTransaction[],
): { newOnes: ParsedTransaction[]; duplicates: number } {
  const seen = new Set<string>();
  for (const t of existing) {
    if (t.externalId) seen.add(t.externalId);
  }
  const newOnes: ParsedTransaction[] = [];
  let duplicates = 0;
  for (const p of parsed) {
    if (seen.has(p.externalId)) { duplicates++; continue; }
    seen.add(p.externalId);
    newOnes.push(p);
  }
  return { newOnes, duplicates };
}

/** Convert parsed rows into OneOffTransaction shape for merging. */
export function toBudgetTransactions(
  parsed: ParsedTransaction[],
  sourceLabel: string,
): OneOffTransaction[] {
  return parsed.map((p, i) => ({
    id: Date.now() + i,
    date: p.date,
    amount: p.amount,
    category: p.category,
    type: p.type,
    note: p.description,
    externalId: p.externalId,
    source: sourceLabel,
  }));
}
