/**
 * DailyPlannerWidget — home widget.
 *
 * Shows today's planned tasks (up to 5, +N more if needed).
 * Each task has a → button to advance to the next stage.
 * "View all" navigates to the Daily Planner section.
 */

import type { WidgetCtx } from './context';
import { Widget } from '../shared/Widget';
import { ExternalLink } from 'lucide-react';

const ACCENT = '#c9a8d4';
const MAX_VISIBLE = 5;

export default function DailyPlannerWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, topics, dailyPlan, onAdvanceStage, setActiveSection } = ctx;

  // Today's date key
  const todayKey = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return String(d.getTime());
  })();

  const todayIds = (dailyPlan?.[todayKey] ?? []).map(Number);

  // Resolve item + topic for each id
  const todayItems = todayIds.flatMap(id => {
    for (const topic of topics) {
      const item = topic.items.find(it => it.id === id);
      if (item) {
        const stage = topic.stages.find(s => s.id === item.stageId);
        if (!stage?.done) return [{ item, topic }];
      }
    }
    return [];
  });

  const visible = todayItems.slice(0, MAX_VISIBLE);
  const overflow = todayItems.length - visible.length;

  return (
    <Widget t={t} accent={ACCENT}>
      {todayItems.length === 0 ? (
        <div style={{
          marginTop: '0.85rem',
          fontSize: '0.8rem', color: t.textMuted, lineHeight: 1.5,
        }}>
          Nothing planned for today.{' '}
          <button
            onClick={() => setActiveSection('dailyPlanner')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: ACCENT, fontFamily: 'inherit', fontSize: 'inherit',
              fontWeight: 500, padding: 0,
            }}
          >
            Plan your day →
          </button>
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex', flexDirection: 'column',
            gap: '0.3rem', marginTop: '0.75rem',
          }}>
            {visible.map(({ item, topic }) => {
              const stage = topic.stages.find(s => s.id === item.stageId);
              const idx = topic.stages.findIndex(s => s.id === item.stageId);
              const isLastStage = idx === topic.stages.length - 1;
              const stageColor = stage?.color ?? topic.color;

              return (
                <div
                  key={`${topic.id}-${item.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.5rem',
                    background: t.bgAlt,
                    border: `1px solid ${t.border}`,
                    borderLeft: `3px solid ${topic.color}`,
                    borderRadius: '6px',
                  }}
                >
                  {/* Task name */}
                  <div style={{
                    flex: 1, minWidth: 0,
                    fontSize: '0.82rem', color: t.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.text}
                  </div>

                  {/* Stage pill — clickable to advance (disabled on last stage) */}
                  {stage && (
                    <button
                      onClick={() => !isLastStage && onAdvanceStage?.(topic.id, item.id)}
                      title={isLastStage ? stage.label : `Move to ${topic.stages[idx + 1]?.label}`}
                      disabled={isLastStage}
                      style={{
                        fontSize: '0.6rem',
                        color: stageColor,
                        background: stageColor + '22',
                        border: `1px solid ${stageColor + '55'}`,
                        padding: '2px 7px', borderRadius: '999px',
                        whiteSpace: 'nowrap', flexShrink: 0,
                        cursor: isLastStage ? 'default' : 'pointer',
                        fontFamily: 'inherit', fontWeight: 400,
                        opacity: isLastStage ? 0.7 : 1,
                        transition: 'background 0.12s',
                      }}
                    >
                      {stage.label}
                    </button>
                  )}
                </div>
              );
            })}

            {overflow > 0 && (
              <div style={{
                fontSize: '0.72rem', color: t.textDim,
                padding: '0.15rem 0.25rem',
              }}>
                +{overflow} more
              </div>
            )}
          </div>

          {/* View all link */}
          <button
            onClick={() => setActiveSection('dailyPlanner')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              marginTop: '0.65rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: t.textMuted, fontFamily: 'inherit', fontSize: '0.72rem',
              padding: 0,
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT)}
            onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
          >
            <ExternalLink size={11} strokeWidth={1.5} />
            View daily planner
          </button>
        </>
      )}
    </Widget>
  );
}