import { Widget, MiniStat, Divider } from '../shared/Widget';
import type { WidgetCtx } from './context';

export default function SummaryWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, musicItems, lifeItems, cvItems, otherItems, applications } = ctx;
  const allItems = [...musicItems, ...lifeItems, ...cvItems, ...otherItems];

  const totalDoing = allItems.filter(i => i.status === 'doing').length +
    applications.filter(a => a.status === 'interview').length;
  const totalTodo = allItems.filter(i => i.status === 'todo').length +
    applications.filter(a => a.status === 'need to apply' || a.status === 'applied').length;
  const totalDone = allItems.filter(i => i.status === 'done').length +
    applications.filter(a => a.status === 'offer').length;

  return (
    <Widget t={t} accent={t.borderStrong} compact>
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0.25rem 0', height: '100%' }}>
        <MiniStat label="doing" value={totalDoing} color={t.doingAccent} t={t} />
        <Divider t={t} />
        <MiniStat label="to do" value={totalTodo} color={t.textMuted} t={t} />
        <Divider t={t} />
        <MiniStat label="done" value={totalDone} color={t.doneAccent} t={t} />
      </div>
    </Widget>
  );
}
