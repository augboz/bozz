import type { Theme, SectionId, MoodId } from './types';

// Each mood is a complete Theme. Status colours (todo/doing/done) are tuned
// per mood to feel cohesive but stay mutually distinct. Section accents are
// intentionally global (subtle nav dots) and not mood-dependent.

const midnight: Theme = {
  bg: '#060506', bgAlt: '#1e1e21', panel: '#222226', text: '#e8e6e1',
  textMuted: '#8a8784', textDim: '#5a5854', border: '#2e2e33', borderStrong: '#3a3a40',
  input: '#1a1a1c', todoBg: '#222226', todoBorder: '#2e2e33', todoText: '#8a8784',
  doingBg: 'rgba(217,119,56,0.08)', doingBgStrong: 'rgba(217,119,56,0.14)',
  doingBorder: 'rgba(217,119,56,0.45)', doingAccent: '#e08a4a',
  doneBg: 'rgba(96,156,108,0.08)', doneBgStrong: 'rgba(96,156,108,0.14)',
  doneBorder: 'rgba(96,156,108,0.4)', doneAccent: '#7fb088',
  pendingBg: 'rgba(180,180,185,0.06)', pendingBorder: 'rgba(180,180,185,0.25)',
  pendingAccent: '#a8a59f',
  alert: '#dd6b5a', alertBg: 'rgba(221,107,90,0.10)', alertBorder: 'rgba(221,107,90,0.45)',
};

// Warm dark base, orange + golden-yellow accents.
const sunset: Theme = {
  bg: '#1f1410', bgAlt: '#281a12', panel: '#2f2016', text: '#f5e6d5',
  textMuted: '#b39880', textDim: '#7a5f49', border: '#3e2c1f', borderStrong: '#503a28',
  input: '#261810', todoBg: '#2f2016', todoBorder: '#3e2c1f', todoText: '#b39880',
  doingBg: 'rgba(240,145,63,0.10)', doingBgStrong: 'rgba(240,145,63,0.16)',
  doingBorder: 'rgba(240,145,63,0.45)', doingAccent: '#f0913f',
  doneBg: 'rgba(232,193,90,0.10)', doneBgStrong: 'rgba(232,193,90,0.16)',
  doneBorder: 'rgba(232,193,90,0.4)', doneAccent: '#e8c15a',
  pendingBg: 'rgba(179,152,128,0.07)', pendingBorder: 'rgba(179,152,128,0.28)',
  pendingAccent: '#b39880',
  alert: '#e8556e', alertBg: 'rgba(232,85,110,0.12)', alertBorder: 'rgba(232,85,110,0.45)',
};

const coffee: Theme = {
  bg: '#211a14', bgAlt: '#2a221a', panel: '#30271e', text: '#ece0d0',
  textMuted: '#a8957f', textDim: '#6f5c48', border: '#3d3326', borderStrong: '#4e4133',
  input: '#271f17', todoBg: '#30271e', todoBorder: '#3d3326', todoText: '#a8957f',
  doingBg: 'rgba(217,154,82,0.10)', doingBgStrong: 'rgba(217,154,82,0.16)',
  doingBorder: 'rgba(217,154,82,0.45)', doingAccent: '#d99a52',
  doneBg: 'rgba(154,174,124,0.10)', doneBgStrong: 'rgba(154,174,124,0.16)',
  doneBorder: 'rgba(154,174,124,0.4)', doneAccent: '#9aae7c',
  pendingBg: 'rgba(168,149,127,0.07)', pendingBorder: 'rgba(168,149,127,0.28)',
  pendingAccent: '#a8957f',
  alert: '#d75c45', alertBg: 'rgba(215,92,69,0.12)', alertBorder: 'rgba(215,92,69,0.45)',
};

// Clearly green-tinted dark, brighter sage done accent.
const forest: Theme = {
  bg: '#0f1a12', bgAlt: '#15241a', panel: '#1a2c20', text: '#e0ece2',
  textMuted: '#86a38f', textDim: '#52704f', border: '#284032', borderStrong: '#365440',
  input: '#13211a', todoBg: '#1a2c20', todoBorder: '#284032', todoText: '#86a38f',
  doingBg: 'rgba(217,163,90,0.10)', doingBgStrong: 'rgba(217,163,90,0.16)',
  doingBorder: 'rgba(217,163,90,0.45)', doingAccent: '#d9a35a',
  doneBg: 'rgba(111,193,133,0.10)', doneBgStrong: 'rgba(111,193,133,0.16)',
  doneBorder: 'rgba(111,193,133,0.4)', doneAccent: '#6fc185',
  pendingBg: 'rgba(134,163,143,0.07)', pendingBorder: 'rgba(134,163,143,0.28)',
  pendingAccent: '#86a38f',
  alert: '#e0705c', alertBg: 'rgba(224,112,92,0.12)', alertBorder: 'rgba(224,112,92,0.45)',
};

// Light, marble-like neutral greys.
const stone: Theme = {
  bg: '#ececea', bgAlt: '#e3e3e0', panel: '#f6f6f4', text: '#33332f',
  textMuted: '#76766f', textDim: '#a3a39c', border: '#dededa', borderStrong: '#c6c6c0',
  input: '#f1f1ef', todoBg: '#f6f6f4', todoBorder: '#dededa', todoText: '#76766f',
  doingBg: '#e7ecf1', doingBgStrong: '#d8e0e8', doingBorder: '#a9bccc', doingAccent: '#6f8499',
  doneBg: '#e7efe7', doneBgStrong: '#d9e6d9', doneBorder: '#a9c4ac', doneAccent: '#6f8f72',
  pendingBg: '#ececea', pendingBorder: '#c6c6c0', pendingAccent: '#8a8a82',
  alert: '#bf5340', alertBg: '#f4e2dd', alertBorder: '#d6a394',
};

// Deep ocean blue — dark navy base with sea-foam accents.
const ocean: Theme = {
  bg: '#0a1623', bgAlt: '#10212f', panel: '#162a3d', text: '#dae6f0',
  textMuted: '#7a93ad', textDim: '#506580', border: '#1f3650', borderStrong: '#2d4866',
  input: '#0d1c2b', todoBg: '#162a3d', todoBorder: '#1f3650', todoText: '#7a93ad',
  doingBg: 'rgba(90,165,215,0.10)', doingBgStrong: 'rgba(90,165,215,0.18)',
  doingBorder: 'rgba(90,165,215,0.45)', doingAccent: '#5aa5d7',
  doneBg: 'rgba(95,180,150,0.10)', doneBgStrong: 'rgba(95,180,150,0.18)',
  doneBorder: 'rgba(95,180,150,0.4)', doneAccent: '#5fb496',
  pendingBg: 'rgba(122,147,173,0.07)', pendingBorder: 'rgba(122,147,173,0.28)',
  pendingAccent: '#7a93ad',
  alert: '#e07555', alertBg: 'rgba(224,117,85,0.12)', alertBorder: 'rgba(224,117,85,0.45)',
};

const light: Theme = {
  bg: '#f5f2ec', bgAlt: '#ede9df', panel: '#ffffff', text: '#2a2825',
  textMuted: '#75726c', textDim: '#a8a59f', border: '#e8e4dc', borderStrong: '#d4cfc3',
  input: '#faf8f3', todoBg: '#ffffff', todoBorder: '#e8e4dc', todoText: '#75726c',
  doingBg: '#fdf1e3', doingBgStrong: '#f9e4ca', doingBorder: '#d9a460', doingAccent: '#b8743a',
  doneBg: '#ebf2eb', doneBgStrong: '#dde9de', doneBorder: '#9ec4a3', doneAccent: '#52804f',
  pendingBg: '#f5f2ec', pendingBorder: '#d4cfc3', pendingAccent: '#8a8784',
  alert: '#bf5340', alertBg: '#f7e4df', alertBorder: '#d9a08f',
};

const linen: Theme = {
  bg: '#f4eee2', bgAlt: '#ece4d4', panel: '#fbf7ee', text: '#3a3026',
  textMuted: '#7d6f5c', textDim: '#a99c86', border: '#e3d9c6', borderStrong: '#cdbfa6',
  input: '#f8f3e8', todoBg: '#fbf7ee', todoBorder: '#e3d9c6', todoText: '#7d6f5c',
  doingBg: '#f6e7cf', doingBgStrong: '#efd8b4', doingBorder: '#d5a861', doingAccent: '#b07c3c',
  doneBg: '#e9efdc', doneBgStrong: '#dbe6c6', doneBorder: '#a8bd86', doneAccent: '#6f8a4f',
  pendingBg: '#f4eee2', pendingBorder: '#cdbfa6', pendingAccent: '#8a7a62',
  alert: '#b5503a', alertBg: '#f6e1da', alertBorder: '#d6a18f',
};

// Bold candy pink — saturated hot-pink base.
const candy: Theme = {
  bg: '#fbd8ec', bgAlt: '#f7c4e2', panel: '#fde5f3', text: '#330d24',
  textMuted: '#bf4a88', textDim: '#d98abd', border: '#f0acd6', borderStrong: '#e87ec2',
  input: '#fce0f1', todoBg: '#fde5f3', todoBorder: '#f0acd6', todoText: '#bf4a88',
  doingBg: 'rgba(210,30,130,0.10)', doingBgStrong: 'rgba(210,30,130,0.18)',
  doingBorder: 'rgba(210,30,130,0.50)', doingAccent: '#d21e82',
  doneBg: 'rgba(80,190,145,0.10)', doneBgStrong: 'rgba(80,190,145,0.18)',
  doneBorder: 'rgba(80,190,145,0.42)', doneAccent: '#50be91',
  pendingBg: 'rgba(210,100,180,0.08)', pendingBorder: 'rgba(210,100,180,0.30)',
  pendingAccent: '#c05898',
  alert: '#c8154e', alertBg: 'rgba(200,21,78,0.12)', alertBorder: 'rgba(200,21,78,0.48)',
};

export const themes: Record<MoodId, Theme> = {
  midnight, sunset, coffee, forest, stone, ocean, light, linen, candy,
};

// One representative colour per mood for the picker swatch.
export const MOODS: Array<{ id: MoodId; label: string; swatch: string }> = [
  { id: 'midnight', label: 'Midnight', swatch: '#5b6cb0' },
  { id: 'sunset', label: 'Sunset', swatch: '#f5933b' },
  { id: 'coffee', label: 'Coffee', swatch: '#9a6b43' },
  { id: 'forest', label: 'Forest', swatch: '#5a9e63' },
  { id: 'stone', label: 'Stone', swatch: '#b8b8b5' },
  { id: 'ocean', label: 'Ocean', swatch: '#1d4a7a' },
  { id: 'light', label: 'Light', swatch: '#d9d3c6' },
  { id: 'linen', label: 'Linen', swatch: '#cdbfa6' },
  { id: 'candy', label: 'Pink Candy', swatch: '#d21e82' },
];

export const sectionAccents: Record<SectionId, string> = {
  home: '#c9a876', music: '#c9a8d4', applications: '#d4b896',
  life: '#a1bdc7', cv: '#b8c7a1', other: '#c7a1a1', calendar: '#bfa8c9',
  budget: '#a8c7b4', inbox: '#d0b89a', review: '#b8b0c4', email: '#a8b8c4', settings: '#a0adb8',
};
