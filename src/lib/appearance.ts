import { themes } from './themes';
import type {
  AppearancePrefs, FontChoice, FontSize, MoodId,
  WidgetBorder, WidgetShape,
} from './types';

export const DEFAULT_COLOR_BANK: string[] = [
  '#6ba8d4', // cornflower blue
  '#7dbf9a', // sage green
  '#d4c860', // warm yellow
  '#d4a86a', // warm amber
  '#d47a7a', // soft coral
  '#6abfbf', // teal
  '#f2f2f2', // white
  '#111111', // black
];

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  mood: 'dark',
  font: 'inter',
  fontSize: 'medium',
  // New accounts open to "just Home" — every non-Home section starts hidden, so
  // the sidebar is empty until the walkthroughs guide the user to add topics.
  hiddenSections: ['calendar', 'budget', 'email', 'review', 'planner', 'dailyPlanner', 'habits', 'health'],
  hiddenTopicIds: [],
  defaultSection: 'home',
  widgetShape: 'rounded',
  widgetBorder: 'subtle',
  colorBank: DEFAULT_COLOR_BANK,
};

const SHAPE_RADIUS: Record<WidgetShape, string> = {
  sharp:   '8px',
  rounded: '20px',
  pill:    '30px',
};

const BORDER_WIDTH: Record<WidgetBorder, string> = {
  subtle: '0.5px',
  normal: '1px',
  bold:   '2px',
};

export const FONT_STACK: Record<FontChoice, string> = {
  geist:     "'Inter Variable', ui-sans-serif, system-ui, -apple-system, sans-serif",
  inter:     "'Inter Variable', ui-sans-serif, system-ui, -apple-system, sans-serif",
  manrope:   "'Manrope Variable', ui-sans-serif, system-ui, sans-serif",
  quicksand: "'Quicksand Variable', ui-sans-serif, system-ui, sans-serif",
  mono:      "'JetBrains Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace",
  fraunces:  "'Fraunces Variable', Georgia, 'Times New Roman', serif",
};

export const FONT_PX: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
  xlarge: '21px',
};

/** Push appearance prefs into root CSS so the whole UI reacts instantly. */
export function applyAppearanceVars(p: AppearancePrefs): void {
  const root = document.documentElement;
  // Guard: if a stored mood is no longer valid (migration), fall back to dark.
  const mood: MoodId = (p.mood === 'dark' || p.mood === 'light' || p.mood === 'warm') ? p.mood : 'dark';
  const theme = themes[mood];

  root.style.setProperty('--app-font', FONT_STACK[p.font] ?? FONT_STACK.geist);
  root.style.setProperty('--ease', 'cubic-bezier(0.16, 1, 0.3, 1)');
  root.style.fontSize = FONT_PX[p.fontSize] ?? FONT_PX.medium;
  root.style.colorScheme = mood === 'dark' ? 'dark' : 'light';

  root.style.setProperty('--app-bg',           theme.bg);
  root.style.setProperty('--app-bg-alt',        theme.bgAlt);
  root.style.setProperty('--app-border',        theme.border);
  root.style.setProperty('--app-border-strong', theme.borderStrong);
  root.style.setProperty('--app-text',          theme.text);
  root.style.setProperty('--app-text-muted',    theme.textMuted);
  root.style.setProperty('--app-text-dim',      theme.textDim);
  root.dataset.theme = mood;

  root.style.setProperty('--widget-radius',  SHAPE_RADIUS[p.widgetShape ?? 'rounded']);
  root.style.setProperty('--widget-border',  BORDER_WIDTH[p.widgetBorder ?? 'subtle']);

  if (mood === 'dark') {
    root.style.setProperty('--glass-bg-top', 'rgba(52, 52, 52, 1)');
    root.style.setProperty('--glass-bg',     'rgba(28, 28, 28, 1)');
    root.style.setProperty('--glass-blur',   'blur(20px) saturate(120%)');
    root.style.setProperty('--glass-border',        'rgba(255,255,255,0.09)');
    root.style.setProperty('--glass-border-strong', 'rgba(255,255,255,0.17)');
    root.style.setProperty('--sidebar-bg',   'rgba(10, 10, 10, 1)');
    root.style.setProperty('--sidebar-blur', 'none');
    root.style.setProperty('--glass-inset',  'inset 0 1px 0 rgba(255,255,255,0.18)');
    root.style.setProperty('--sidebar-text',       'rgba(255,255,255,1)');
    root.style.setProperty('--sidebar-text-muted', 'rgba(255,255,255,0.55)');
    root.style.setProperty('--sidebar-text-dim',   'rgba(255,255,255,0.28)');
    root.style.setProperty('--sidebar-bg-alt',     'rgba(255,255,255,0.06)');
    root.style.setProperty('--sidebar-border',     'rgba(255,255,255,0.07)');
    root.style.setProperty('--sidebar-border-strong', 'rgba(255,255,255,0.14)');
    root.style.setProperty('--widget-shadow',
      '0 1px 0 rgba(255,255,255,0.18) inset, 0 0 0 0.5px rgba(255,255,255,0.08), 0 12px 48px rgba(0,0,0,0.70), 0 4px 14px rgba(0,0,0,0.50)');
    root.style.setProperty('--widget-shadow-hover',
      '0 1px 0 rgba(255,255,255,0.22) inset, 0 0 0 0.5px rgba(255,255,255,0.12), 0 24px 64px rgba(0,0,0,0.80), 0 8px 24px rgba(0,0,0,0.55)');
    root.style.setProperty('--app-gradient', 'none');
  } else if (mood === 'warm') {
    root.style.setProperty('--glass-bg-top', 'rgba(255, 252, 249, 0.98)');
    root.style.setProperty('--glass-bg',     'rgba(248, 240, 235, 0.97)');
    root.style.setProperty('--glass-blur',   'blur(20px) saturate(160%)');
    root.style.setProperty('--glass-border',        'rgba(160,80,60,0.10)');
    root.style.setProperty('--glass-border-strong', 'rgba(160,80,60,0.22)');
    root.style.setProperty('--sidebar-bg',   '#4d1919');
    root.style.setProperty('--sidebar-blur', 'none');
    root.style.setProperty('--glass-inset',  'inset 0 1px 0 rgba(255,255,255,0.80)');
    root.style.setProperty('--sidebar-text',       'rgba(252,238,232,1)');
    root.style.setProperty('--sidebar-text-muted', 'rgba(252,238,232,0.55)');
    root.style.setProperty('--sidebar-text-dim',   'rgba(252,238,232,0.32)');
    root.style.setProperty('--sidebar-bg-alt',     'rgba(255,255,255,0.12)');
    root.style.setProperty('--sidebar-border',     'rgba(255,255,255,0.12)');
    root.style.setProperty('--sidebar-border-strong', 'rgba(255,255,255,0.20)');
    root.style.setProperty('--widget-shadow',
      '0 1px 0 rgba(255,255,255,0.90) inset, 0 0 0 0.5px rgba(160,80,60,0.10), 0 8px 32px rgba(120,40,20,0.12), 0 2px 8px rgba(120,40,20,0.08)');
    root.style.setProperty('--widget-shadow-hover',
      '0 1px 0 rgba(255,255,255,0.95) inset, 0 0 0 0.5px rgba(160,80,60,0.18), 0 18px 52px rgba(120,40,20,0.18), 0 5px 16px rgba(120,40,20,0.12)');
    root.style.setProperty('--app-gradient', 'none');
  } else {
    // Light Bento Glass: white cards on grey canvas
    root.style.setProperty('--glass-bg-top', 'rgba(255, 255, 255, 0.99)');
    root.style.setProperty('--glass-bg',     'rgba(248, 248, 253, 0.96)');
    root.style.setProperty('--glass-blur',   'blur(24px) saturate(220%)');
    root.style.setProperty('--glass-border',        'rgba(0,0,0,0.07)');
    root.style.setProperty('--glass-border-strong', 'rgba(0,0,0,0.16)');
    root.style.setProperty('--sidebar-bg',   'rgba(255, 255, 255, 0.98)');
    root.style.setProperty('--sidebar-blur', 'blur(20px) saturate(180%)');
    root.style.setProperty('--glass-inset',  'inset 0 1px 0 rgba(255,255,255,1)');
    root.style.setProperty('--sidebar-text',       '#000000');
    root.style.setProperty('--sidebar-text-muted', 'rgba(0,0,0,0.50)');
    root.style.setProperty('--sidebar-text-dim',   'rgba(0,0,0,0.28)');
    root.style.setProperty('--sidebar-bg-alt',     theme.bgAlt);
    root.style.setProperty('--sidebar-border',     theme.border);
    root.style.setProperty('--sidebar-border-strong', theme.borderStrong);
    root.style.setProperty('--widget-shadow',
      '0 1px 0 rgba(255,255,255,1) inset, 0 0 0 0.5px rgba(0,0,0,0.07), 0 10px 36px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.08)');
    root.style.setProperty('--widget-shadow-hover',
      '0 1px 0 rgba(255,255,255,1) inset, 0 0 0 0.5px rgba(0,0,0,0.10), 0 20px 52px rgba(0,0,0,0.20), 0 5px 14px rgba(0,0,0,0.11)');
    root.style.setProperty('--app-gradient', 'none');
  }
}
