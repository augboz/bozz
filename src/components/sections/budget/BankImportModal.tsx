import { useState, useRef, useCallback } from 'react';
import { X, FileText, ArrowLeft } from 'lucide-react';
import { parseStatementCSV, findNewTransactions, toBudgetTransactions, type ParseResult } from '../../../lib/bankCsv';
import { formatMoney } from '../../../lib/budget';
import type { BudgetData, OneOffTransaction, Theme } from '../../../lib/types';

interface Props {
  t: Theme;
  budget: BudgetData;
  onClose: () => void;
  onMerge: (newTransactions: OneOffTransaction[]) => void;
}

type Stage = 'bank' | 'instructions' | 'pick' | 'preview' | 'done';

interface BankOption {
  id: string;
  name: string;
  color: string;
  textColor: string;
  initials: string;
  instructions: string[];
  exportNote: string;
}

const BANKS: BankOption[] = [
  {
    id: 'revolut',
    name: 'Revolut',
    color: '#191C1F',
    textColor: '#fff',
    initials: 'R',
    instructions: [
      'Open the Revolut app',
      'Tap your account name at the top',
      'Tap "Statement"',
      'Choose "Monthly statement" or a custom date range',
      'Tap "Download" and choose CSV',
    ],
    exportNote: 'The file will be named something like Revolut_Transactions.csv',
  },
  {
    id: 'lloyds',
    name: 'Lloyds',
    color: '#006A4D',
    textColor: '#fff',
    initials: 'L',
    instructions: [
      'Log into Lloyds online banking at lloydsbank.com',
      'Go to your account and click "View statements"',
      'Select the date range you want',
      'Click "Export as CSV" or "Download statement"',
    ],
    exportNote: 'The file will be named Transaction_history.csv or similar',
  },
  {
    id: 'monzo',
    name: 'Monzo',
    color: '#FF3A2D',
    textColor: '#fff',
    initials: 'M',
    instructions: [
      'Open the Monzo app',
      'Tap on your account',
      'Scroll down and tap "Export transactions"',
      'Choose your date range',
      'Tap "Email CSV", then open the email on this Mac and download the attachment',
    ],
    exportNote: 'The file will be named transactions.csv',
  },
  {
    id: 'starling',
    name: 'Starling',
    color: '#7B35C1',
    textColor: '#fff',
    initials: 'S',
    instructions: [
      'Log into Starling at starlingbank.com or open the app',
      'Go to your account',
      'Tap "Download statement"',
      'Choose CSV format and your date range',
    ],
    exportNote: 'Starling exports to CSV automatically',
  },
  {
    id: 'barclays',
    name: 'Barclays',
    color: '#00AEEF',
    textColor: '#fff',
    initials: 'B',
    instructions: [
      'Log into Barclays online banking',
      'Select your account',
      'Click "Download transactions" or "Export"',
      'Choose CSV format and a date range',
    ],
    exportNote: 'The file will be named something like transactions.csv',
  },
  {
    id: 'natwest',
    name: 'NatWest',
    color: '#42145F',
    textColor: '#fff',
    initials: 'N',
    instructions: [
      'Log into NatWest online banking at natwest.com',
      'Go to your account',
      'Click "Manage" → "Download transactions"',
      'Choose "CSV" and your date range',
    ],
    exportNote: 'The file will be named something like NatWest_Transactions.csv',
  },
  {
    id: 'hsbc',
    name: 'HSBC',
    color: '#DB0011',
    textColor: '#fff',
    initials: 'H',
    instructions: [
      'Log into HSBC online banking at hsbc.co.uk',
      'Select your account',
      'Click "View statement" or "Download transactions"',
      'Choose CSV format',
    ],
    exportNote: 'HSBC exports a simple CSV with date, description, amount',
  },
  {
    id: 'santander',
    name: 'Santander',
    color: '#EC0000',
    textColor: '#fff',
    initials: 'Sa',
    instructions: [
      'Log into Santander online banking at santander.co.uk',
      'Select your account',
      'Click "Download transactions"',
      'Select CSV and your date range, then download',
    ],
    exportNote: 'The file will be named something like Transactions.csv',
  },
  {
    id: 'other',
    name: 'Other bank',
    color: '#6B7280',
    textColor: '#fff',
    initials: '?',
    instructions: [
      'Log into your bank\'s online banking or mobile app',
      'Go to your account transactions',
      'Look for "Export", "Download", or "Statement"',
      'Choose CSV format (not PDF or Excel)',
    ],
    exportNote: 'Most UK banks export CSV. If only Excel is available, open it and save as CSV.',
  },
];

export default function BankImportModal({ t, budget, onClose, onMerge }: Props) {
  const [stage, setStage] = useState<Stage>('bank');
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [dupCount, setDupCount] = useState(0);
  const [newOnes, setNewOnes] = useState<OneOffTransaction[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are supported. Export from your bank\'s website or app.');
      return;
    }
    try {
      const text = await file.text();
      const result = parseStatementCSV(text);
      if (result.errors.length > 0) {
        setError(result.errors[0]);
        setParsed(result);
        return;
      }
      const { newOnes: news, duplicates } = findNewTransactions(result.transactions, budget.transactions);
      const txs = toBudgetTransactions(news, `${result.formatLabel} · ${file.name}`);
      setParsed(result);
      setDupCount(duplicates);
      setNewOnes(txs);
      setStage('preview');
    } catch (e) {
      setError(String(e));
    }
  }, [budget.transactions]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const confirm = () => {
    onMerge(newOnes);
    setAddedCount(newOnes.length);
    setStage('done');
  };

  const selectBank = (bank: BankOption) => {
    setSelectedBank(bank);
    setStage('instructions');
  };

  const goBack = () => {
    if (stage === 'instructions') { setStage('bank'); setSelectedBank(null); }
    else if (stage === 'pick') setStage('instructions');
    else if (stage === 'preview') { setStage('pick'); setParsed(null); setNewOnes([]); }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)', background: t.panel,
          border: `1px solid ${t.borderStrong}`, borderRadius: '18px',
          padding: '1.5rem', fontFamily: 'var(--app-font)',
          color: t.text, position: 'relative',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {stage !== 'bank' && stage !== 'done' && (
            <button
              onClick={goBack}
              style={{
                background: 'transparent', border: 'none', color: t.textMuted,
                cursor: 'pointer', padding: '0.3rem', display: 'flex', marginRight: '0.1rem',
              }}
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
            </button>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
              {stage === 'bank' && 'Connect your bank'}
              {stage === 'instructions' && `Connect ${selectedBank?.name}`}
              {stage === 'pick' && 'Upload your statement'}
              {stage === 'preview' && 'Review transactions'}
              {stage === 'done' && 'All done!'}
            </h2>
            {stage === 'bank' && (
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.76rem', color: t.textMuted }}>
                Choose your bank to get export instructions
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: 'none', color: t.textMuted,
              cursor: 'pointer', padding: '0.3rem', display: 'flex',
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Bank picker */}
        {stage === 'bank' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
            {BANKS.map(bank => (
              <button
                key={bank.id}
                onClick={() => selectBank(bank)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem',
                  padding: '1rem 0.75rem', borderRadius: '12px',
                  border: `1px solid ${t.border}`, background: t.todoBg,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = bank.color; (e.currentTarget as HTMLElement).style.background = bank.color + '10'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = t.border; (e.currentTarget as HTMLElement).style.background = t.todoBg; }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '10px',
                  background: bank.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: bank.initials.length > 1 ? '0.75rem' : '1rem',
                  fontWeight: 700, color: bank.textColor, letterSpacing: '-0.02em',
                }}>
                  {bank.initials}
                </div>
                <span style={{ fontSize: '0.78rem', color: t.text, fontWeight: 500 }}>{bank.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Bank instructions */}
        {stage === 'instructions' && selectedBank && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '11px',
                background: selectedBank.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: selectedBank.initials.length > 1 ? '0.85rem' : '1.1rem',
                fontWeight: 700, color: selectedBank.textColor,
              }}>
                {selectedBank.initials}
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>Export from {selectedBank.name}</div>
                <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.1rem' }}>Follow these steps, then upload the CSV file</div>
              </div>
            </div>

            <div style={{
              background: t.bgAlt, borderRadius: '12px', padding: '1.1rem 1.25rem',
              marginBottom: '1.25rem', display: 'grid', gap: '0.75rem',
            }}>
              {selectedBank.instructions.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: selectedBank.color + '20',
                    border: `1px solid ${selectedBank.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.68rem', fontWeight: 600, color: selectedBank.color,
                  }}>{i + 1}</div>
                  <span style={{ fontSize: '0.82rem', color: t.text, lineHeight: 1.45, paddingTop: '2px' }}>{step}</span>
                </div>
              ))}
            </div>

            <div style={{
              fontSize: '0.72rem', color: t.textMuted, background: t.panel,
              border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.6rem 0.85rem',
              marginBottom: '1.25rem',
            }}>
              💡 {selectedBank.exportNote}
            </div>

            <button
              onClick={() => setStage('pick')}
              style={{
                width: '100%', padding: '0.65rem',
                background: selectedBank.color, color: selectedBank.textColor,
                border: 'none', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              I've downloaded my CSV →
            </button>
          </div>
        )}

        {/* File drop */}
        {stage === 'pick' && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{
                border: `2px dashed ${dragOver ? (selectedBank?.color ?? t.doingAccent) : t.border}`,
                borderRadius: '12px', padding: '2.5rem 1rem', textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? (selectedBank?.color ?? t.doingAccent) + '08' : 'transparent',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
              }}
            >
              <div style={{ fontSize: '2rem' }}>📄</div>
              <div style={{ fontSize: '0.9rem', color: t.text }}>
                Drop your CSV here or <span style={{ color: selectedBank?.color ?? t.doingAccent, textDecoration: 'underline' }}>browse</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: t.textDim }}>
                .csv only, exported from {selectedBank?.name ?? 'your bank'}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                style={{ display: 'none' }}
              />
            </div>
            {error && <div style={{ fontSize: '0.74rem', color: t.alert, marginTop: '0.8rem' }}>{error}</div>}
          </>
        )}

        {/* Preview */}
        {stage === 'preview' && parsed && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              background: t.todoBg, border: `1px solid ${t.border}`,
              borderRadius: '8px', padding: '0.7rem 0.85rem', marginBottom: '1rem',
            }}>
              <FileText size={16} strokeWidth={1.5} color={t.textMuted} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', color: t.text }}>
                  Detected: <strong>{parsed.formatLabel}</strong>
                </div>
                <div style={{ fontSize: '0.7rem', color: t.textDim }}>
                  {parsed.transactions.length} total · {newOnes.length} new · {dupCount} already imported
                </div>
              </div>
            </div>

            {newOnes.length > 0 && (
              <div style={{
                maxHeight: '240px', overflowY: 'auto',
                border: `1px solid ${t.border}`, borderRadius: '8px',
                marginBottom: '1rem',
              }}>
                {newOnes.slice(0, 50).map(tx => (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.5rem 0.75rem', borderBottom: `1px solid ${t.border}`,
                    fontSize: '0.78rem',
                  }}>
                    <span style={{ color: t.textDim, width: '72px', flexShrink: 0 }}>
                      {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ flex: 1, color: t.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.note}
                    </span>
                    <span style={{ color: tx.type === 'income' ? t.doneAccent : t.alert, fontWeight: 500, flexShrink: 0 }}>
                      {tx.type === 'income' ? '+' : '−'}{formatMoney(tx.amount, budget.currency)}
                    </span>
                  </div>
                ))}
                {newOnes.length > 50 && (
                  <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: t.textDim, fontStyle: 'italic', textAlign: 'center' }}>
                    + {newOnes.length - 50} more
                  </div>
                )}
              </div>
            )}

            {newOnes.length === 0 && (
              <div style={{ fontSize: '0.82rem', color: t.textMuted, lineHeight: 1.5, padding: '1rem', textAlign: 'center' }}>
                Nothing new. Every transaction in this file is already in your budget.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <button onClick={goBack} style={ghostBtn(t)}>Back</button>
              <button
                onClick={confirm}
                disabled={newOnes.length === 0}
                style={{ ...primaryBtn(t, selectedBank?.color), opacity: newOnes.length === 0 ? 0.4 : 1, cursor: newOnes.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                Import {newOnes.length} transaction{newOnes.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {/* Done */}
        {stage === 'done' && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>✅</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 500, color: t.text, marginBottom: '0.3rem' }}>
              {addedCount} transaction{addedCount !== 1 ? 's' : ''} imported
            </div>
            <div style={{ fontSize: '0.78rem', color: t.textMuted, marginBottom: '1.5rem' }}>
              Merged into your Budget. Import again any time to add more.
            </div>
            <button onClick={onClose} style={primaryBtn(t, selectedBank?.color)}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

const ghostBtn = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.55rem 1.1rem', color: t.textMuted, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '0.84rem',
});

const primaryBtn = (t: Theme, color?: string): React.CSSProperties => ({
  background: color ?? t.doingAccent, border: 'none', borderRadius: '8px',
  padding: '0.55rem 1.25rem', color: '#fff', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 500,
});
