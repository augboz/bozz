import { Clock } from 'lucide-react';
import { Widget, WidgetHeader } from '../shared/Widget';
import type { WidgetCtx, WidgetComponent } from './context';

/** A registered-but-not-yet-built widget. Keeps the Add panel complete. */
export function makePlaceholderWidget(label: string, milestone: string): WidgetComponent {
  const Component: WidgetComponent = ({ ctx }: { ctx: WidgetCtx }) => (
    <Widget t={ctx.t} accent={ctx.t.borderStrong}>
      <WidgetHeader label={label} accent={ctx.t.borderStrong} t={ctx.t} icon={Clock} />
      <div style={{
        marginTop: '1rem', fontSize: '0.8rem', color: ctx.t.textDim,
        fontStyle: 'italic', lineHeight: 1.4,
      }}>
        Arriving in a later update ({milestone}).
      </div>
    </Widget>
  );
  Component.displayName = `PlaceholderWidget(${label})`;
  return Component;
}
