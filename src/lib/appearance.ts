import { themes } from './themes';
import type {
  AppearancePrefs, FontChoice, FontSize, MoodId,
  WidgetBorder, WidgetShape,
} from './types';

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  mood: 'midnight',
  font: 'inter',
  fontSize: 'medium',
  // Default to the minimal nav: just Home, Inbox, Settings. The user
  // turns the rest on in Settings → Navigation as they need them, and
  // adds their own topics via Settings → Topics.
  hiddenSections: ['music', 'life', 'cv', 'other', 'applications',
                   'calendar', 'budget', 'email', 'review'],
  defaultSection: 'home',
  widgetShape: 'rounded',
  widgetBorder: 'normal',
};

const SHAPE_RADIUS: Record<WidgetShape, string> = {
  sharp:   '4px',
  rounded: '14px',
  pill:    '24px',
};

const BORDER_WIDTH: Record<WidgetBorder, string> = {
  subtle: '0px',
  normal: '1px',
  bold:   '2px',
};

export const FONT_STACK: Record<FontChoice, string> = {
  inter: "'Inter Variable', ui-sans-serif, system-ui, -apple-system, sans-serif",
  manrope: "'Manrope Variable', ui-sans-serif, system-ui, sans-serif",
  quicksand: "'Quicksand Variable', ui-sans-serif, system-ui, sans-serif",
  mono: "'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace",
};

export const FONT_PX: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
};

/** Moods whose backgrounds are dark — used to drive `color-scheme` so the
 *  webview renders scrollbars and form controls in dark UI. */
const DARK_MOODS: ReadonlySet<MoodId> = new Set<MoodId>([
  'midnight', 'sunset', 'coffee', 'forest', 'ocean',
]);

/** Push appearance prefs into root CSS so the whole UI reacts instantly. */
export function applyAppearanceVars(p: AppearancePrefs): void {
  const root = document.documentElement;
  const theme = themes[p.mood];
  root.style.setProperty('--app-font', FONT_STACK[p.font]);
  root.style.fontSize = FONT_PX[p.fontSize];

  // Drive the webview's native UI (scrollbars, default form widgets) using
  // a colour scheme matched to the active mood. Without this, dark moods
  // still render white/beige scrollbars that look out of place.
  root.style.colorScheme = DARK_MOODS.has(p.mood) ? 'dark' : 'light';

  // Plumb a few theme tokens through to CSS so the global scrollbar
  // rules can stay theme-aware (they live in index.css).
  root.style.setProperty('--app-bg', theme.bg);
  root.style.setProperty('--app-bg-alt', theme.bgAlt);
  root.style.setProperty('--app-border', theme.border);
  root.style.setProperty('--app-border-strong', theme.borderStrong);
  root.style.setProperty('--app-text-dim', theme.textDim);

  // Widget-specific style tokens — Widget.tsx reads these so a single
  // appearance choice updates every widget on the home grid instantly.
  root.style.setProperty('--widget-radius', SHAPE_RADIUS[p.widgetShape ?? 'rounded']);
  root.style.setProperty('--widget-border', BORDER_WIDTH[p.widgetBorder ?? 'normal']);
}
