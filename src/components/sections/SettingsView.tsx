import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Palette,
  Plug, RotateCcw, LogOut, Plus, X,
  Sparkles, HelpCircle,
} from 'lucide-react';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import type {
  AppearancePrefs, FontChoice, FontSize,
  MoodId, ReviewSettings, SectionId, Theme, Topic,
} from '../../lib/types';
import { SectionHeader } from '../shared/ui';
import { MOODS, THEME_COLOR_BANKS } from '../../lib/themes';
import { DEFAULT_COLOR_BANK } from '../../lib/appearance';
import PlanBlock from './settings/PlanBlock';

interface SettingsViewProps {
  t: Theme;
  appearance: AppearancePrefs;
  patchAppearance: (patch: Partial<AppearancePrefs>) => void;
  resetAppearance: () => void;
  resetHomeLayout: () => void;
  onClearTopics: () => void;
  sections: Array<{ id: SectionId; label: string }>;
  reviewSettings: ReviewSettings;
  onReviewSettingsChange: (s: ReviewSettings) => void;
  /** Navigate to the standalone Apps page (Connected apps button). */
  onOpenApps: () => void;
  /** Re-show the new-user getting-started walkthroughs on the Home page. */
  onReplayWalkthroughs: () => void;
  topics: Topic[];
  hiddenTopicIds: string[];
  accountEmail: string | null;
  onSignOut: () => Promise<void>;
  onOpenWorlds: () => void;
  /** Navigate to the Email page (where Priority alerts live). */
  onOpenEmail: () => void;
}

// A settings section. Flat by default (content always shown); pass
// `collapsible` to make it a dropdown that opens on click.
function Block({ title, t, icon: Icon, children, collapsible, defaultOpen }: {
  title: string; t: Theme; icon?: React.ElementType;
  children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const heading = (
    <>
      {Icon && <Icon size={15} strokeWidth={1.6} color={t.textMuted} style={{ flexShrink: 0 }} />}
      <h3 style={{
        flex: 1, fontSize: '0.78rem', color: t.textMuted, fontWeight: 500, margin: 0,
        letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'left',
      }}>{title}</h3>
    </>
  );
  if (!collapsible) {
    return (
      <section style={{ borderTop: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '1.1rem 0.25rem 0.4rem' }}>
          {heading}
        </div>
        <div style={{ padding: '0.25rem 0.25rem 1.5rem 2.4rem' }}>{children}</div>
      </section>
    );
  }
  return (
    <section style={{ borderTop: `1px solid ${t.border}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem',
          padding: '1.1rem 0.25rem', background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {heading}
        <ChevronDown
          size={15} strokeWidth={1.5} color={t.textDim}
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.18s ease', flexShrink: 0, marginRight: '0.25rem' }}
        />
      </button>
      {open && <div style={{ padding: '0.25rem 0.25rem 1.5rem 2.4rem' }}>{children}</div>}
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

function Faq({ t, q, a, action }: {
  t: Theme; q: string; a: string; action?: { label: string; onClick: () => void };
}) {
  return (
    <div>
      <div style={{ fontSize: '0.84rem', color: t.text, fontWeight: 500, marginBottom: '0.2rem' }}>{q}</div>
      <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5 }}>{a}</div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: '0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
            padding: '0.3rem 0.7rem', color: t.textMuted, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '0.74rem',
          }}
        >
          {action.label} <ChevronRight size={12} strokeWidth={1.6} />
        </button>
      )}
    </div>
  );
}

// Orange reset buttons shown just above sign out.
const resetBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #e0892b', color: '#e0892b',
  borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.8rem',
  fontFamily: 'inherit', cursor: 'pointer', fontWeight: 400,
};

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
          No colours in the bank yet. Add some above, or load a theme palette.
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
  t, appearance, patchAppearance, resetAppearance, resetHomeLayout, onClearTopics, sections,
  reviewSettings, onReviewSettingsChange, onOpenApps, onReplayWalkthroughs,
  topics, hiddenTopicIds,
  accountEmail, onSignOut, onOpenWorlds, onOpenEmail,
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

  // Compact selects for the low-key weekly-review control tucked into Help.
  const reviewSelectStyle: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.3rem 0.5rem', color: t.text, fontSize: '0.75rem',
    fontFamily: 'inherit', outline: 'none',
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

      <Block title="Appearance" t={t} icon={Palette} collapsible>
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
              the colours used across the app
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

      <Block title="Bozz Plus" t={t} icon={Sparkles}>
        <PlanBlock t={t} onOpenWorlds={onOpenWorlds} onOpenEmail={onOpenEmail} />
      </Block>

      <Block title="Help" t={t} icon={HelpCircle} collapsible>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <button
            onClick={onReplayWalkthroughs}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-start',
              background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '0.45rem 0.85rem', color: t.text, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.8rem',
            }}
          >
            <RotateCcw size={14} strokeWidth={1.6} color={t.textMuted} /> Replay walkthroughs
          </button>

          {/* Launch on startup — folded into Help to keep the page tidy */}
          <Field label="Launch Bozz when you open your laptop" hint="Desktop app only" t={t}>
            <Toggle on={autostartOn} onClick={toggleAutostart} t={t} disabled={checking} />
          </Field>
          <Faq t={t} q="How do I connect Gmail or Outlook?"
            a="Open Connected apps and follow the short setup guide for your provider, then paste the keys it gives you."
            action={{ label: 'Connected apps', onClick: onOpenApps }} />
          <Faq t={t} q="How do I change the theme or wallpaper?"
            a="Browse Worlds to apply a theme, or a ready-made template page, in one tap. You can revert anytime."
            action={{ label: 'Browse Worlds', onClick: onOpenWorlds }} />
          <Faq t={t} q="How do I add or edit topics and folders?"
            a="In the sidebar, click Edit, then the plus to add or the pencil to edit. Drag to reorder, and the eye to hide." />
          <Faq t={t} q="How do priority alerts work?"
            a="Open the Email page and tap Priority alerts to watch senders or keywords. Bozz pings you when a matching email lands, even when it is tucked away in the tray." />
          <Faq t={t} q="Is my data private?"
            a="Your data syncs across your own devices and is never sold. You can clear topics anytime below, and reset the look without touching your data." />

          {/* Weekly review — intentionally low-key: a small timing control, not a headline feature */}
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.84rem', color: t.text, fontWeight: 500, marginBottom: '0.2rem' }}>Weekly review</div>
            <div style={{ fontSize: '0.78rem', color: t.textMuted, lineHeight: 1.5, marginBottom: '0.55rem' }}>
              A calm week-ending summary. Pick when it becomes available — that's all there is to set.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={reviewSettings.dayOfWeek}
                onChange={e => onReviewSettingsChange({ ...reviewSettings, dayOfWeek: Number(e.target.value) })}
                aria-label="Weekly review day"
                style={reviewSelectStyle}
              >
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.74rem', color: t.textDim }}>at</span>
              <select
                value={reviewSettings.hour}
                onChange={e => onReviewSettingsChange({ ...reviewSettings, hour: Number(e.target.value) })}
                aria-label="Weekly review time"
                style={reviewSelectStyle}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset — plain orange buttons, folded into Help */}
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.84rem', color: t.text, fontWeight: 500, marginBottom: '0.5rem' }}>Reset</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button onClick={resetAppearance} style={resetBtn}>Reset appearance</button>
              <button onClick={resetHomeLayout} style={resetBtn}>Reset home layout</button>
              <button
                onClick={() => {
                  if (!window.confirm(`Delete all ${topics.length} topic${topics.length !== 1 ? 's' : ''} and their folders? This cannot be undone.`)) return;
                  onClearTopics();
                }}
                style={resetBtn}
              >
                Clear all topics and folders
              </button>
            </div>
          </div>
        </div>
      </Block>

      {/* Sign out — bottom of the page */}
      <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '1.2rem', marginTop: '0.5rem' }}>
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

