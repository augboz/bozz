/**
 * BottomTabBar — mobile-only navigation.
 *
 * Fixed to the bottom of the screen, respects iOS safe-area-inset-bottom.
 * Scrollable horizontally when there are more tabs than fit.
 *
 * Left side (fixed): microphone + settings icons.
 * Right side (fixed): Quicks / inbox button.
 * Center: scrollable topic/section tabs.
 */

import { Inbox, Settings, LayoutGrid } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import type { Theme } from '../lib/types';
import { sectionAccents } from '../lib/themes';

export const BOTTOM_TAB_HEIGHT = 56; // px, not counting safe-area

export interface NavTab {
  id: string;
  label: string;
  icon: ElementType;
  /** Explicit accent colour — falls back to sectionAccents[id] */
  accent?: string;
}

interface Props {
  tabs: NavTab[];
  active: string;
  onSelect: (id: string) => void;
  /** Drives the badge on the Quicks button. */
  quicksCount?: number;
  onQuicks?: () => void;
  onApps?: () => void;
  onSettings?: () => void;
  /** Optional mic button node rendered in the left fixed section. */
  micButton?: ReactNode;
  t: Theme;
  /** Top offset from TitleBar (0 on web/PWA, TITLE_BAR_HEIGHT inside Tauri). */
  tbOffset: number;
}

export default function BottomTabBar({ tabs, active, onSelect, quicksCount = 0, onQuicks, onApps, onSettings, micButton, t }: Props) {
  const isQuicksActive = active === 'inbox';
  const isAppsActive = active === 'apps';
  const isSettingsActive = active === 'settings';

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60 }}>
      {/* Right-edge fade over scrollable area */}
      <div style={{
        position: 'absolute', right: onQuicks ? 52 : 0, top: 0, bottom: 0,
        width: '40px', pointerEvents: 'none',
        background: `linear-gradient(to right, transparent, ${t.bgAlt})`,
        zIndex: 1,
      }} />

      <nav
        aria-label="Main navigation"
        style={{
          background: t.bgAlt,
          borderTop: `1px solid ${t.border}`,
          display: 'flex',
          paddingBottom: 'env(safe-area-inset-bottom)',
        } as React.CSSProperties}
      >
        {/* Left fixed section: mic + settings */}
        <div style={{
          flexShrink: 0,
          display: 'flex',
          borderRight: `1px solid ${t.border}`,
        }}>
          {micButton && (
            <div style={{
              width: 44, height: BOTTOM_TAB_HEIGHT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {micButton}
            </div>
          )}
          {onSettings && (
            <button
              onClick={onSettings}
              aria-label="Settings"
              aria-current={isSettingsActive ? 'page' : undefined}
              style={{
                width: 44, height: BOTTOM_TAB_HEIGHT,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '3px',
                background: isSettingsActive ? t.panel : 'transparent',
                border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                color: isSettingsActive ? sectionAccents.settings ?? t.textMuted : t.textMuted,
                transition: 'color 0.15s ease, background 0.15s ease',
                padding: '0 4px',
                WebkitTapHighlightColor: 'transparent',
              } as React.CSSProperties}
            >
              <Settings size={18} strokeWidth={isSettingsActive ? 2 : 1.5} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.55rem', fontWeight: isSettingsActive ? 500 : 400, lineHeight: 1, letterSpacing: '0.02em' }}>
                Settings
              </span>
            </button>
          )}
        </div>

        {/* Scrollable tabs */}
        <div style={{
          flex: 1, minWidth: 0,
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        } as React.CSSProperties}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.id === active;
            const accent = tab.accent ?? (sectionAccents as Record<string, string>)[tab.id] ?? t.textMuted;

            return (
              <button
                key={tab.id}
                onClick={() => onSelect(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  flexShrink: 0,
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
                  color: isActive ? accent : t.textMuted,
                  transition: 'color 0.15s ease',
                  position: 'relative',
                  padding: '0 4px',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0 }} />
                <span style={{
                  fontSize: '0.6rem', fontWeight: isActive ? 500 : 400,
                  letterSpacing: '0.02em', lineHeight: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Apps button — fixed near the right end, next to Quicks */}
        {onApps && (
          <button
            onClick={onApps}
            aria-label="Apps"
            aria-current={isAppsActive ? 'page' : undefined}
            style={{
              flexShrink: 0,
              minWidth: 52,
              height: BOTTOM_TAB_HEIGHT,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '3px',
              background: isAppsActive ? t.panel : 'transparent',
              border: 'none', borderLeft: `1px solid ${t.border}`,
              cursor: 'pointer', fontFamily: 'inherit',
              color: isAppsActive ? (sectionAccents as Record<string, string>).apps ?? t.text : t.textMuted,
              transition: 'color 0.15s ease, background 0.15s ease',
              padding: '0 4px',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties}
          >
            <LayoutGrid size={20} strokeWidth={isAppsActive ? 2 : 1.5} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.6rem', fontWeight: isAppsActive ? 500 : 400, lineHeight: 1, letterSpacing: '0.02em' }}>
              Apps
            </span>
          </button>
        )}

        {/* Quicks button — fixed at right end */}
        {onQuicks && (
          <button
            onClick={onQuicks}
            aria-label="Quicks"
            aria-current={isQuicksActive ? 'page' : undefined}
            style={{
              flexShrink: 0,
              minWidth: 52,
              height: BOTTOM_TAB_HEIGHT,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '3px',
              background: isQuicksActive ? t.panel : 'transparent',
              border: 'none', borderLeft: `1px solid ${t.border}`,
              cursor: 'pointer', fontFamily: 'inherit',
              color: isQuicksActive ? sectionAccents.inbox : t.textMuted,
              transition: 'color 0.15s ease, background 0.15s ease',
              position: 'relative', padding: '0 4px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Inbox size={20} strokeWidth={isQuicksActive ? 2 : 1.5} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.6rem', fontWeight: isQuicksActive ? 500 : 400, lineHeight: 1, letterSpacing: '0.02em' }}>
              Quicks
            </span>
            {quicksCount > 0 && (
              <span style={{
                position: 'absolute', top: 8, right: 6,
                background: sectionAccents.inbox, color: t.bg,
                fontSize: '0.55rem', fontWeight: 600,
                borderRadius: '999px', padding: '1px 4px', lineHeight: 1.4,
                pointerEvents: 'none',
              }}>
                {quicksCount > 99 ? '99+' : quicksCount}
              </span>
            )}
          </button>
        )}
      </nav>
    </div>
  );
}
