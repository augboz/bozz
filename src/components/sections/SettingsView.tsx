import React, { useState, useEffect } from 'react';
import {
  ChevronDown, X, Palette, Menu, CalendarDays, Wallet,
  AtSign, Plug, NotebookPen, Power, RotateCcw, ListTree,
} from 'lucide-react';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import type {
  AppearancePrefs, CalendarFeed, EmailProvider, FontChoice, FontSize,
  MoodId, OAuthAccount, ReviewSettings, SectionId, Theme, Topic,
  WidgetBorder, WidgetShape,
} from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import { MOODS } from '../../lib/themes';
import { CURRENCIES } from '../../lib/budget';
import { relativeCompleted } from '../../lib/dates';
import MoodSwatch from '../shared/MoodSwatch';
import ConnectedAccountsBlock from './settings/ConnectedAccountsBlock';
import ConnectorsBlock from './settings/ConnectorsBlock';
import TopicsBlock from './settings/TopicsBlock';

interface SettingsViewProps {
  t: Theme;
  appearance: AppearancePrefs;
  patchAppearance: (patch: Partial<AppearancePrefs>) => void;
  resetAppearance: () => void;
  resetHomeLayout: () => void;
  sections: Array<{ id: SectionId; label: string }>;
  calendarFeeds: CalendarFeed[];
  onFeedsChange: (next: CalendarFeed[]) => void;
  onRefreshFeeds: () => void;
  feedsSyncing: boolean;
  lastSync: number | null;
  currency: string;
  onCurrencyChange: (c: string) => void;
  reviewSettings: ReviewSettings;
  onReviewSettingsChange: (s: ReviewSettings) => void;
  oauthAccounts: OAuthAccount[];
  emailSyncErrors: Array<{ account: string; error: string }>;
  onConnectAccount: (provider: EmailProvider, clientId: string, clientSecret: string) => Promise<void>;
  onDisconnectAccount: (provider: EmailProvider, email: string) => Promise<void>;
  topics: Topic[];
  onTopicsChange: (next: Topic[]) => void;
  hiddenTopicIds: string[];
  onResetNavigation: () => void;
}

function Block({ title, t, icon: Icon, children, defaultOpen = false }: {
  title: string; t: Theme; icon?: React.ElementType;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hover, setHover] = useState(false);
  return (
    <section style={{
      borderTop: `1px solid ${t.border}`,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem',
          padding: '0.85rem 0.25rem',
          background: hover ? t.bgAlt : 'transparent',
          border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
          transition: 'background 0.12s ease',
        }}
      >
        {Icon && <Icon size={15} strokeWidth={1.6} color={t.textMuted} style={{ flexShrink: 0 }} />}
        <h3 style={{
          flex: 1,
          fontSize: '0.9rem', color: t.text, fontWeight: 500, margin: 0,
          letterSpacing: 'normal', textTransform: 'none',
        }}>{title}</h3>
        <ChevronDown
          size={14} strokeWidth={1.5} color={t.textDim}
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.18s ease',
            flexShrink: 0, marginRight: '0.25rem',
          }}
        />
      </button>
      {open && (
        <div style={{ padding: '0.25rem 0.25rem 1.5rem 2.4rem' }}>
          {children}
        </div>
      )}
    </section>
  );
}

function Field({ label, hint, t, children }: { label: string; hint?: string; t: Theme; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '1rem', padding: '0.6rem 0',
    }}>
      <div>
        <div style={{ fontSize: '0.88rem', color: t.text, fontWeight: 300 }}>{label}</div>
        {hint && <div style={{ fontSize: '0.72rem', color: t.textMuted, marginTop: '0.15rem' }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, t }: {
  value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void; t: Theme;
}) {
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      {options.map((o, i) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            style={{
              background: on ? t.bgAlt : 'transparent',
              color: on ? t.text : t.textMuted,
              border: 'none', borderLeft: i === 0 ? 'none' : `1px solid ${t.border}`,
              padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontFamily: 'inherit',
              cursor: 'pointer', fontWeight: 300, letterSpacing: '0.02em',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ on, onClick, t, disabled }: { on: boolean; onClick: () => void; t: Theme; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      style={{
        width: '42px', height: '24px', borderRadius: '999px', border: 'none',
        cursor: disabled ? 'wait' : 'pointer', flexShrink: 0,
        background: on ? t.doneAccent : t.borderStrong,
        transition: 'background 0.2s', position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px', left: on ? '21px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
      }} />
    </button>
  );
}

export default function SettingsView({
  t, appearance, patchAppearance, resetAppearance, resetHomeLayout, sections,
  calendarFeeds, onFeedsChange, onRefreshFeeds, feedsSyncing, lastSync,
  currency, onCurrencyChange,
  reviewSettings, onReviewSettingsChange,
  oauthAccounts, emailSyncErrors, onConnectAccount, onDisconnectAccount,
  topics, onTopicsChange, hiddenTopicIds, onResetNavigation,
}: SettingsViewProps) {
  const [autostartOn, setAutostartOn] = useState(true);
  const [checking, setChecking] = useState(true);
  const [feedLabel, setFeedLabel] = useState('');
  const [feedUrl, setFeedUrl] = useState('');

  const addFeed = () => {
    const label = feedLabel.trim();
    let url = feedUrl.trim();
    if (!label || !url) return;
    // Accept webcal:// (e.g. Scientia, Apple Calendar) — just swap the scheme
    if (/^webcal:\/\//i.test(url)) url = 'https://' + url.slice(9);
    if (!/^https:\/\//i.test(url)) return;
    onFeedsChange([...calendarFeeds, { id: crypto.randomUUID(), label, url }]);
    setFeedLabel('');
    setFeedUrl('');
  };
  const removeFeed = (id: string) =>
    onFeedsChange(calendarFeeds.filter(f => f.id !== id));

  useEffect(() => {
    isEnabled()
      .then(v => { setAutostartOn(v); setChecking(false); })
      .catch(() => setChecking(false));
  }, []);

  const toggleAutostart = async () => {
    try {
      if (autostartOn) { await disable(); } else { await enable(); }
      setAutostartOn(v => !v);
    } catch (e) { console.error('Autostart error:', e); }
  };

  const hideable = sections.filter(s => s.id !== 'settings');
  const visibleSections = sections.filter(s => !appearance.hiddenSections.includes(s.id));

  const toggleSection = (id: SectionId) => {
    const hidden = appearance.hiddenSections.includes(id)
      ? appearance.hiddenSections.filter(s => s !== id)
      : [...appearance.hiddenSections, id];
    const defaultSection = hidden.includes(appearance.defaultSection) ? 'home' : appearance.defaultSection;
    patchAppearance({ hiddenSections: hidden, defaultSection });
  };

  const toggleTopic = (id: string) => {
    const next = hiddenTopicIds.includes(id)
      ? hiddenTopicIds.filter(x => x !== id)
      : [...hiddenTopicIds, id];
    patchAppearance({ hiddenTopicIds: next });
  };

  return (
    <div>
      <SectionHeader title="Settings" t={t} />

      <Block title="Appearance" t={t} icon={Palette}>
        <div style={{ padding: '0.6rem 0' }}>
          <div style={{ fontSize: '0.88rem', color: t.text, fontWeight: 300, marginBottom: '0.75rem' }}>Mood</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
            {MOODS.map(m => {
              const on = appearance.mood === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => patchAppearance({ mood: m.id as MoodId })}
                  aria-pressed={on}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    background: on ? t.bgAlt : 'transparent',
                    border: `1px solid ${on ? t.borderStrong : t.border}`,
                    borderRadius: '10px', padding: '0.6rem 0.75rem',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <MoodSwatch color={m.swatch} />
                  <span style={{ fontSize: '0.82rem', color: on ? t.text : t.textMuted, fontWeight: 300 }}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Font" t={t}>
          <Segmented<FontChoice>
            value={appearance.font} t={t}
            onChange={(v) => patchAppearance({ font: v })}
            options={[
              { id: 'inter', label: 'Inter' },
              { id: 'manrope', label: 'Manrope' },
              { id: 'quicksand', label: 'Quicksand' },
              { id: 'mono', label: 'Mono' },
            ]}
          />
        </Field>
        <Field label="Text size" t={t}>
          <Segmented<FontSize>
            value={appearance.fontSize} t={t}
            onChange={(v) => patchAppearance({ fontSize: v })}
            options={[{ id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }]}
          />
        </Field>
        <Field label="Default section" hint="Where the app opens on launch" t={t}>
          <select
            value={appearance.defaultSection}
            onChange={(e) => patchAppearance({ defaultSection: e.target.value as SectionId })}
            style={{
              background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.8rem',
              fontFamily: 'inherit', outline: 'none',
            }}
          >
            {visibleSections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Widget shape" hint="Corner radius of home widgets" t={t}>
          <Segmented<WidgetShape>
            value={appearance.widgetShape ?? 'rounded'} t={t}
            onChange={(v) => patchAppearance({ widgetShape: v })}
            options={[
              { id: 'sharp',   label: 'Sharp' },
              { id: 'rounded', label: 'Rounded' },
              { id: 'pill',    label: 'Pill' },
            ]}
          />
        </Field>
        <Field label="Widget border" hint="How prominent each widget's outline is" t={t}>
          <Segmented<WidgetBorder>
            value={appearance.widgetBorder ?? 'normal'} t={t}
            onChange={(v) => patchAppearance({ widgetBorder: v })}
            options={[
              { id: 'subtle', label: 'None' },
              { id: 'normal', label: 'Thin' },
              { id: 'bold',   label: 'Bold' },
            ]}
          />
        </Field>
      </Block>

      <Block title="Topics" t={t} icon={ListTree} defaultOpen>
        <TopicsBlock t={t} topics={topics} setTopics={onTopicsChange} />
      </Block>

      <Block title="Navigation" t={t} icon={Menu}>
        {hideable.map(s => (
          <Field key={s.id} label={s.label} t={t}>
            <Toggle
              on={!appearance.hiddenSections.includes(s.id)}
              onClick={() => toggleSection(s.id)}
              t={t}
            />
          </Field>
        ))}
        {topics.length > 0 && (
          <>
            <div style={{
              fontSize: '0.68rem', color: t.textDim, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '0.75rem 0 0.1rem',
            }}>
              Topics
            </div>
            {topics.map(top => (
              <Field key={top.id} label={top.name || '(unnamed)'} t={t}>
                <Toggle
                  on={!hiddenTopicIds.includes(top.id)}
                  onClick={() => toggleTopic(top.id)}
                  t={t}
                />
              </Field>
            ))}
          </>
        )}
        <div style={{ paddingTop: '0.85rem' }}>
          <button
            onClick={onResetNavigation}
            style={{
              background: 'transparent', border: `1px solid ${t.border}`,
              borderRadius: '8px', padding: '0.4rem 0.9rem',
              fontSize: '0.78rem', color: t.textMuted,
              fontFamily: 'inherit', cursor: 'pointer', fontWeight: 300,
            }}
          >
            Reset navigation to defaults
          </button>
        </div>
      </Block>

      <Block title="Calendar feeds" t={t} icon={CalendarDays}>
        <p style={{ fontSize: '0.72rem', color: t.textMuted, margin: '0 0 0.85rem', lineHeight: 1.6 }}>
          Paste any <strong style={{ color: t.text }}>.ics / iCal</strong> URL here —
          Google Calendar, Outlook, and most uni timetable systems support them.
          Both <code style={{ fontSize: '0.68rem', background: t.bgAlt, padding: '0.1rem 0.3rem', borderRadius: '3px' }}>https://</code> and{' '}
          <code style={{ fontSize: '0.68rem', background: t.bgAlt, padding: '0.1rem 0.3rem', borderRadius: '3px' }}>webcal://</code> links work.
        </p>
        <p style={{ fontSize: '0.72rem', color: t.textMuted, margin: '0 0 0.85rem', lineHeight: 1.6 }}>
          <strong style={{ color: t.text }}>Imperial Scientia:</strong>{' '}
          Log into <strong>my.imperial.ac.uk</strong> → My timetable → look for a
          "Subscribe" or "iCal" export button. Copy that URL (it may start with{' '}
          <code style={{ fontSize: '0.68rem', background: t.bgAlt, padding: '0.1rem 0.3rem', borderRadius: '3px' }}>webcal://</code>
          — paste it as-is, it will be converted automatically).
        </p>

        {calendarFeeds.length > 0 && (
          <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '0.85rem' }}>
            {calendarFeeds.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: t.todoBg, border: `1px solid ${t.border}`,
                borderRadius: '8px', padding: '0.5rem 0.75rem',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', color: t.text }}>{f.label}</div>
                  <div style={{
                    fontSize: '0.68rem', color: t.textDim,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.url}
                  </div>
                </div>
                <button
                  onClick={() => removeFeed(f.id)}
                  aria-label={`Remove ${f.label}`}
                  style={{
                    background: 'transparent', border: 'none', color: t.textMuted,
                    cursor: 'pointer', padding: '0.2rem', flexShrink: 0,
                  }}
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <input
            value={feedLabel}
            onChange={e => setFeedLabel(e.target.value)}
            placeholder="label — e.g. Imperial timetable"
            style={feedInput(t)}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={feedUrl}
              onChange={e => setFeedUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addFeed()}
              placeholder="https:// or webcal:// …"
              style={{ ...feedInput(t), flex: 1 }}
            />
            <button onClick={addFeed} style={{
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0 0.9rem', color: t.textMuted, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.78rem',
            }}>
              add
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: '0.85rem',
        }}>
          <span style={{ fontSize: '0.7rem', color: t.textDim }}>
            {feedsSyncing
              ? 'syncing…'
              : lastSync != null ? `synced ${relativeCompleted(lastSync)}` : 'not synced yet'}
          </span>
          <button
            onClick={onRefreshFeeds}
            disabled={feedsSyncing || calendarFeeds.length === 0}
            style={{
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.35rem 0.8rem', color: t.textMuted,
              cursor: feedsSyncing || calendarFeeds.length === 0 ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: '0.75rem', opacity: calendarFeeds.length === 0 ? 0.5 : 1,
            }}
          >
            Refresh now
          </button>
        </div>
      </Block>

      <Block title="Budget" t={t} icon={Wallet}>
        <Field label="Currency" hint="Used across the Budget section" t={t}>
          <select
            value={currency}
            onChange={e => onCurrencyChange(e.target.value)}
            aria-label="Currency"
            style={{
              background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.8rem',
              fontFamily: 'inherit', outline: 'none',
            }}
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </Block>

      <Block title="Connected accounts" t={t} icon={AtSign}>
        <ConnectedAccountsBlock
          t={t}
          accounts={oauthAccounts}
          syncErrors={emailSyncErrors}
          onConnect={onConnectAccount}
          onDisconnect={onDisconnectAccount}
        />
      </Block>

      <Block title="Connectors" t={t} icon={Plug}>
        <ConnectorsBlock t={t} />
      </Block>

      <Block title="Weekly review" t={t} icon={NotebookPen}>
        <Field label="Day" hint="When the week-ending review becomes available" t={t}>
          <select
            value={reviewSettings.dayOfWeek}
            onChange={e => onReviewSettingsChange({ ...reviewSettings, dayOfWeek: Number(e.target.value) })}
            aria-label="Review day"
            style={{
              background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.8rem',
              fontFamily: 'inherit', outline: 'none',
            }}
          >
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Time" t={t}>
          <select
            value={reviewSettings.hour}
            onChange={e => onReviewSettingsChange({ ...reviewSettings, hour: Number(e.target.value) })}
            aria-label="Review hour"
            style={{
              background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.8rem',
              fontFamily: 'inherit', outline: 'none',
            }}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
            ))}
          </select>
        </Field>
      </Block>

      <Block title="Startup" t={t} icon={Power}>
        <Field label="Launch at startup" hint="Open Life Bozz automatically when you log in" t={t}>
          <Toggle on={autostartOn} onClick={toggleAutostart} t={t} disabled={checking} />
        </Field>
      </Block>

      <Block title="Reset" t={t} icon={RotateCcw}>
        <Field label="Reset appearance to defaults" hint="Mood, font, text size, nav — your data is untouched" t={t}>
          <button
            onClick={resetAppearance}
            style={{
              background: 'transparent', border: `1px solid ${t.alertBorder}`,
              color: t.alert, borderRadius: '8px', padding: '0.4rem 0.9rem',
              fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 300,
            }}
          >
            Reset
          </button>
        </Field>
        <Field label="Reset home layout" hint="Restore the default widgets & arrangement" t={t}>
          <button
            onClick={resetHomeLayout}
            style={{
              background: 'transparent', border: `1px solid ${t.alertBorder}`,
              color: t.alert, borderRadius: '8px', padding: '0.4rem 0.9rem',
              fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 300,
            }}
          >
            Reset
          </button>
        </Field>
      </Block>
    </div>
  );
}

const feedInput = (t: Theme): React.CSSProperties => ({
  background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.5rem 0.7rem', color: t.text, fontSize: '0.8rem',
  fontFamily: 'inherit', outline: 'none',
});
