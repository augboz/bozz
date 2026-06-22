/**
 * AppsView — the "Connect apps" page.
 *
 * A searchable, grid-laid-out view of every integration. Reuses the existing
 * IntegrationsBlock cards (Gmail, Calendar, Notion, Spotify, …) via its
 * `variant="grid"` + `searchQuery` props. Reached from the Apps button next to
 * the Quicks (⚡) button and from the Settings page.
 */

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type {
  CalendarConnection, EmailProvider, HealthConnection, OAuthAccount, Theme,
} from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import IntegrationsBlock from './settings/IntegrationsBlock';

interface Props {
  t: Theme;
  colorBank?: string[];
  oauthAccounts: OAuthAccount[];
  emailSyncErrors: Array<{ account: string; error: string }>;
  onConnectAccount: (provider: EmailProvider, clientId: string) => Promise<void>;
  onDisconnectAccount: (provider: EmailProvider, email: string) => Promise<void>;
  calendarConnections: CalendarConnection[];
  onCalendarConnectionsChange: (next: CalendarConnection[]) => void;
  healthConnections: HealthConnection[];
  onHealthConnectionsChange: (next: HealthConnection[]) => void;
}

export default function AppsView({
  t, colorBank, oauthAccounts, emailSyncErrors, onConnectAccount, onDisconnectAccount,
  calendarConnections, onCalendarConnectionsChange,
  healthConnections, onHealthConnectionsChange,
}: Props) {
  const [query, setQuery] = useState('');

  return (
    <div>
      <SectionHeader title="Connect apps" t={t} />

      {/* Search bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.55rem',
        background: t.input, border: `1px solid ${t.border}`, borderRadius: '10px',
        padding: '0.55rem 0.8rem', marginBottom: '1.4rem', maxWidth: '460px',
      }}>
        <Search size={16} strokeWidth={1.6} color={t.textMuted} style={{ flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search apps — Gmail, Notion, Spotify…"
          aria-label="Search apps"
          autoFocus
          style={{
            flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
            color: t.text, fontSize: '0.85rem', fontFamily: 'inherit',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: '0.1rem', display: 'flex', flexShrink: 0 }}
          >
            <X size={15} strokeWidth={1.6} />
          </button>
        )}
      </div>

      <IntegrationsBlock
        t={t}
        variant="grid"
        searchQuery={query}
        colorBank={colorBank}
        oauthAccounts={oauthAccounts}
        emailSyncErrors={emailSyncErrors}
        onConnectAccount={onConnectAccount}
        onDisconnectAccount={onDisconnectAccount}
        calendarConnections={calendarConnections}
        onCalendarConnectionsChange={onCalendarConnectionsChange}
        healthConnections={healthConnections}
        onHealthConnectionsChange={onHealthConnectionsChange}
      />
    </div>
  );
}
