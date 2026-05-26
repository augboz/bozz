import React, { useState, useMemo } from 'react';
import { X, Plus, Upload } from 'lucide-react';
import { subMonths } from 'date-fns';
import type {
  BudgetData, OneOffTransaction, RecurFrequency, RecurringItem,
  SavingsGoal, TransactionType, Theme,
} from '../../../lib/types';
import { SectionHeader } from '../../shared/ui';
import {
  CATEGORIES, FREQUENCIES, FREQUENCY_LABEL, WEEKDAYS,
  formatMoney, monthTotals, goalProgress, iouTotals,
} from '../../../lib/budget';
import BudgetCharts from './BudgetCharts';
import BankImportModal from './BankImportModal';
import DatePicker from '../../shared/DatePicker';
import ChoicePicker from '../../shared/ChoicePicker';

type Tab = 'overview' | 'recurring' | 'transactions' | 'goals';

const TX_TYPES: Array<{ id: TransactionType; label: string }> = [
  { id: 'expense', label: 'expense' },
  { id: 'income', label: 'income' },
  { id: 'owed-to-me', label: 'owed to me' },
  { id: 'i-owe', label: 'I owe' },
];
const TX_LABEL: Record<TransactionType, string> = {
  expense: 'expense', income: 'income', 'owed-to-me': 'owed to me', 'i-owe': 'I owe',
};

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

interface Props {
  t: Theme;
  budget: BudgetData;
  setBudget: React.Dispatch<React.SetStateAction<BudgetData>>;
}

export default function BudgetView({ t, budget, setBudget }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.5rem 0.7rem', color: t.text, fontSize: '0.82rem',
    fontFamily: 'inherit', outline: 'none', ...extra,
  });
  const btn: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0 0.85rem', color: t.textMuted, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
  };
  const tabBtn = (id: Tab): React.CSSProperties => ({
    background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '0.82rem', padding: '0.5rem 0.9rem', color: tab === id ? t.text : t.textMuted,
    borderBottom: `2px solid ${tab === id ? t.doingAccent : 'transparent'}`, fontWeight: 300,
  });

  return (
    <div>
      <SectionHeader title="Budget" t={t} />

      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: `1px solid ${t.border}`, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {(['overview', 'recurring', 'transactions', 'goals'] as Tab[]).map(id => (
          <button key={id} onClick={() => setTab(id)} style={tabBtn(id)}>
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview t={t} budget={budget} />}
      {tab === 'recurring' && <Recurring t={t} budget={budget} setBudget={setBudget} inp={inp} btn={btn} />}
      {tab === 'transactions' && <Transactions t={t} budget={budget} setBudget={setBudget} inp={inp} btn={btn} />}
      {tab === 'goals' && <Goals t={t} budget={budget} setBudget={setBudget} inp={inp} btn={btn} />}
    </div>
  );
}

function Stat({ label, value, color, t }: { label: string; value: string; color: string; t: Theme }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 200, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.68rem', color: t.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.35rem' }}>
        {label}
      </div>
    </div>
  );
}

function Overview({ t, budget }: { t: Theme; budget: BudgetData }) {
  const now = new Date();
  const cur = monthTotals(budget, now);
  const prev = monthTotals(budget, subMonths(now, 1));
  const netDelta = cur.net - prev.net;
  const iou = iouTotals(budget);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{
        background: t.panel, border: `1px solid ${t.border}`, borderRadius: '12px',
        padding: '1.5rem 1.75rem', display: 'flex', gap: '1rem',
      }}>
        <Stat label="income" value={formatMoney(cur.income, budget.currency)} color={t.doneAccent} t={t} />
        <Stat label="expense" value={formatMoney(cur.expense, budget.currency)} color={t.alert} t={t} />
        <Stat label="net" value={formatMoney(cur.net, budget.currency)} color={cur.net >= 0 ? t.doneAccent : t.alert} t={t} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.82rem', color: t.textMuted }}>vs last month</div>
          <div style={{ fontSize: '0.95rem', color: netDelta >= 0 ? t.doneAccent : t.alert, marginTop: '0.4rem' }}>
            {netDelta >= 0 ? '▲' : '▼'} {formatMoney(Math.abs(netDelta), budget.currency)}
          </div>
        </div>
      </div>

      {(iou.owedToMe > 0 || iou.iOwe > 0) && (
        <div style={{
          background: t.panel, border: `1px solid ${t.border}`, borderRadius: '12px',
          padding: '1rem 1.5rem', display: 'flex', gap: '2rem',
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: t.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>owed to you</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 200, color: t.doneAccent, marginTop: '0.3rem' }}>
              {formatMoney(iou.owedToMe, budget.currency)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: t.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>you owe</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 200, color: t.alert, marginTop: '0.3rem' }}>
              {formatMoney(iou.iOwe, budget.currency)}
            </div>
          </div>
        </div>
      )}

      <BudgetCharts t={t} data={budget} refDate={now} />

      {budget.goals.length > 0 && (
        <div style={{
          background: t.panel, border: `1px solid ${t.border}`, borderRadius: '12px',
          padding: '1.25rem 1.5rem',
        }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: t.textMuted, marginBottom: '1rem' }}>
            Savings goals
          </div>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {budget.goals.map(g => <GoalBar key={g.id} g={g} t={t} currency={budget.currency} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalBar({ g, t, currency }: { g: SavingsGoal; t: Theme; currency: string }) {
  const p = goalProgress(g);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: t.text, marginBottom: '0.35rem' }}>
        <span>{g.name}</span>
        <span style={{ color: t.textMuted }}>
          {formatMoney(p.saved, currency)} / {formatMoney(g.target, currency)} · {p.eta}
        </span>
      </div>
      <div style={{ height: '6px', background: t.bgAlt, borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${p.pct * 100}%`, height: '100%', background: t.doneAccent, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

type FormStyles = {
  inp: (extra?: React.CSSProperties) => React.CSSProperties;
  btn: React.CSSProperties;
};

function CategorySelect({ value, onChange, style }: {
  value: string; onChange: (v: string) => void; style: React.CSSProperties;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style} aria-label="Category">
      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function TypeToggle({ value, onChange, t }: {
  value: TransactionType; onChange: (v: TransactionType) => void; t: Theme;
}) {
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      {(['expense', 'income'] as TransactionType[]).map((o, i) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          style={{
            background: value === o ? t.bgAlt : 'transparent',
            color: value === o ? t.text : t.textMuted,
            border: 'none', borderLeft: i === 0 ? 'none' : `1px solid ${t.border}`,
            padding: '0.45rem 0.8rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Recurring({ t, budget, setBudget, inp, btn }: Props & FormStyles) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');
  const [dow, setDow] = useState(0);
  const [freq, setFreq] = useState<RecurFrequency>('monthly');
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [type, setType] = useState<TransactionType>('expense');
  const [editId, setEditId] = useState<number | null>(null);
  const isWeekly = freq === 'weekly' || freq === 'fortnightly';

  const reset = () => {
    setName(''); setAmount(''); setDay('1'); setDow(0); setFreq('monthly');
    setCat(CATEGORIES[0]); setType('expense'); setEditId(null);
  };

  const submit = () => {
    const a = num(amount);
    const d = Math.min(31, Math.max(1, parseInt(day, 10) || 1));
    if (!name.trim() || a <= 0) return;
    setBudget(b => {
      const item: RecurringItem = {
        id: editId ?? Date.now(), name: name.trim(), amount: a,
        dayOfMonth: d, dayOfWeek: dow, frequency: freq, category: cat, type,
      };
      const recurring = editId != null
        ? b.recurring.map(r => r.id === editId ? item : r)
        : [...b.recurring, item];
      return { ...b, recurring };
    });
    reset();
  };

  const edit = (r: RecurringItem) => {
    setEditId(r.id); setName(r.name); setAmount(String(r.amount));
    setDay(String(r.dayOfMonth)); setDow(r.dayOfWeek ?? 0);
    setFreq(r.frequency ?? 'monthly'); setCat(r.category); setType(r.type);
  };
  const del = (id: number) => setBudget(b => ({ ...b, recurring: b.recurring.filter(r => r.id !== id) }));

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {budget.recurring.map(r => (
        <div key={r.id} style={row(t)}>
          <span style={{ flex: 1, fontSize: '0.88rem', color: t.text }}>{r.name}</span>
          <span style={{ fontSize: '0.72rem', color: t.textMuted }}>
            {FREQUENCY_LABEL[r.frequency ?? 'monthly']}
            {(r.frequency === 'weekly' || r.frequency === 'fortnightly')
              ? ` · ${WEEKDAYS[r.dayOfWeek ?? 0]}`
              : ` · day ${r.dayOfMonth}`}
            {' · '}{r.category}
          </span>
          <span style={{ fontSize: '0.88rem', color: r.type === 'income' ? t.doneAccent : t.alert }}>
            {r.type === 'income' ? '+' : '−'}{formatMoney(r.amount, budget.currency)}
          </span>
          <button onClick={() => edit(r)} style={linkBtn(t)}>edit</button>
          <button onClick={() => del(r.id)} aria-label="Delete" style={iconBtn(t)}><X size={14} strokeWidth={1.5} /></button>
        </div>
      ))}
      {budget.recurring.length === 0 && <Empty t={t} text="no recurring items yet" />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="name" style={inp({ flex: 2, minWidth: '140px' })} />
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="amount" inputMode="decimal" style={inp({ width: '100px' })} />
        <select value={freq} onChange={e => setFreq(e.target.value as RecurFrequency)} aria-label="Frequency" style={inp({ width: '130px' })}>
          {FREQUENCIES.map(f => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
        </select>
        {isWeekly ? (
          <select value={dow} onChange={e => setDow(Number(e.target.value))} aria-label="Day of week" style={inp({ width: '110px' })}>
            {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
          </select>
        ) : (
          <input value={day} onChange={e => setDay(e.target.value)} placeholder="day" inputMode="numeric" style={inp({ width: '70px' })} />
        )}
        <CategorySelect value={cat} onChange={setCat} style={inp({ width: '130px' })} />
        <TypeToggle value={type} onChange={setType} t={t} />
        <button onClick={submit} style={btn}><Plus size={14} strokeWidth={1.5} />{editId != null ? 'save' : 'add'}</button>
        {editId != null && <button onClick={reset} style={btn}>cancel</button>}
      </div>
    </div>
  );
}

function Transactions({ t, budget, setBudget, inp, btn }: Props & FormStyles) {
  const [amount, setAmount] = useState('');
  const [dateMs, setDateMs] = useState<number>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  });
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [type, setType] = useState<TransactionType>('expense');
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | TransactionType>('all');
  const [importOpen, setImportOpen] = useState(false);

  const importedCount = useMemo(
    () => budget.transactions.filter(x => x.externalId).length,
    [budget.transactions],
  );
  const clearImported = () => {
    if (importedCount === 0) return;
    const ok = window.confirm(
      `Remove all ${importedCount} bank-imported transaction${importedCount !== 1 ? 's' : ''}? ` +
      'Manually-added transactions stay.',
    );
    if (!ok) return;
    setBudget(b => ({ ...b, transactions: b.transactions.filter(x => !x.externalId) }));
  };

  const add = () => {
    const a = num(amount);
    if (a <= 0) return;
    const tx: OneOffTransaction = {
      id: Date.now(), date: dateMs,
      amount: a, category: cat, type, note: note.trim(),
    };
    setBudget(b => ({ ...b, transactions: [...b.transactions, tx] }));
    setAmount(''); setNote('');
  };
  const del = (id: number) => setBudget(b => ({ ...b, transactions: b.transactions.filter(x => x.id !== id) }));

  const mergeImported = (rows: OneOffTransaction[]) => {
    if (rows.length === 0) return;
    setBudget(b => ({ ...b, transactions: [...b.transactions, ...rows] }));
  };

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return [...budget.transactions]
      .filter(x => filter === 'all' || x.type === filter)
      .filter(x => !ql || x.note.toLowerCase().includes(ql) || x.category.toLowerCase().includes(ql))
      .sort((a, b) => b.date - a.date);
  }, [budget.transactions, q, filter]);

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="search…" style={inp({ flex: 1, minWidth: '160px' })} />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as 'all' | TransactionType)}
          aria-label="Filter by type"
          style={inp({ width: '150px' })}
        >
          <option value="all">all types</option>
          {TX_TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button onClick={() => setImportOpen(true)} style={btn} title="Import a bank statement (CSV)">
          <Upload size={14} strokeWidth={1.5} /> Import CSV
        </button>
        {importedCount > 0 && (
          <button
            onClick={clearImported}
            title="Remove all transactions that came from a bank import"
            style={{
              background: 'transparent', border: `1px solid ${t.alertBorder}`,
              borderRadius: '8px', padding: '0 0.85rem',
              color: t.alert, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.78rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            <X size={14} strokeWidth={1.5} /> Clear {importedCount} imported
          </button>
        )}
      </div>

      {importOpen && (
        <BankImportModal
          t={t}
          budget={budget}
          onClose={() => setImportOpen(false)}
          onMerge={mergeImported}
        />
      )}

      {shown.map(x => (
        <div key={x.id} style={row(t)}>
          <span style={{ fontSize: '0.72rem', color: t.textMuted, width: '88px', flexShrink: 0 }}>
            {new Date(x.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
          <span style={{ flex: 1, fontSize: '0.86rem', color: t.text }}>
            {x.note || x.category}
            <span style={{ color: t.textDim, fontSize: '0.72rem' }}>
              {' · '}{x.type === 'owed-to-me' || x.type === 'i-owe' ? TX_LABEL[x.type] : x.category}
            </span>
          </span>
          <span style={{
            fontSize: '0.88rem',
            color: x.type === 'income' || x.type === 'owed-to-me' ? t.doneAccent : t.alert,
          }}>
            {x.type === 'income' || x.type === 'owed-to-me' ? '+' : '−'}{formatMoney(x.amount, budget.currency)}
          </span>
          <button onClick={() => del(x.id)} aria-label="Delete" style={iconBtn(t)}><X size={14} strokeWidth={1.5} /></button>
        </div>
      ))}
      {shown.length === 0 && <Empty t={t} text="no transactions" />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
        <DatePicker
          t={t}
          value={dateMs}
          onChange={(v) => v != null && setDateMs(v)}
        />
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="amount" inputMode="decimal" style={inp({ width: '100px' })} />
        <ChoicePicker
          t={t}
          value={cat}
          onChange={setCat}
          options={CATEGORIES.map(c => ({ id: c, label: c }))}
          minWidth={130}
        />
        <ChoicePicker
          t={t}
          value={type}
          onChange={(v) => setType(v as TransactionType)}
          options={TX_TYPES.map(o => ({ id: o.id, label: o.label }))}
          minWidth={130}
        />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder={type === 'owed-to-me' || type === 'i-owe' ? 'who / what for' : 'note (optional)'} style={inp({ flex: 1, minWidth: '140px' })} />
        <button onClick={add} style={btn}><Plus size={14} strokeWidth={1.5} />add</button>
      </div>
    </div>
  );
}

function Goals({ t, budget, setBudget, inp, btn }: Props & FormStyles) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [tDateMs, setTDateMs] = useState<number | null>(null);
  const [contrib, setContrib] = useState<Record<number, string>>({});

  const add = () => {
    const tg = num(target);
    if (!name.trim() || tg <= 0) return;
    const goal: SavingsGoal = {
      id: Date.now(), name: name.trim(), target: tg,
      targetDate: tDateMs, contributions: [],
    };
    setBudget(b => ({ ...b, goals: [...b.goals, goal] }));
    setName(''); setTarget(''); setTDateMs(null);
  };
  const del = (id: number) => setBudget(b => ({ ...b, goals: b.goals.filter(g => g.id !== id) }));
  const addContribution = (id: number) => {
    const a = num(contrib[id] ?? '');
    if (a <= 0) return;
    setBudget(b => ({
      ...b,
      goals: b.goals.map(g => g.id === id
        ? { ...g, contributions: [...g.contributions, { id: Date.now(), date: Date.now(), amount: a }] }
        : g),
    }));
    setContrib(c => ({ ...c, [id]: '' }));
  };

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {budget.goals.map(g => {
        const p = goalProgress(g);
        return (
          <div key={g.id} style={{
            background: t.panel, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '1.1rem 1.35rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.95rem', color: t.text }}>{g.name}</span>
              <button onClick={() => del(g.id)} aria-label="Delete goal" style={iconBtn(t)}><X size={14} strokeWidth={1.5} /></button>
            </div>
            <div style={{ fontSize: '0.74rem', color: t.textMuted, margin: '0.3rem 0 0.6rem' }}>
              {formatMoney(p.saved, budget.currency)} / {formatMoney(g.target, budget.currency)} · {p.eta}
            </div>
            <div style={{ height: '6px', background: t.bgAlt, borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${p.pct * 100}%`, height: '100%', background: t.doneAccent, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input
                value={contrib[g.id] ?? ''}
                onChange={e => setContrib(c => ({ ...c, [g.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addContribution(g.id)}
                placeholder="add contribution" inputMode="decimal"
                style={inp({ width: '160px' })}
              />
              <button onClick={() => addContribution(g.id)} style={btn}>add</button>
            </div>
          </div>
        );
      })}
      {budget.goals.length === 0 && <Empty t={t} text="no savings goals yet" />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="goal name" style={inp({ flex: 2, minWidth: '140px' })} />
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="target amount" inputMode="decimal" style={inp({ width: '130px' })} />
        <DatePicker
          t={t}
          value={tDateMs}
          onChange={setTDateMs}
          placeholder="target date"
          allowClear
        />
        <button onClick={add} style={btn}><Plus size={14} strokeWidth={1.5} />add goal</button>
      </div>
    </div>
  );
}

const row = (t: Theme): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '0.85rem',
  background: t.todoBg, border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.7rem 1rem',
});
const iconBtn = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer',
  padding: '0.2rem', display: 'flex', alignItems: 'center', flexShrink: 0,
});
const linkBtn = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '0.74rem', flexShrink: 0,
});
function Empty({ t, text }: { t: Theme; text: string }) {
  return (
    <p style={{ color: t.textDim, fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem 0', margin: 0 }}>
      {text}
    </p>
  );
}
