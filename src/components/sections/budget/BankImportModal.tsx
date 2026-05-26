import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { parseStatementCSV, findNewTransactions, toBudgetTransactions, type ParseResult } from '../../../lib/bankCsv';
import { formatMoney } from '../../../lib/budget';
import type { BudgetData, OneOffTransaction, Theme } from '../../../lib/types';

interface Props {
  t: Theme;
  budget: BudgetData;
  onClose: () => void;
  onMerge: (newTransactions: OneOffTransaction[]) => void;
}

type Stage = 'pick' | 'preview' | 'done';

export default function BankImportModal({ t, budget, onClose, onMerge }: Props) {
  const [stage, setStage] = useState<Stage>('pick');
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
      setError('Only CSV files are supported. Most banks let you export as CSV.');
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
  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };
  const confirm = () => {
    onMerge(newOnes);
    setAddedCount(newOnes.length);
    setStage('done');
  };

  return (
    <div
      role="dialog" aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(540px, 100%)', background: t.panel,
          border: `1px solid ${t.borderStrong}`, borderRadius: '14px',
          padding: '1.4rem 1.5rem', fontFamily: 'var(--app-font)',
          color: t.text, position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '0.85rem', right: '0.85rem',
            background: 'transparent', border: 'none', color: t.textMuted,
            cursor: 'pointer', padding: '0.3rem', display: 'flex',
          }}
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.3rem' }}>
          Import bank statement
        </h2>
        <p style={{ margin: 0, fontSize: '0.78rem', color: t.textMuted, marginBottom: '1.2rem' }}>
          Drop a CSV exported from your bank&apos;s app or website.
          Monzo, Lloyds, Revolut, Starling and most others are auto-detected.
        </p>

        {stage === 'pick' && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{
                border: `2px dashed ${dragOver ? t.doingAccent : t.border}`,
                borderRadius: '10px',
                padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? t.bgAlt : 'transparent',
                transition: 'background 0.15s, border-color 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
              }}
            >
              <Upload size={24} strokeWidth={1.4} color={t.textMuted} />
              <div style={{ fontSize: '0.88rem', color: t.text }}>
                Drop CSV here or <span style={{ color: t.doingAccent, textDecoration: 'underline' }}>browse</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: t.textDim }}>
                .csv only — usually exported from your bank&apos;s monthly statement
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFilePick}
                style={{ display: 'none' }}
              />
            </div>
            {error && <div style={{ fontSize: '0.74rem', color: t.alert, marginTop: '0.8rem' }}>{error}</div>}
          </>
        )}

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
                maxHeight: '230px', overflowY: 'auto',
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
                    <span style={{
                      flex: 1, color: t.text, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {tx.note}
                    </span>
                    <span style={{
                      color: tx.type === 'income' ? t.doneAccent : t.alert,
                      fontWeight: 500, flexShrink: 0,
                    }}>
                      {tx.type === 'income' ? '+' : '−'}{formatMoney(tx.amount, budget.currency)}
                    </span>
                  </div>
                ))}
                {newOnes.length > 50 && (
                  <div style={{
                    padding: '0.5rem 0.75rem', fontSize: '0.7rem',
                    color: t.textDim, fontStyle: 'italic', textAlign: 'center',
                  }}>
                    + {newOnes.length - 50} more
                  </div>
                )}
              </div>
            )}

            {newOnes.length === 0 && (
              <div style={{
                fontSize: '0.82rem', color: t.textMuted, fontStyle: 'italic',
                padding: '1rem', textAlign: 'center',
              }}>
                Nothing new to import — every transaction in this file is already in your budget.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <button
                onClick={() => { setStage('pick'); setParsed(null); setNewOnes([]); }}
                style={ghostBtn(t)}
              >
                Back
              </button>
              <button
                onClick={confirm}
                disabled={newOnes.length === 0}
                style={{
                  ...primaryBtn(t),
                  opacity: newOnes.length === 0 ? 0.4 : 1,
                  cursor: newOnes.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Add {newOnes.length} transaction{newOnes.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {stage === 'done' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>✓</div>
            <div style={{ fontSize: '0.95rem', color: t.text, marginBottom: '0.3rem' }}>
              Added {addedCount} transaction{addedCount !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '0.75rem', color: t.textMuted, marginBottom: '1.2rem' }}>
              They&apos;ve been merged into your Budget.
            </div>
            <button onClick={onClose} style={primaryBtn(t)}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

const ghostBtn = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
  padding: '0.5rem 1rem', color: t.textMuted, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '0.82rem',
});
const primaryBtn = (t: Theme): React.CSSProperties => ({
  background: t.doingAccent, border: 'none', borderRadius: '7px',
  padding: '0.5rem 1.1rem', color: '#fff', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 500,
});
