import { Widget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import { monthTotals, goalProgress, formatMoney } from '../../lib/budget';
import type { WidgetCtx } from './context';

export default function BudgetWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, budget, setActiveSection } = ctx;
  const accent = sectionAccents.budget;
  const { net } = monthTotals(budget, new Date());
  const topGoal = budget.goals[0];
  const gp = topGoal ? goalProgress(topGoal) : null;

  return (
    <Widget t={t} accent={accent} onClick={() => setActiveSection('budget')}>
      <div>
        <div style={{ fontSize: '0.7rem', color: t.textMuted, letterSpacing: '0.05em' }}>this month · net</div>
        <div style={{ fontSize: '2rem', fontWeight: 200, color: net >= 0 ? t.doneAccent : t.alert, lineHeight: 1.1 }}>
          {formatMoney(net, budget.currency)}
        </div>
      </div>
      {topGoal && gp && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: t.textMuted, marginBottom: '0.3rem' }}>
            <span>{topGoal.name}</span>
            <span>{Math.round(gp.pct * 100)}%</span>
          </div>
          <div style={{ height: '5px', background: t.bgAlt, borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${gp.pct * 100}%`, height: '100%', background: t.doneAccent }} />
          </div>
        </div>
      )}
    </Widget>
  );
}
