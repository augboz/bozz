/**
 * brandLogos — recognizable, self-contained SVG marks for each integration.
 *
 * Rendered on a neutral white "app tile" so they read correctly on both light
 * and dark themes (the same way app stores / integration directories show
 * service icons). These are simple, hand-drawn renditions used purely to
 * identify the service a user is connecting to.
 */
import React from 'react';

export type BrandId =
  | 'gmail' | 'outlook' | 'icloud' | 'imap' | 'gcal' | 'acal'
  | 'spotify' | 'notion' | 'gfit' | 'ahealth' | 'whatsapp'
  | 'strava' | 'zoom';

const LOGOS: Record<BrandId, (s: number) => React.ReactNode> = {
  // Gmail — multicolour envelope.
  gmail: (s) => (
    <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4caf50" d="M45 16.2l-5 2.75-5 4.75L35 40h7c1.66 0 3-1.34 3-3V16.2z" />
      <path fill="#1e88e5" d="M3 16.2l3.61 1.71L13 23.7V40H6c-1.66 0-3-1.34-3-3V16.2z" />
      <polygon fill="#e53935" points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17" />
      <path fill="#c62828" d="M3 12.3v3.9l10 7.5V11.2L9.88 8.86C9.13 8.3 8.23 8 7.3 8 4.92 8 3 9.92 3 12.3z" />
      <path fill="#fbc02d" d="M45 12.3v3.9l-10 7.5V11.2l3.12-2.34C38.87 8.3 39.77 8 40.7 8 43.08 8 45 9.92 45 12.3z" />
    </svg>
  ),

  // Outlook — blue tile with a white "O" beside a mail flap.
  outlook: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="10.5" y="6.4" width="11" height="11.2" rx="1.4" fill="#0F6CBD" />
      <path d="M10.9 8.1l5.1 3.4 5.1-3.4" fill="none" stroke="#fff" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="1.6" y="3.9" width="13" height="16.2" rx="2.6" fill="#0078D4" />
      <ellipse cx="8.1" cy="12" rx="3.7" ry="4.4" fill="none" stroke="#fff" strokeWidth="2.1" />
    </svg>
  ),

  // iCloud — blue cloud.
  icloud: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#3D9BF4"
        d="M17.6 18.5H7a4.3 4.3 0 0 1-.55-8.55 5.25 5.25 0 0 1 10.03-1.2A3.95 3.95 0 0 1 17.6 18.5z"
      />
    </svg>
  ),

  // Generic inbox — neutral envelope outline.
  imap: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2.4" fill="none" stroke="#5f6b7a" strokeWidth="1.6" />
      <path d="M4.2 8.2l7.8 5.3 7.8-5.3" fill="none" stroke="#5f6b7a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Google Calendar — white page, Google-blue "31".
  gcal: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="#fff" stroke="#dadce0" strokeWidth="1.2" />
      <text x="12" y="16.4" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9" fontWeight="700" fill="#4285F4">31</text>
    </svg>
  ),

  // Apple Calendar — red header, dark date.
  acal: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.6" fill="#fff" stroke="#dadce0" strokeWidth="1.1" />
      <path d="M6.6 5h10.8A2.6 2.6 0 0 1 20 7.6V8H4v-.4A2.6 2.6 0 0 1 6.6 5z" fill="#FF3B30" />
      <text x="12" y="17.2" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8.6" fontWeight="700" fill="#1d1d1f">31</text>
    </svg>
  ),

  // Spotify — green disc with sound waves.
  spotify: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#1ED760" />
      <g fill="none" stroke="#000" strokeWidth="1.7" strokeLinecap="round">
        <path d="M6 9.2c3.8-1 8-.7 11.2 1.2" />
        <path d="M6.8 12.6c3-.8 6.6-.5 9.3 1.1" />
        <path d="M7.4 15.7c2.3-.6 5-.3 6.9.9" />
      </g>
    </svg>
  ),

  // Notion — black "N" on a white tile.
  notion: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3.5" fill="#fff" stroke="#e9e9e7" strokeWidth="1" />
      <path d="M8 16.8V8.2l8 8.6V8.2" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Google Fit — four-colour diamond cluster.
  gfit: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 3.6l3.4 3.4L12 10.4 8.6 7z" />
      <path fill="#FBBC04" d="M16.9 8.6L20.3 12l-3.4 3.4L13.5 12z" />
      <path fill="#34A853" d="M12 13.6l3.4 3.4L12 20.4 8.6 17z" />
      <path fill="#4285F4" d="M7.1 8.6L10.5 12l-3.4 3.4L3.7 12z" />
    </svg>
  ),

  // Apple Health — red heart.
  ahealth: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FA3C4C"
        d="M12 20.6l-1.55-1.42C5.4 14.6 2 11.5 2 7.65 2 5.5 3.7 3.8 5.85 3.8c1.54 0 3.02.72 3.95 1.86h.4C11.13 4.52 12.61 3.8 14.15 3.8 16.3 3.8 18 5.5 18 7.65c0 3.85-3.4 6.95-8.45 11.53z"
      />
    </svg>
  ),

  // WhatsApp — green bubble with a white handset.
  whatsapp: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#25D366" d="M12 2a10 10 0 0 0-8.52 15.2L2 22l4.94-1.3A10 10 0 1 0 12 2z" />
      <path
        fill="#fff"
        d="M9.2 7.3c-.18-.45-.37-.46-.55-.47h-.47c-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.05 0 1.2.88 2.37 1 2.53.13.16 1.72 2.73 4.25 3.72 2.1.83 2.53.67 2.98.62.46-.04 1.46-.59 1.66-1.16.21-.57.21-1.06.15-1.16-.06-.1-.23-.16-.47-.29-.25-.12-1.45-.71-1.67-.79-.22-.08-.39-.12-.55.13-.16.25-.63.79-.77.95-.14.16-.28.18-.53.06-.25-.12-1.04-.38-1.97-1.21-.73-.65-1.22-1.45-1.36-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.55-1.33-.76-1.82z"
      />
    </svg>
  ),

  // Strava — orange chevron mark.
  strava: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#FC4C02" d="M10.4 3 4.8 14.1h3.32L10.4 9.6l2.28 4.5H16z" />
      <path fill="#FC8B5E" d="M13.2 14.1 11.9 16.7l-1.3-2.6H8.3l3.6 6.9 3.6-6.9z" />
    </svg>
  ),

  // Zoom — blue rounded tile with a white video camera.
  zoom: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="3" width="21" height="18" rx="5" fill="#2D8CFF" />
      <rect x="5.2" y="8.4" width="9" height="7.2" rx="1.8" fill="#fff" />
      <path d="M15 11.1l3.8-2.1v6l-3.8-2.1z" fill="#fff" />
    </svg>
  ),
};

/** Render a brand mark at the given pixel size, or null if the id is unknown. */
export function BrandLogo({ id, size = 24 }: { id: BrandId; size?: number }): React.ReactNode {
  return LOGOS[id]?.(size) ?? null;
}

export const KNOWN_BRANDS = Object.keys(LOGOS) as BrandId[];
