/**
 * BottomTabBar — mobile-only navigation.
 *
 * Replaces the sidebar on viewports ≤768 px. Fixed to the bottom of the
 * screen, respects iOS safe-area-inset-bottom (home-indicator notch).
 * Scrollable horizontally when there are more tabs than fit comfortably.
 *
 * Hit targets are always ≥44×44 px (iOS HIG minimum).
 */

import type { ElementType } from 'react';
import type { SectionId, Theme } from '../lib/types';
import { sectionAccents } from '../lib/themes';

export const BOTTOM_TAB_HEIGHT = 56; // px, not counting safe-area

interface Tab {
  id: SectionId;
  label: string;
  icon: ElementType;
}

interface Props {
  tabs: Tab[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
  inboxCount: number;
  t: Theme;
  /** Top offset from TitleBar (0 on web/PWA, TITLE_BAR_HEIGHT inside Tauri). */
  tbOffset: number;
}

export default function BottomTabBar({ tabs, active, onSelect, inboxCount, t }: Props) {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        // Sit above everything including modals' backdrops
        zIndex: 60,
        background: t.bgAlt,
        borderTop: `1px solid ${t.border}`,
        // Horizontal scroll when tabs overflow (many visible sections)
        display: 'flex',
        overflowX: 'auto',
        overflowY: 'hidden',
        // Hide the scrollbar — navigation by swipe, not by scrollbar
        scrollbarWidth: 'none',
        // Pad bottom for iOS home indicator
        paddingBottom: 'env(safe-area-inset-bottom)',
        // Smooth momentum scroll on iOS
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
      } as React.CSSProperties}
    >
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        const accent = sectionAccents[tab.id];
        const showBadge = tab.id === 'inbox' && inboxCount > 0;

        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              // Flex-shrink 0 so tabs don't squish below their hit target
              flexShrink: 0,
              // Minimum 44px wide, grow evenly if tabs fit on screen
              minWidth: 'max(44px, calc(100% / 6))',
              flex: 1,
              height: BOTTOM_TAB_HEIGHT,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              // Active tab: accent colour; inactive: dim
              color: isActive ? accent : t.textMuted,
              transition: 'color 0.15s ease',
              position: 'relative',
              padding: '0 4px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2 : 1.5}
              style={{ flexShrink: 0 }}
            />
            <span style={{
              fontSize: '0.6rem',
              fontWeight: isActive ? 500 : 400,
              letterSpacing: '0.02em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}>
              {tab.label}
            </span>

            {/* Inbox unread badge */}
            {showBadge && (
              <span style={{
                position: 'absolute',
                top: 8,
                right: '50%',
                transform: 'translateX(10px)',
                background: accent,
                color: t.bg,
                fontSize: '0.55rem',
                fontWeight: 600,
                borderRadius: '999px',
                padding: '1px 4px',
                lineHeight: 1.4,
                pointerEvents: 'none',
              }}>
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
