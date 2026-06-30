/**
 * WelcomeTimetable — the third guided step shown to brand-new accounts, right
 * after the "what are you here for?" cold-start choice.
 *
 * Two ways in, with TYPE as the default (the activation unblock — most students
 * can't produce an .ics link):
 *   - "Type my classes"  — TypeTimetableForm parses plain-English lines offline
 *     into recurring CalendarNotes (noteEvents() expands them onto Today + the
 *     calendar). The default tab.
 *   - "Paste a link"     — the existing AddFeedForm (.ics / webcal:// feed).
 *
 * Same neutral full-screen welcome overlay as the theme + cold-start steps, so it
 * feels like one continuous flow. Either path fills Today + the calendar.
 *
 * Skippable — a user with neither lands straight on their dashboard.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Keyboard, Link2 } from 'lucide-react';
import type { CalendarFeed, CalendarNote, Theme } from '../../lib/types';
import AddFeedForm from '../sections/calendar/AddFeedForm';
import TypeTimetableForm from '../sections/calendar/TypeTimetableForm';

export default function WelcomeTimetable({ t, colorBank, onAdd, onAddNotes, onSkip }: {
  t: Theme;
  colorBank: string[];
  onAdd: (feed: CalendarFeed) => void;
  /** Append the typed recurring classes to calendarNotes, then finish. */
  onAddNotes: (notes: Omit<CalendarNote, 'id'>[]) => void;
  onSkip: () => void;
}) {
  const [showHelp, setShowHelp] = useState(false);
  // Type is the default — it's the unblock for students without an .ics link.
  const [tab, setTab] = useState<'type' | 'paste'>('type');

  const tabBtn = (id: 'type' | 'paste', label: string, Icon: typeof Keyboard) => {
    const on = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          background: on ? 'rgba(94,196,216,0.16)' : 'transparent',
          border: `1px solid ${on ? '#5ec4d8' : 'rgba(255,255,255,0.14)'}`,
          color: on ? '#bfeaf2' : 'rgba(255,255,255,0.55)',
          borderRadius: '9px', padding: '0.4rem 0.85rem', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 500,
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        }}
      >
        <Icon size={13} strokeWidth={1.7} /> {label}
      </button>
    );
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'radial-gradient(120% 120% at 50% 0%, #15161a 0%, #08080a 60%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '1.3rem', padding: '2rem', overflowY: 'auto',
    }}>
      <img src="/brand/bozz-mark-dark.png" alt="" width={52} height={52}
        style={{ width: '52px', height: '52px', borderRadius: '13px', objectFit: 'cover' }} />
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#f2f2f2', letterSpacing: '-0.02em' }}>
          Add your timetable
        </h1>
        <div style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.4rem', maxWidth: '460px' }}>
          Your real classes drop straight onto the calendar and into Today, so your morning is set up before you’ve typed a thing.
        </div>
      </div>

      {/* Tab switch — Type (default) vs Paste a link */}
      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
        {tabBtn('type', 'Type my classes', Keyboard)}
        {tabBtn('paste', 'Paste a link', Link2)}
      </div>

      <div style={{ width: 'min(460px, 92vw)' }}>
        {tab === 'type' ? (
          <TypeTimetableForm
            t={t}
            colorBank={colorBank}
            onAddNotes={onAddNotes}
            onClose={onSkip}
            compact
          />
        ) : (
          <>
            <AddFeedForm
              t={t}
              colorBank={colorBank}
              onAdd={onAdd}
              onClose={onSkip}
            />
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowHelp(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  color: 'rgba(94,196,216,0.9)', fontSize: '0.8rem', marginTop: '0.6rem', padding: '0.2rem',
                }}
              >
                <HelpCircle size={13} strokeWidth={1.6} /> where do I find this?
              </button>
              {showHelp && (
                <div style={{
                  maxWidth: '440px', margin: '0.5rem auto 0', textAlign: 'left',
                  fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', padding: '0.7rem 0.9rem',
                }}>
                  <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Google Calendar:</strong> Settings → your calendar →
                  “Secret address in iCal format”.<br />
                  <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Uni / work portal:</strong> look for
                  “Subscribe”, “Export”, or an <code style={{ fontSize: '0.72rem' }}>.ics</code> /
                  <code style={{ fontSize: '0.72rem' }}> webcal://</code> link on your timetable page.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <button
        onClick={onSkip}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', padding: '0.5rem 1rem',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
      >
        Skip for now
      </button>
    </div>,
    document.body,
  );
}
