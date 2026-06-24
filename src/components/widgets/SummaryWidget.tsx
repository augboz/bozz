import { Widget, MiniStat, Divider } from '../shared/Widget';
import type { WidgetCtx } from './context';

export default function SummaryWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics } = ctx;

  let totalDoing = 0, totalTodo = 0, totalDone = 0;
  for (const topic of topics) {
    const doneStageIds = new Set(topic.stages.filter(s => s.done).map(s => s.id));
    // "Doing" = any non-first, non-done active stage; first active stage = "to do".
    const activeStages = topic.stages.filter(s => !s.done);
    const todoStageId = activeStages[0]?.id;
    const doingStageIds = new Set(activeStages.slice(1).map(s => s.id));
    for (const item of topic.items) {
      if (doneStageIds.has(item.stageId)) totalDone++;
      else if (doingStageIds.has(item.stageId)) totalDoing++;
      else if (item.stageId === todoStageId) totalTodo++;
    }
  }

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
