import { useEffect, useState } from 'react';
import { Widget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import type { WidgetCtx } from './context';

function pad(n: number) { return n.toString().padStart(2, '0'); }

export default function ClockWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t } = ctx;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // compact when widget is short (h < 4 grid rows)
  const compact = (ctx.widgetConfig?._h as number | undefined ?? 4) < 4;

  return (
    <Widget t={t} accent={sectionAccents.home}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%',
        gap: compact ? '0.1rem' : '0.35rem',
      }}>
        <div style={{
          fontSize: compact ? '2.2rem' : '3.2rem',
          fontWeight: 200,
          letterSpacing: '-0.02em',
          color: t.text,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          {h}:{m}
          <span style={{ fontSize: compact ? '1.1rem' : '1.6rem', color: t.textMuted, marginLeft: '0.2rem' }}>
            :{s}
          </span>
        </div>
        {!compact && (
          <div style={{ fontSize: '0.75rem', color: t.textMuted, letterSpacing: '0.04em' }}>
            {date}
          </div>
        )}
      </div>
    </Widget>
  );
}
