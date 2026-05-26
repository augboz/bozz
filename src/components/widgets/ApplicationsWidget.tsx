import { Briefcase } from 'lucide-react';
import { Widget, WidgetHeader, Stat } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import type { WidgetCtx } from './context';

export default function ApplicationsWidget({ ctx }: { ctx: WidgetCtx }) {
  const { applications: apps, t, setActiveSection } = ctx;
  const needToApply = apps.filter(a => a.status === 'need to apply').length;
  const openApps = apps.filter(a => ['need to apply', 'applied', 'interview'].includes(a.status)).length;
  const interviewing = apps.filter(a => a.status === 'interview').length;
  const offers = apps.filter(a => a.status === 'offer').length;

  return (
    <Widget t={t} accent={sectionAccents.applications} onClick={() => setActiveSection('applications')}>
      <WidgetHeader label="Applications" accent={sectionAccents.applications} t={t} icon={Briefcase} />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '1rem' }}>
        <div>
          <div style={{ fontSize: '3.25rem', fontWeight: 200, color: t.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {openApps}
          </div>
          <div style={{ fontSize: '0.75rem', color: t.textMuted, letterSpacing: '0.05em', marginTop: '0.35rem' }}>
            open · need attention
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
          {needToApply > 0 && <Stat label="to send" value={needToApply} color={t.pendingAccent} t={t} />}
          <Stat label="interviews" value={interviewing} color={t.doingAccent} t={t} />
          <Stat label="offers" value={offers} color={t.doneAccent} t={t} />
        </div>
      </div>
    </Widget>
  );
}
