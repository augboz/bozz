import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, ChevronRight, Palette, Menu,
  Plug, NotebookPen, Power, RotateCcw, ListTree, LogOut, Plus, X,
} from 'lucide-react';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import type {
  AppearancePrefs, FontChoice, FontSize,
  MoodId, ReviewSettings, SectionId, Theme, Topic, TopicFolder,
} from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import { MOODS, THEME_COLOR_BANKS } from '../../lib/themes';
import { DEFAULT_COLOR_BANK } from '../../lib/appearance';
import TopicsBlock from './settings/TopicsBlock';

interface SettingsViewProps {
  t: Theme;
  appearance: AppearancePrefs;
  patchAppearance: (patch: Partial<AppearancePrefs>) => void;
  resetAppearance: () => void;
  resetHomeLayout: () => void;
  sections: Array<{ id: SectionId; label: string }>;
  reviewSettings: ReviewSettings;
  onReviewSettingsChange: (s: ReviewSettings) => void;
  /** Navigate to the standalone Apps page (Connected apps button). */
  onOpenApps: () => void;
  topics: Topic[];
  onTopicsChange: (next: Topic[]) => void;
  topicFolders: TopicFolder[];
  onTopicFoldersChange: (next: TopicFolder[]) => void;
  hiddenTopicIds: string[];
  onResetNavigation: () => void;
  accountEmail: string | null;
  onSignOut: () => Promise<void>;
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

// ── Colour bank editor ────────────────────────────────────────────────────────

const MAX_BANK = 30;

function ColorBankEditor({ t, bank, onChange, currentMood }: {
  t: Theme;
  bank: string[];
  onChange: (next: string[]) => void;
  currentMood: MoodId;
}) {
  const [pickerValue, setPickerValue] = useState('#7da7d9');
  const [themeSuggestion, setThemeSuggestion] = useState<MoodId | null>(null);
  const prevMood = useRef<MoodId>(currentMood);
  const inputRef = useRef<HTMLInputElement>(null);

  // When mood changes, offer to replace the bank with theme defaults
  useEffect(() => {
    if (prevMood.current !== currentMood) {
      prevMood.current = currentMood;
      setThemeSuggestion(currentMood);
    }
  }, [currentMood]);

  const addColor = () => {
    const hex = pickerValue.toLowerCase();
    if (bank.includes(hex)) return;
    if (bank.length >= MAX_BANK) return;
    onChange([...bank, hex]);
  };

  const removeColor = (c: string) => onChange(bank.filter(x => x !== c));

  const applyThemeBank = (mood: MoodId, replace: boolean) => {
    const suggestions = THEME_COLOR_BANKS[mood] ?? DEFAULT_COLOR_BANK;
    if (replace) {
      onChange(suggestions.slice(0, MAX_BANK));
    } else {
      const merged = [...bank];
      for (const c of suggestions) {
        if (!merged.includes(c) && merged.length < MAX_BANK) merged.push(c);
      }
      onChange(merged);
    }
    setThemeSuggestion(null);
  };

  const moodLabel = MOODS.find(m => m.id === (themeSuggestion ?? currentMood))?.label ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

      {/* Theme suggestion banner */}
      {themeSuggestion && (
        <div style={{
          background: t.doingBg, border: `1px solid ${t.doingBorder}`,
          borderRadius: '10px', padding: '0.65rem 0.9rem',
          display: 'flex', flexDirection: 'column', gap: '0.45rem',
        }}>
          <div style={{ fontSize: '0.78rem', color: t.text, fontWeight: 400 }}>
            Load <strong>{moodLabel}</strong> suggested colours?
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {(THEME_COLOR_BANKS[themeSuggestion] ?? []).slice(0, 10).map(c => (
              <div key={c} style={{ width: '14px', height: '14px', borderRadius: '3px', background: c, flexShrink: 0 }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => applyThemeBank(themeSuggestion, false)}
              style={{ background: t.doingAccent, color: '#fff', border: 'none', borderRadius: '7px', padding: '0.3rem 0.7rem', fontSize: '0.73rem', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              Add to bank
            </button>
            <button
              onClick={() => applyThemeBank(themeSuggestion, true)}
              style={{ background: 'transparent', color: t.doingAccent, border: `1px solid ${t.doingBorder}`, borderRadius: '7px', padding: '0.3rem 0.7rem', fontSize: '0.73rem', fontFamily: 'inherit', cursor: 'pointer' }}
            >
              Replace bank
            </button>
            <button
              onClick={() => setThemeSuggestion(null)}
              style={{ background: 'transparent', color: t.textMuted, border: 'none', fontSize: '0.73rem', fontFamily: 'inherit', cursor: 'pointer', padding: '0.3rem 0.4rem' }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Color wheel + add button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {/* Native color picker — full RGB wheel */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: `conic-gradient(red, yellow, lime, cyan, blue, magenta, red)`,
            boxShadow: '0 0 0 2px ' + t.border,
            cursor: 'pointer', flexShrink: 0, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onClick={() => inputRef.current?.click()}
          >
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: pickerValue, border: '2px solid rgba(255,255,255,0.8)' }} />
          </div>
          <input
            ref={inputRef}
            type="color"
            value={pickerValue}
            onChange={e => setPickerValue(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: '36px', height: '36px', cursor: 'pointer', border: 'none', padding: 0 }}
          />
        </div>
        <span style={{ fontSize: '0.72rem', color: t.textMuted, fontFamily: 'monospace' }}>{pickerValue}</span>
        <button
          onClick={addColor}
          disabled={bank.length >= MAX_BANK || bank.includes(pickerValue.toLowerCase())}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            background: bank.includes(pickerValue.toLowerCase()) ? t.bgAlt : t.text,
            color: bank.includes(pickerValue.toLowerCase()) ? t.textMuted : t.bg,
            border: 'none', borderRadius: '8px', padding: '0.35rem 0.75rem',
            fontSize: '0.73rem', fontFamily: 'inherit', cursor: 'pointer',
            opacity: bank.length >= MAX_BANK ? 0.5 : 1,
          }}
        >
          <Plus size={12} strokeWidth={2} />
          {bank.includes(pickerValue.toLowerCase()) ? 'Already added' : 'Add to bank'}
        </button>
        <span style={{ fontSize: '0.68rem', color: t.textDim }}>
          {bank.length}/{MAX_BANK}
        </span>
      </div>

      {/* Current bank swatches */}
      {bank.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: t.textDim, fontStyle: 'italic', margin: 0 }}>
          No colours in the bank — add some above, or load a theme palette.
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {bank.map(c => (
            <div key={c} style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px', background: c,
                border: `1px solid ${t.border}`,
              }} title={c} />
              <button
                onClick={() => removeColor(c)}
                title={`Remove ${c}`}
                style={{
                  position: 'absolute', top: '-5px', right: '-5px',
                  width: '14px', height: '14px', borderRadius: '50%',
                  background: t.panel, border: `1px solid ${t.borderStrong}`,
                  color: t.textMuted, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, fontSize: '8px', lineHeight: 1,
                }}
              >
                <X size={8} strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick-reset to defaults */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => onChange(DEFAULT_COLOR_BANK)}
          style={{
            background: 'transparent',
            border: `1px solid ${t.border}`, borderRadius: '7px',
            padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontFamily: 'inherit',
            cursor: 'pointer', color: t.textMuted,
          }}
        >
          Reset to defaults
        </button>
        <button
          onClick={() => onChange([])}
          disabled={bank.length === 0}
          style={{
            background: 'transparent',
            border: `1px solid ${bank.length === 0 ? t.border : t.alertBorder}`,
            borderRadius: '7px',
            padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontFamily: 'inherit',
            cursor: bank.length === 0 ? 'default' : 'pointer',
            color: bank.length === 0 ? t.textDim : t.alert,
            opacity: bank.length === 0 ? 0.45 : 1,
          }}
        >
          Empty bank
        </button>
      </div>
    </div>
  );
}

export default function SettingsView({
  t, appearance, patchAppearance, resetAppearance, resetHomeLayout, sections,
  reviewSettings, onReviewSettingsChange, onOpenApps,
  topics, onTopicsChange, topicFolders, onTopicFoldersChange, hiddenTopicIds, onResetNavigation,
  accountEmail, onSignOut,
}: SettingsViewProps) {
  const [autostartOn, setAutostartOn] = useState(true);
  const [checking, setChecking] = useState(true);

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

  const toggleSection = (id: SectionId) => {
    const hidden = appearance.hiddenSections.includes(id)
      ? appearance.hiddenSections.filter(s => s !== id)
      : [...appearance.hiddenSections, id];
    const defaultSection = (hidden as string[]).includes(appearance.defaultSection) ? 'home' : appearance.defaultSection;
    patchAppearance({ hiddenSections: hidden, defaultSection });
  };

  const toggleTopic = (id: string) => {
    const next = hiddenTopicIds.includes(id)
      ? hiddenTopicIds.filter(x => x !== id)
      : [...hiddenTopicIds, id];
    const defaultSection = next.includes(appearance.defaultSection) ? 'home' : appearance.defaultSection;
    patchAppearance({ hiddenTopicIds: next, defaultSection });
  };

  return (
    <div>
      <SectionHeader title="Settings" t={t} />

      {/* Connected apps — opens the standalone Apps page */}
      <button
        onClick={onOpenApps}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem',
          padding: '0.95rem 0.25rem',
          background: 'transparent', border: 'none', borderTop: `1px solid ${t.border}`,
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          transition: 'background 0.12s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = t.bgAlt)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Plug size={15} strokeWidth={1.6} color={t.textMuted} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '0.9rem', color: t.text, fontWeight: 500 }}>Connected apps</span>
        <ChevronRight size={15} strokeWidth={1.5} color={t.textDim} style={{ marginRight: '0.25rem' }} />
      </button>

      <Block title="Appearance" t={t} icon={Palette}>
        <Field label="Theme" t={t}>
          <Segmented<MoodId>
            value={appearance.mood} t={t}
            onChange={(v) => patchAppearance({ mood: v })}
            options={[
              { id: 'dark',  label: 'Dark' },
              { id: 'light', label: 'Light' },
            ]}
          />
        </Field>

        <Field label="Font" t={t}>
          <Segmented<FontChoice>
            value={appearance.font} t={t}
            onChange={(v) => patchAppearance({ font: v })}
            options={[
              { id: 'geist', label: 'Geist' },
              { id: 'manrope', label: 'Manrope' },
              { id: 'inter', label: 'Inter' },
              { id: 'fraunces', label: 'Fraunces' },
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
            onChange={(e) => patchAppearance({ defaultSection: e.target.value })}
            style={{
              background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.8rem',
              fontFamily: 'inherit', outline: 'none',
            }}
          >
            <optgroup label="Sections">
              {[
                { id: 'home' as SectionId, label: 'Home' },
                { id: 'inbox' as SectionId, label: 'Inbox' },
                ...sections.filter(s => !appearance.hiddenSections.includes(s.id)),
              ].map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </optgroup>
            {topics.filter(top => !hiddenTopicIds.includes(top.id)).length > 0 && (
              <optgroup label="Topics">
                {topics
                  .filter(top => !hiddenTopicIds.includes(top.id))
                  .map(top => <option key={top.id} value={top.id}>{top.name || '(unnamed)'}</option>)}
              </optgroup>
            )}
          </select>
        </Field>

        {/* ── Colour bank ── */}
        <div style={{ paddingTop: '0.5rem', borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: '0.78rem', color: t.text, fontWeight: 400, marginBottom: '0.6rem' }}>
            Colour bank
            <span style={{ marginLeft: '0.5rem', fontSize: '0.68rem', color: t.textDim, fontWeight: 300 }}>
              — the colours used everywhere in the app
            </span>
          </div>
          <ColorBankEditor
            t={t}
            bank={appearance.colorBank ?? []}
            onChange={(next) => patchAppearance({ colorBank: next })}
            currentMood={appearance.mood}
          />
        </div>
      </Block>

      <Block title="Topics" t={t} icon={ListTree}>
        <TopicsBlock
          t={t} topics={topics} setTopics={onTopicsChange}
          topicFolders={topicFolders} setTopicFolders={onTopicFoldersChange}
          colorBank={appearance.colorBank}
        />
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
        <Field label="Launch at startup" hint="Open BOZZ automatically when you log in" t={t}>
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

      {/* Sign out — bottom of the page, no dropdown */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '1.5rem', marginTop: '0.5rem' }}>
        {accountEmail && (
          <div style={{ fontSize: '0.78rem', color: t.textMuted, marginBottom: '0.75rem' }}>
            Signed in as <span style={{ color: t.text }}>{accountEmail}</span> · your data syncs across devices.
          </div>
        )}
        <button
          onClick={() => { void onSignOut(); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'transparent', border: `1px solid ${t.alertBorder}`,
            color: t.alert, borderRadius: '8px', padding: '0.5rem 1rem',
            fontSize: '0.8rem', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 300,
          }}
        >
          <LogOut size={14} strokeWidth={1.6} /> Sign out
        </button>
      </div>
    </div>
  );
}

