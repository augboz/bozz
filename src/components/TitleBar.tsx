/**
 * TitleBar — custom frameless window chrome.
 *
 * Rendered only inside the Tauri desktop build (returns null on web/PWA).
 * On macOS the native traffic-light buttons remain in their overlay position
 * (titleBarStyle: "Overlay" in tauri.conf.json); we hide our custom controls
 * and add left padding so app-name text doesn't sit under the traffic lights.
 * On Windows/Linux we render our own minimise / maximise / close buttons.
 *
 * Drag fix: mousedown on a button bubbles up to the data-tauri-drag-region
 * parent, which would start a window drag and swallow the click. We stop
 * propagation on mousedown in every control button to prevent this.
 *
 * CSS fix: -webkit-app-region: drag/no-drag in index.css ensures WebView2's
 * native drag handling also respects the button hit areas.
 */

import { useState, useRef } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri, isMacOS } from '../lib/platform';
import type { Theme } from '../lib/types';

export const TITLE_BAR_HEIGHT = 36; // px — keep in sync with padding in Dashboard

interface Props {
  theme: Theme;
}

// ── Control button ──────────────────────────────────────────────────────────
interface CtrlBtnProps {
  label: string;
  onClick: () => void;
  hoverBg: string;
  hoverColor: string;
  defaultColor: string;
  children: React.ReactNode;
  width?: number;
}

function CtrlBtn({ label, onClick, hoverBg, hoverColor, defaultColor, children, width = 44 }: CtrlBtnProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      aria-label={label}
      onClick={onClick}
      // Stop mousedown from bubbling to the drag-region parent.
      // Without this, the drag handler intercepts mousedown before the
      // click event fires, so only close (which fires synchronously) works.
      onMouseDown={e => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width,
        height: TITLE_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? hoverBg : 'transparent',
        border: 'none',
        color: hovered ? hoverColor : defaultColor,
        cursor: 'pointer',
        transition: 'background 0.12s ease, color 0.12s ease',
        flexShrink: 0,
        outline: 'none',
        borderRadius: 0,
        // Explicitly mark as no-drag via a data attribute that index.css targets
        // (the CSS -webkit-app-region: no-drag rule is applied there)
      }}
    >
      {children}
    </button>
  );
}

// ── TitleBar ────────────────────────────────────────────────────────────────
export default function TitleBar({ theme: t }: Props) {
  // No-op in web / PWA mode — must be before any hooks
  const onMac = isMacOS();

  // Stable reference to the current Tauri window — avoids re-creating on
  // every render while still being safe to call inside event handlers.
  const winRef = useRef(isTauri() ? getCurrentWindow() : null);

  if (!isTauri()) return null;

  const win = winRef.current!;

  return (
    <div
      data-tauri-drag-region
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: TITLE_BAR_HEIGHT,
        background: t.bgAlt,
        borderBottom: `1px solid ${t.border}`,
        display: 'flex',
        alignItems: 'center',
        zIndex: 200,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      {/* App name — subtle, dim, full drag target */}
      <span
        data-tauri-drag-region
        style={{
          flex: 1,
          // macOS: leave room for native traffic-light buttons
          paddingLeft: onMac ? '80px' : '14px',
          fontSize: '0.82rem',
          fontWeight: 600,
          fontStyle: 'normal',
          fontFamily: 'var(--app-font)',
          letterSpacing: '-0.01em',
          color: t.textMuted,
          pointerEvents: 'none',
        }}
      >
        BOZZ
      </span>

      {/* Window controls — hidden on macOS (traffic lights handle this) */}
      {!onMac && (
        <div style={{ display: 'flex', height: TITLE_BAR_HEIGHT }}>
          <CtrlBtn
            label="Minimise"
            onClick={() => void win.minimize()}
            hoverBg={t.border}
            hoverColor={t.text}
            defaultColor={t.textMuted}
          >
            <Minus size={11} strokeWidth={2} />
          </CtrlBtn>

          <CtrlBtn
            label="Maximise / Restore"
            onClick={() => void win.toggleMaximize()}
            hoverBg={t.border}
            hoverColor={t.text}
            defaultColor={t.textMuted}
          >
            <Square size={10} strokeWidth={1.75} />
          </CtrlBtn>

          <CtrlBtn
            label="Close"
            onClick={() => void win.close()}
            hoverBg={t.alert}
            hoverColor="#fff"
            defaultColor={t.textMuted}
            width={48}
          >
            <X size={12} strokeWidth={2} />
          </CtrlBtn>
        </div>
      )}
    </div>
  );
}
