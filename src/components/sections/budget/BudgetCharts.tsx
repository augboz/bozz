import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import type { BudgetData, Theme } from '../../../lib/types';
import { lastSixMonths, categoryBreakdown, formatMoney } from '../../../lib/budget';

const PIE_PALETTE = ['#c9a8d4', '#d4b896', '#a1bdc7', '#b8c7a1', '#c7a1a1', '#a0adb8', '#cdbfa6'];

export default function BudgetCharts({ t, data, refDate }: {
  t: Theme; data: BudgetData; refDate: Date;
}) {
  const bars = lastSixMonths(data);
  const slices = categoryBreakdown(data, refDate);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
      <div style={{
        background: t.panel, border: `1px solid ${t.border}`,
        borderRadius: '12px', padding: '1.25rem 1.5rem',
      }}>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: t.textMuted, marginBottom: '1rem' }}>
          Last 6 months
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bars} barGap={2}>
            <XAxis dataKey="label" tick={{ fill: t.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: t.bgAlt }}
              contentStyle={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: t.textMuted }}
              formatter={(v) => formatMoney(typeof v === 'number' ? v : Number(v) || 0, data.currency)}
            />
            <Bar dataKey="income" fill={t.doneAccent} radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" fill={t.alert} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{
        background: t.panel, border: `1px solid ${t.border}`,
        borderRadius: '12px', padding: '1.25rem 1.5rem',
      }}>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: t.textMuted, marginBottom: '1rem' }}>
          This month by category
        </div>
        {slices.length === 0
          ? <p style={{ color: t.textDim, fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '3rem 0', margin: 0 }}>no spending yet</p>
          : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="category" innerRadius={45} outerRadius={75} strokeWidth={0}>
                  {slices.map((s, i) => <Cell key={s.category} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => formatMoney(typeof v === 'number' ? v : Number(v) || 0, data.currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
      </div>
    </div>
  );
}
