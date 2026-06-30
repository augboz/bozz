/**
 * BankConnectModal — GoCardless Open Banking connect flow.
 *
 * Supported banks: Lloyds, Revolut, Monzo, Starling, Barclays, NatWest, HSBC,
 * Santander and hundreds more. Users authenticate on their bank's own website —
 * we never see credentials.
 *
 * Requires GOCARDLESS_SECRET_ID + GOCARDLESS_SECRET_KEY in Vercel env vars.
 * Sign up free at bankaccountdata.gocardless.com
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Search, ArrowLeft, Loader } from 'lucide-react';
import type { BudgetData, OneOffTransaction, Theme } from '../../../lib/types';

interface Props {
  t: Theme;
  budget: BudgetData;
  onClose: () => void;
  onMerge: (txs: OneOffTransaction[]) => void;
}

interface Institution {
  id: string;
  name: string;
  logo: string;
  transaction_total_days: string;
}

type Stage = 'list' | 'waiting' | 'fetching' | 'done' | 'error' | 'not-configured';

// Popular UK banks shown prominently (IDs from GoCardless)
const PRIORITY_BANKS = [
  'REVOLUT_REVOLT21',
  'MONZO_MONZGB2L',
  'LLOYDS_LOYDGB2L',
  'STARLING_SRLGGB3L',
  'BARCLAYS_BARCGB22',
  'NATWEST_NWBKGB2L',
  'HSBC_HBUKGB4B',
  'SANTANDER_ABBYGB2L',
];

function gcTxToOneOff(
  tx: Record<string, unknown>,
  institutionName: string,
  index: number,
): OneOffTransaction {
  type TxAmount = { amount?: string | number; currency?: string };
  const amountObj = (tx.transactionAmount ?? {}) as TxAmount;
  const amount = parseFloat(String(amountObj.amount ?? '0'));
  const dateStr =
    (tx.bookingDate as string) ||
    (tx.valueDate as string) ||
    new Date().toISOString().slice(0, 10);
  const date = new Date(dateStr).getTime();

  const note =
    (tx.remittanceInformationUnstructured as string) ||
    (tx.remittanceInformationStructured as string) ||
    (tx.additionalInformation as string) ||
    (tx.creditorName as string) ||
    (tx.debtorName as string) ||
    'Transaction';

  const txId = (tx.transactionId as string) || (tx.internalTransactionId as string);
  const externalId = txId
    ? `gc:${txId}`
    : `gc:${dateStr}:${amount.toFixed(2)}:${note.slice(0, 40)}`;

  return {
    id: Date.now() + index,
    date: isNaN(date) ? Date.now() : date,
    amount: Math.abs(amount),
    type: amount >= 0 ? 'income' : 'expense',
    category: 'Other',
    note: note.trim(),
    externalId,
    source: institutionName,
  };
}

function dedup(
  incoming: OneOffTransaction[],
  existing: OneOffTransaction[],
): { newOnes: OneOffTransaction[]; dupes: number } {
  const seen = new Set(existing.map(t => t.externalId).filter(Boolean));
  const newOnes: OneOffTransaction[] = [];
  let dupes = 0;
  for (const tx of incoming) {
    if (tx.externalId && seen.has(tx.externalId)) { dupes++; continue; }
    seen.add(tx.externalId);
    newOnes.push(tx);
  }
  return { newOnes, dupes };
}

export default function BankConnectModal({ t, budget, onClose, onMerge }: Props) {
  const [stage, setStage] = useState<Stage>('list');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [newOnes, setNewOnes] = useState<OneOffTransaction[]>([]);
  const [dupes, setDupes] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [setupMsg, setSetupMsg] = useState('');

  // Load institution list on mount
  useEffect(() => {
    (async () => {
      setLoadingList(true);
      try {
        const r = await fetch('/api/gc-institutions');
        const data = await r.json();
        if (r.status === 503) {
          setSetupMsg(data.setup ?? '');
          setStage('not-configured');
          return;
        }
        if (!r.ok) throw new Error(data.error ?? 'Failed to load banks');
        // Sort by priority then alphabetically
        const sorted = [...(data as Institution[])].sort((a, b) => {
          const ai = PRIORITY_BANKS.indexOf(a.id);
          const bi = PRIORITY_BANKS.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
        setInstitutions(sorted);
      } catch (e) {
        setErrorMsg(String(e));
        setStage('error');
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  // Listen for postMessage from gc-callback popup
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'gc_done') {
        fetchTransactions();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  });

  // Also check for ?gc_done=1 in URL on mount (same-window redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gc_done') === '1') {
      const storedReq = localStorage.getItem('gc_pending_req');
      const storedInst = localStorage.getItem('gc_pending_institution');
      if (storedReq) {
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        fetchTransactions(storedReq, storedInst ?? undefined);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectBank = useCallback(async (institution: Institution) => {
    setSelectedInstitution(institution);
    setStage('waiting');

    try {
      const returnUrl = window.location.origin || 'http://127.0.0.1:14986';
      const r = await fetch('/api/gc-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institution_id: institution.id, return_url: returnUrl }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Could not create bank link');

      const { requisition_id, link } = data;

      // Store so we can fetch transactions after the redirect
      localStorage.setItem('gc_pending_req', requisition_id);
      localStorage.setItem('gc_pending_institution', institution.name);

      // Open bank auth in a popup — callback uses postMessage to signal done
      const popup = window.open(link, 'gc_bank_auth', 'width=600,height=700,scrollbars=yes');

      if (!popup) {
        // Popup blocked — fall back to same-window navigation
        window.location.href = link;
        return;
      }

      // If popup is blocked or the user closed it, check periodically
      const poll = setInterval(() => {
        if (popup.closed) {
          clearInterval(poll);
          // They may have completed — try fetching
          const req = localStorage.getItem('gc_pending_req');
          if (req) fetchTransactions(req, institution.name);
        }
      }, 1500);
    } catch (e) {
      setErrorMsg(String(e));
      setStage('error');
    }
  }, []);

  const fetchTransactions = useCallback(async (
    reqId?: string,
    institutionName?: string,
  ) => {
    const id = reqId ?? localStorage.getItem('gc_pending_req');
    const instName = institutionName ?? localStorage.getItem('gc_pending_institution') ?? 'Bank';

    if (!id) {
      setErrorMsg('No pending bank connection found. Please try connecting again.');
      setStage('error');
      return;
    }

    setStage('fetching');

    try {
      const r = await fetch(`/api/gc-transactions?req_id=${encodeURIComponent(id)}`);
      const data = await r.json();

      if (!r.ok) throw new Error(data.error ?? 'Failed to fetch transactions');

      if (data.status !== 'LN') {
        // Not yet linked — user may not have completed auth
        setErrorMsg(`Bank authorization incomplete (status: ${data.status}). Please try connecting again.`);
        setStage('error');
        return;
      }

      const raw = (data.transactions ?? []) as Record<string, unknown>[];
      const converted = raw.map((tx, i) =>
        gcTxToOneOff(tx, instName, i),
      );
      const { newOnes: news, dupes: dCount } = dedup(converted, budget.transactions);

      localStorage.removeItem('gc_pending_req');
      localStorage.removeItem('gc_pending_institution');

      // Merge automatically — no import button, just done
      onMerge(news);
      setNewOnes(news);
      setDupes(dCount);
      setStage('done');
    } catch (e) {
      setErrorMsg(String(e));
      setStage('error');
    }
  }, [budget.transactions, onMerge]);

  const filtered = institutions.filter(i =>
    i.name.toLowerCase().includes(query.toLowerCase()),
  );

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '9px',
    padding: '0.55rem 0.85rem 0.55rem 2.1rem', color: t.text, fontSize: '0.85rem',
    fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
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
          width: 'min(580px, 100%)', background: t.panel,
          border: `1px solid ${t.borderStrong}`, borderRadius: '18px',
          fontFamily: 'var(--app-font)', color: t.text,
          position: 'relative', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.4rem 1.5rem 1rem', borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0,
        }}>
          {(stage === 'waiting' || stage === 'fetching') && (
            <button
              onClick={() => setStage('list')}
              style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.3rem', display: 'flex' }}
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
            </button>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
              {stage === 'list' && 'Connect your bank'}
              {stage === 'waiting' && `Connecting ${selectedInstitution?.name ?? 'bank'}…`}
              {stage === 'fetching' && 'Fetching transactions…'}
              {stage === 'done' && 'Bank connected!'}
              {stage === 'error' && 'Something went wrong'}
              {stage === 'not-configured' && 'Set up bank connection'}
            </h2>
            {stage === 'list' && (
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.74rem', color: t.textMuted }}>
                Powered by Open Banking. You log in directly to your bank, we never see your credentials
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.3rem', display: 'flex' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1.1rem 1.5rem 1.4rem' }}>

          {/* Bank list */}
          {stage === 'list' && (
            <>
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <Search size={14} strokeWidth={1.5} color={t.textMuted}
                  style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
                <input
                  placeholder="Search your bank…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={inp}
                  autoFocus
                />
              </div>

              {loadingList ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: t.textMuted }}>
                  <Loader size={20} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>Loading banks…</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.55rem' }}>
                  {filtered.slice(0, 30).map(inst => (
                    <button
                      key={inst.id}
                      onClick={() => connectBank(inst)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                        padding: '0.85rem 0.5rem', borderRadius: '12px',
                        border: `1px solid ${t.border}`, background: t.todoBg,
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = t.doingAccent;
                        (e.currentTarget as HTMLElement).style.background = t.bgAlt;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = t.border;
                        (e.currentTarget as HTMLElement).style.background = t.todoBg;
                      }}
                    >
                      {inst.logo ? (
                        <img src={inst.logo} alt="" width={36} height={36} style={{ borderRadius: '8px', objectFit: 'contain' }} />
                      ) : (
                        <div style={{
                          width: 36, height: 36, borderRadius: '8px', background: t.bgAlt,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700, color: t.text,
                        }}>
                          {inst.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontSize: '0.74rem', color: t.text, textAlign: 'center', lineHeight: 1.3, fontWeight: 500 }}>
                        {inst.name}
                      </span>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', color: t.textMuted, fontSize: '0.84rem', padding: '1.5rem 0' }}>
                      No banks found for "{query}"
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Waiting for bank auth */}
          {stage === 'waiting' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                {selectedInstitution?.logo
                  ? <img src={selectedInstitution.logo} alt="" width={56} height={56} style={{ borderRadius: '12px', objectFit: 'contain' }} />
                  : '🏦'}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, color: t.text, marginBottom: '0.5rem' }}>
                A window has opened for {selectedInstitution?.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: t.textMuted, lineHeight: 1.6, maxWidth: '340px', margin: '0 auto 1.25rem' }}>
                Log in to your bank in the popup window and authorise access.
                This window will update automatically once you're done.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: t.textMuted }}>
                <Loader size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.78rem' }}>Waiting for authorisation…</span>
              </div>
            </div>
          )}

          {/* Fetching transactions */}
          {stage === 'fetching' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <Loader size={32} strokeWidth={1} color={t.doingAccent} style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ marginTop: '1rem', fontSize: '0.88rem', color: t.textMuted }}>
                Fetching your transactions…
              </div>
            </div>
          )}

          {/* Done — transactions already merged, just show confirmation */}
          {stage === 'done' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '2.8rem', marginBottom: '0.75rem' }}>✅</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: t.text, marginBottom: '0.4rem' }}>
                {selectedInstitution?.name ?? 'Bank'} connected
              </div>
              <div style={{ fontSize: '0.82rem', color: t.textMuted, marginBottom: '1.5rem' }}>
                {newOnes.length > 0
                  ? `${newOnes.length} transaction${newOnes.length !== 1 ? 's' : ''} added to your Budget${dupes > 0 ? ` · ${dupes} already existed` : ''}`
                  : 'All your transactions are already up to date'}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button onClick={() => setStage('list')} style={ghostBtn(t)}>Connect another bank</button>
                <button onClick={onClose} style={primaryBtn(t)}>Done</button>
              </div>
            </div>
          )}

          {/* Error */}
          {stage === 'error' && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
              <div style={{ fontSize: '0.88rem', color: t.alert, marginBottom: '0.5rem', fontWeight: 500 }}>Connection failed</div>
              <div style={{ fontSize: '0.78rem', color: t.textMuted, marginBottom: '1.5rem', lineHeight: 1.5 }}>{errorMsg}</div>
              <button onClick={() => setStage('list')} style={primaryBtn(t)}>Try again</button>
            </div>
          )}

          {/* Not configured */}
          {stage === 'not-configured' && (
            <div>
              <div style={{
                background: '#f59e0b18', border: '1px solid #f59e0b40', borderRadius: '10px',
                padding: '1rem 1.1rem', marginBottom: '1.25rem',
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f59e0b', marginBottom: '0.35rem' }}>
                  API keys not configured
                </div>
                <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.6 }}>
                  {setupMsg}
                </div>
              </div>
              <div style={{ fontSize: '0.82rem', color: t.text, lineHeight: 1.65 }}>
                <strong>Quick setup (free):</strong>
                <ol style={{ margin: '0.5rem 0', paddingLeft: '1.2rem' }}>
                  <li>Go to <strong>bankaccountdata.gocardless.com</strong> and create a free account</li>
                  <li>Click <strong>User Secrets → Create</strong></li>
                  <li>Copy <strong>Secret ID</strong> and <strong>Secret Key</strong></li>
                  <li>Add them to your Vercel project as <code>GOCARDLESS_SECRET_ID</code> and <code>GOCARDLESS_SECRET_KEY</code></li>
                  <li>Redeploy</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ghostBtn = (t: Theme): React.CSSProperties => ({
  background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.55rem 1.1rem', color: t.textMuted, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '0.84rem',
});
const primaryBtn = (t: Theme): React.CSSProperties => ({
  background: t.doingAccent, border: 'none', borderRadius: '8px',
  padding: '0.55rem 1.25rem', color: '#fff', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 500,
});
