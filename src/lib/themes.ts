import type { Theme, SectionId, MoodId } from './types';

// BOZZ dark — matte black.
const dark: Theme = {
  bg: '#0a0a0a', bgAlt: '#141414', panel: '#1a1a1a', text: '#e8e8e8',
  textMuted: '#888888', textDim: '#555555',
  border: 'rgba(255,255,255,0.08)', borderStrong: 'rgba(255,255,255,0.16)',
  input: '#111111', todoBg: '#141414', todoBorder: 'rgba(255,255,255,0.08)', todoText: '#888888',
  doingBg: 'rgba(205,191,255,0.07)', doingBgStrong: 'rgba(205,191,255,0.13)',
  doingBorder: 'rgba(205,191,255,0.38)', doingAccent: '#cdbfff',
  doneBg: 'rgba(127,200,169,0.07)', doneBgStrong: 'rgba(127,200,169,0.13)',
  doneBorder: 'rgba(127,200,169,0.38)', doneAccent: '#7fc8a9',
  pendingBg: 'rgba(140,141,145,0.06)', pendingBorder: 'rgba(140,141,145,0.22)',
  pendingAccent: '#6b6c70',
  alert: '#ff6b6b', alertBg: 'rgba(255,107,107,0.10)', alertBorder: 'rgba(255,107,107,0.38)',
};

// BOZZ light — silver-grey canvas, white glass cards.
const light: Theme = {
  bg: '#ffffff', bgAlt: 'rgba(0,0,0,0.04)', panel: 'rgba(255,255,255,0.95)', text: '#000000',
  textMuted: '#555555', textDim: '#999999',
  border: 'rgba(0,0,0,0.07)', borderStrong: 'rgba(0,0,0,0.14)',
  input: 'rgba(255,255,255,0.55)', todoBg: 'rgba(255,255,255,0.55)', todoBorder: 'rgba(0,0,0,0.06)', todoText: '#6b6a67',
  doingBg: 'rgba(124,108,212,0.07)', doingBgStrong: 'rgba(124,108,212,0.13)',
  doingBorder: 'rgba(124,108,212,0.30)', doingAccent: '#7c6cd4',
  doneBg: 'rgba(80,160,120,0.07)', doneBgStrong: 'rgba(80,160,120,0.13)',
  doneBorder: 'rgba(80,160,120,0.30)', doneAccent: '#4aa87a',
  pendingBg: 'rgba(100,98,95,0.05)', pendingBorder: 'rgba(100,98,95,0.18)',
  pendingAccent: '#9a9791',
  alert: '#c84040', alertBg: 'rgba(200,64,64,0.07)', alertBorder: 'rgba(200,64,64,0.25)',
};

// BOZZ warm — terracotta sidebar, pinkish-cream canvas, light card widgets.
const warm: Theme = {
  bg: '#f0e2dc', bgAlt: '#e6d4cc', panel: '#f7eeea', text: '#1e0e0e',
  textMuted: '#7a5450', textDim: '#b09898',
  border: 'rgba(160,80,60,0.12)', borderStrong: 'rgba(160,80,60,0.22)',
  input: 'rgba(255,240,235,0.70)', todoBg: '#f5ece8', todoBorder: 'rgba(160,80,60,0.10)', todoText: '#8a6465',
  doingBg: 'rgba(124,108,212,0.06)', doingBgStrong: 'rgba(124,108,212,0.12)',
  doingBorder: 'rgba(124,108,212,0.28)', doingAccent: '#7c6cd4',
  doneBg: 'rgba(80,160,120,0.07)', doneBgStrong: 'rgba(80,160,120,0.13)',
  doneBorder: 'rgba(80,160,120,0.30)', doneAccent: '#4aa87a',
  pendingBg: 'rgba(100,80,75,0.05)', pendingBorder: 'rgba(100,80,75,0.18)',
  pendingAccent: '#9a8a85',
  alert: '#c84040', alertBg: 'rgba(200,64,64,0.07)', alertBorder: 'rgba(200,64,64,0.25)',
};

export const themes: Record<MoodId, Theme> = { dark, light, warm };

export const MOODS: Array<{ id: MoodId; label: string; swatch: string }> = [
  { id: 'dark',  label: 'Dark',  swatch: '#cdbfff' },
  { id: 'light', label: 'Light', swatch: '#7c6cd4' },
  { id: 'warm',  label: 'Warm',  swatch: '#c8645a' },
];

export const THEME_COLOR_BANKS: Record<MoodId, string[]> = {
  dark:  ['#cdbfff', '#7fc8a9', '#e0a16b', '#7fa8e0', '#e07a7a', '#a0c4d8'],
  light: ['#7c6cd4', '#50aa82', '#d4884a', '#5a8ed4', '#d45a5a', '#5aaab8'],
  warm:  ['#c8645a', '#7fc8a9', '#e0a16b', '#7fa8e0', '#c87e5a', '#a08090'],
};

export const sectionAccents: Record<SectionId, string> = {
  home:        '#cdbfff',
  music:       '#b89ec8',
  applications:'#c8a87a',
  life:        '#7fc8a9',
  cv:          '#a4b87c',
  other:       '#e0a16b',
  calendar:    '#7fa8e0',
  budget:      '#86b89a',
  inbox:       '#c8845c',
  review:      '#a898b8',
  email:       '#8aaab8',
  settings:    '#9a9e98',
  planner:     '#7aa8c4',
  dailyPlanner:'#7aa8c4',
  habits:      '#90b488',
  health:      '#b890a8',
};
