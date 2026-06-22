/**
 * POST /api/terra-webhook
 * Receives health data pushed by Terra after Apple Health connects.
 * Stores data in Supabase health_days table.
 *
 * Supabase table (run this SQL in your Supabase project → SQL Editor):
 *
 *   CREATE TABLE IF NOT EXISTS health_days (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_ref TEXT NOT NULL,
 *     date DATE NOT NULL,
 *     steps INTEGER,
 *     sleep_hours DECIMAL(4,1),
 *     active_calories INTEGER,
 *     heart_rate_avg INTEGER,
 *     updated_at TIMESTAMPTZ DEFAULT NOW(),
 *     UNIQUE(user_ref, date)
 *   );
 *   ALTER TABLE health_days ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "public read" ON health_days FOR SELECT USING (true);
 *   CREATE POLICY "service insert" ON health_days FOR ALL USING (true);
 *
 * Configure webhook URL in Terra dashboard:
 *   https://life-bozz.vercel.app/api/terra-webhook
 */
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

function verifyTerraSignature(req, secret) {
  const sig = req.headers['terra-signature'];
  if (!sig) return false;
  const body = JSON.stringify(req.body);
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  // Fail CLOSED: require a configured signing secret and a valid signature.
  // (Previously, if TERRA_SIGNING_SECRET was unset the check was skipped and
  // any internet POST could write forged health data via the service key.)
  const terraSecret = process.env.TERRA_SIGNING_SECRET;
  if (!terraSecret) {
    return res.status(503).json({ error: 'Webhook signing secret not configured' });
  }
  if (!verifyTerraSignature(req, terraSecret)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const body = req.body ?? {};

  const type = body.type;
  const user = body.user;
  const dataArr = body.data;

  const userRef = user?.reference_id || user?.user_id || 'unknown';

  if (!dataArr || !Array.isArray(dataArr)) {
    return res.json({ status: 'ok', processed: 0 });
  }

  const rows = [];

  for (const d of dataArr) {
    const startTime = d.metadata?.start_time;
    if (!startTime) continue;

    const date = new Date(startTime * 1000).toISOString().slice(0, 10);

    if (type === 'daily' || type === 'activity') {
      const steps = d.distance_data?.steps ?? null;
      const cals = d.calories_data?.calories_out
        ? Math.round(d.calories_data.calories_out)
        : null;
      const hr = d.heart_rate_data?.summary?.avg_hr_bpm
        ? Math.round(d.heart_rate_data.summary.avg_hr_bpm)
        : null;

      rows.push({
        user_ref: userRef,
        date,
        steps: steps != null ? Math.round(steps) : null,
        sleep_hours: null,
        active_calories: cals,
        heart_rate_avg: hr,
        updated_at: new Date().toISOString(),
      });
    } else if (type === 'sleep') {
      const asleep = d.sleep_durations_data?.asleep ?? {};
      const totalSecs =
        (asleep.duration_light_sleep_state_seconds ?? 0) +
        (asleep.duration_REM_sleep_state_seconds ?? 0) +
        (asleep.duration_deep_sleep_state_seconds ?? 0);

      if (totalSecs > 0) {
        rows.push({
          user_ref: userRef,
          date,
          steps: null,
          sleep_hours: Math.round((totalSecs / 3600) * 10) / 10,
          active_calories: null,
          heart_rate_avg: null,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('health_days')
      .upsert(rows, { onConflict: 'user_ref,date' });

    if (error) {
      console.error('Supabase upsert error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  res.json({ status: 'ok', processed: rows.length });
}
