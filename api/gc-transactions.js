/**
 * GET /api/gc-transactions?req_id=<requisition_id>
 * Fetches bank transactions for a completed GoCardless requisition.
 * Response: { status, transactions, institution_name }
 */
import { authed } from './_auth.js';

async function getToken() {
  const r = await fetch('https://bankaccountdata.gocardless.com/api/v2/token/new/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      secret_id: process.env.GOCARDLESS_SECRET_ID,
      secret_key: process.env.GOCARDLESS_SECRET_KEY,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.detail ?? 'Token error');
  return d.access;
}

export default async function handler(req, res) {
  if (!(await authed(req, res))) return;

  const { req_id } = req.query;
  if (!req_id) return res.status(400).json({ error: 'req_id required' });

  if (!process.env.GOCARDLESS_SECRET_ID) {
    return res.status(503).json({ error: 'GoCardless not configured' });
  }

  try {
    const token = await getToken();

    // Fetch requisition to get account IDs and status
    const reqR = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/requisitions/${req_id}/`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } },
    );
    const reqData = await reqR.json();
    if (!reqR.ok) return res.status(reqR.status).json({ error: reqData?.detail ?? 'Requisition error' });

    // Status must be LN (Linked) before we can fetch transactions
    if (reqData.status !== 'LN') {
      return res.json({ status: reqData.status, transactions: [], institution_name: reqData.institution_id });
    }

    const accountIds = reqData.accounts ?? [];
    const allTransactions = [];
    let institutionName = reqData.institution_id;

    for (const accountId of accountIds) {
      // Get account details to get the institution name
      try {
        const detailR = await fetch(
          `https://bankaccountdata.gocardless.com/api/v2/accounts/${accountId}/details/`,
          { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } },
        );
        const detail = await detailR.json();
        if (detail?.account?.institution_id) institutionName = detail.account.institution_id;
      } catch (_) {}

      // Fetch booked transactions
      const txR = await fetch(
        `https://bankaccountdata.gocardless.com/api/v2/accounts/${accountId}/transactions/`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } },
      );
      const txData = await txR.json();
      const booked = txData?.transactions?.booked ?? [];
      allTransactions.push(
        ...booked.map(tx => ({ ...tx, _account_id: accountId })),
      );
    }

    res.json({
      status: 'LN',
      transactions: allTransactions,
      institution_name: institutionName,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
