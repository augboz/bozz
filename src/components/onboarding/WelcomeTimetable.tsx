/**
 * WelcomeTimetable — the third guided step shown to brand-new accounts, right
 * after the "what are you here for?" cold-start choice.
 *
 * Wraps the EXISTING AddFeedForm (webcal:// → https:// rewrite + fetch/parse
 * validation already live there) in the same neutral full-screen welcome overlay
 * as the theme + cold-start steps, so pasting a real timetable feels like one
 * continuous flow. On success the parsed classes fill Today + the calendar.
 *
 * Skippable — a user without a calendar link lands straight on their dashboard.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import type { CalendarFeed, Theme } from '../../lib/types';
import AddFeedForm from '../sections/calendar/AddFeedForm';

export default function WelcomeTimetable({ t, colorBank, onAdd, onSkip }: {
  t: Theme;
  colorBank: string[];
  onAdd: (feed: CalendarFeed) => void;
  onSkip: () => void;
}) {
  const [showHelp, setShowHelp] = useState(false);

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'radial-gradient(120% 120% at 50% 0%, #15161a 0%, #08080a 60%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '1.6rem', padding: '2rem', overflowY: 'auto',
    }}>
      <img src="/brand/bozz-mark-dark.png" alt="" width={52} height={52}
        style={{ width: '52px', height: '52px', borderRadius: '13px', objectFit: 'cover' }} />
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#f2f2f2', letterSpacing: '-0.02em' }}>
          Paste your timetable link
        </h1>
        <div style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.55)', marginTop: '0.4rem', maxWidth: '440px' }}>
          Your real classes drop straight onto the calendar and into Today — so your morning is set up before you’ve typed a thing.
        </div>
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

      <div style={{ width: 'min(440px, 92vw)' }}>
        <AddFeedForm
          t={t}
          colorBank={colorBank}
          onAdd={onAdd}
          onClose={onSkip}
        />
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
