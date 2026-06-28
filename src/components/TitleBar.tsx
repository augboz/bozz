/**
 * TitleBar — retired.
 *
 * Bozz used to draw its own frameless window chrome (custom minimise / maximise
 * / close buttons) with `decorations: false` in tauri.conf.json. That disabled
 * the OS window controls and, on Windows, Aero Snap (drag-to-edge / Win+←→
 * half-screen tiling). Per user feedback we now let the OS draw the title bar
 * (`decorations: true`), which restores native buttons and snapping for free.
 *
 * This component is kept as a no-op so the existing import sites (Dashboard,
 * AuthGate, TopicView, HomeView, BottomTabBar) keep compiling without edits.
 * TITLE_BAR_HEIGHT is 0 because the native title bar lives outside the webview,
 * so no top offset is needed inside the app.
 */

import type { Theme } from '../lib/types';

export const TITLE_BAR_HEIGHT = 0; // native OS title bar — no in-app offset

interface Props {
  theme: Theme;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function TitleBar(_props: Props) {
  return null;
}
