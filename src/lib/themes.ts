export type ColorThemeId =
  | 'obsidian-mint'
  | 'warm-stone-forest'
  | 'monochrome-cobalt'
  | 'nordic-amber'
  | 'sandstone-terracotta'
  | 'deep-sea-cyan';

export type AccentOverrideId =
  | 'theme'
  | 'mint'
  | 'forest'
  | 'cobalt'
  | 'amber'
  | 'terracotta'
  | 'cyan'
  | 'ink';

export interface ColorThemePreview {
  bg: string;
  card: string;
  border: string;
  primary: string;
  secondary: string;
}

export interface ColorThemeDefinition {
  id: ColorThemeId;
  name: string;
  tagline: string;
  lightPreview: ColorThemePreview;
  darkPreview: ColorThemePreview;
  themeColorLight: string;
  themeColorDark: string;
}

export interface AccentOverrideDefinition {
  id: AccentOverrideId;
  label: string;
  swatchLight: string;
  swatchDark: string;
}

export const DEFAULT_COLOR_THEME: ColorThemeId = 'obsidian-mint';
export const DEFAULT_ACCENT_OVERRIDE: AccentOverrideId = 'theme';

export const COLOR_THEME_STORAGE_KEY = 'habitflow_color_theme';
export const ACCENT_OVERRIDE_STORAGE_KEY = 'habitflow_accent_override';
export const LEGACY_ACCENT_STORAGE_KEY = 'habitflow_accent';

export const COLOR_THEMES: readonly ColorThemeDefinition[] = [
  {
    id: 'obsidian-mint',
    name: 'Obsidian & Mint',
    tagline: 'Fintech calm · Graphite & Mint',
    lightPreview: {
      bg: 'oklch(0.985 0.002 240)',
      card: 'oklch(1 0 0)',
      border: 'oklch(0.905 0.005 240)',
      primary: 'oklch(0.52 0.14 163)',
      secondary: 'oklch(0.58 0.16 248)',
    },
    darkPreview: {
      bg: 'oklch(0.125 0.005 240)',
      card: 'oklch(0.162 0.006 240)',
      border: 'oklch(0.255 0.008 240)',
      primary: 'oklch(0.73 0.145 163)',
      secondary: 'oklch(0.69 0.15 248)',
    },
    themeColorLight: '#f8fafb',
    themeColorDark: '#0b0d0e',
  },
  {
    id: 'warm-stone-forest',
    name: 'Warm Stone & Forest',
    tagline: 'Editorial paper · Espresso & Pine',
    lightPreview: {
      bg: 'oklch(0.978 0.009 80)',
      card: 'oklch(0.996 0.005 80)',
      border: 'oklch(0.892 0.014 78)',
      primary: 'oklch(0.45 0.115 152)',
      secondary: 'oklch(0.60 0.135 42)',
    },
    darkPreview: {
      bg: 'oklch(0.14 0.010 65)',
      card: 'oklch(0.178 0.011 65)',
      border: 'oklch(0.275 0.014 68)',
      primary: 'oklch(0.68 0.125 152)',
      secondary: 'oklch(0.70 0.135 42)',
    },
    themeColorLight: '#f8f6f2',
    themeColorDark: '#12100d',
  },
  {
    id: 'monochrome-cobalt',
    name: 'Monochrome Ink + Cobalt',
    tagline: 'Pitch zinc · Ink & Electric Blue',
    lightPreview: {
      bg: 'oklch(0.992 0 0)',
      card: 'oklch(1 0 0)',
      border: 'oklch(0.90 0.004 250)',
      primary: 'oklch(0.16 0.006 250)',
      secondary: 'oklch(0.54 0.19 254)',
    },
    darkPreview: {
      bg: 'oklch(0.105 0.002 250)',
      card: 'oklch(0.145 0.003 250)',
      border: 'oklch(0.245 0.005 250)',
      primary: 'oklch(0.95 0.002 250)',
      secondary: 'oklch(0.68 0.175 252)',
    },
    themeColorLight: '#fcfcfc',
    themeColorDark: '#09090b',
  },
  {
    id: 'nordic-amber',
    name: 'Nordic Slate & Amber',
    tagline: 'Cool mist · Slate & Burnished Gold',
    lightPreview: {
      bg: 'oklch(0.976 0.006 238)',
      card: 'oklch(0.998 0.002 238)',
      border: 'oklch(0.892 0.011 238)',
      primary: 'oklch(0.58 0.155 68)',
      secondary: 'oklch(0.55 0.13 235)',
    },
    darkPreview: {
      bg: 'oklch(0.142 0.014 242)',
      card: 'oklch(0.182 0.016 242)',
      border: 'oklch(0.28 0.018 242)',
      primary: 'oklch(0.77 0.155 76)',
      secondary: 'oklch(0.70 0.135 235)',
    },
    themeColorLight: '#f4f7fa',
    themeColorDark: '#0d121a',
  },
  {
    id: 'sandstone-terracotta',
    name: 'Sandstone & Terracotta',
    tagline: 'Soft linen · Umber & Clay',
    lightPreview: {
      bg: 'oklch(0.974 0.011 65)',
      card: 'oklch(0.995 0.006 68)',
      border: 'oklch(0.888 0.017 62)',
      primary: 'oklch(0.55 0.145 38)',
      secondary: 'oklch(0.53 0.125 155)',
    },
    darkPreview: {
      bg: 'oklch(0.145 0.012 48)',
      card: 'oklch(0.185 0.014 48)',
      border: 'oklch(0.285 0.016 50)',
      primary: 'oklch(0.71 0.145 40)',
      secondary: 'oklch(0.70 0.135 156)',
    },
    themeColorLight: '#f8f4ee',
    themeColorDark: '#14100c',
  },
  {
    id: 'deep-sea-cyan',
    name: 'Deep Sea & Cyan',
    tagline: 'Ice white · Abyssal Navy & Cyan',
    lightPreview: {
      bg: 'oklch(0.982 0.006 218)',
      card: 'oklch(1 0 0)',
      border: 'oklch(0.896 0.012 220)',
      primary: 'oklch(0.53 0.135 206)',
      secondary: 'oklch(0.56 0.15 162)',
    },
    darkPreview: {
      bg: 'oklch(0.13 0.018 236)',
      card: 'oklch(0.168 0.022 236)',
      border: 'oklch(0.268 0.024 234)',
      primary: 'oklch(0.75 0.13 204)',
      secondary: 'oklch(0.72 0.145 162)',
    },
    themeColorLight: '#f6fafc',
    themeColorDark: '#091119',
  },
];

export const ACCENT_OVERRIDES: readonly AccentOverrideDefinition[] = [
  {
    id: 'theme',
    label: 'Match Theme',
    swatchLight: 'oklch(0.52 0.14 163)',
    swatchDark: 'oklch(0.73 0.145 163)',
  },
  {
    id: 'mint',
    label: 'Mint',
    swatchLight: 'oklch(0.52 0.14 163)',
    swatchDark: 'oklch(0.73 0.145 163)',
  },
  {
    id: 'forest',
    label: 'Forest',
    swatchLight: 'oklch(0.45 0.115 152)',
    swatchDark: 'oklch(0.68 0.125 152)',
  },
  {
    id: 'cobalt',
    label: 'Cobalt',
    swatchLight: 'oklch(0.54 0.185 254)',
    swatchDark: 'oklch(0.69 0.165 252)',
  },
  {
    id: 'amber',
    label: 'Amber',
    swatchLight: 'oklch(0.58 0.155 68)',
    swatchDark: 'oklch(0.77 0.155 76)',
  },
  {
    id: 'terracotta',
    label: 'Terracotta',
    swatchLight: 'oklch(0.55 0.145 38)',
    swatchDark: 'oklch(0.71 0.145 40)',
  },
  {
    id: 'cyan',
    label: 'Cyan',
    swatchLight: 'oklch(0.53 0.135 206)',
    swatchDark: 'oklch(0.75 0.13 204)',
  },
  {
    id: 'ink',
    label: 'Ink',
    swatchLight: 'oklch(0.16 0.006 250)',
    swatchDark: 'oklch(0.95 0.003 250)',
  },
];

const VALID_COLOR_THEME_SET = new Set<string>(COLOR_THEMES.map((t) => t.id));
const VALID_ACCENT_OVERRIDE_SET = new Set<string>(ACCENT_OVERRIDES.map((a) => a.id));

export function isValidColorTheme(val: unknown): val is ColorThemeId {
  return typeof val === 'string' && VALID_COLOR_THEME_SET.has(val);
}

export function isValidAccentOverride(val: unknown): val is AccentOverrideId {
  return typeof val === 'string' && VALID_ACCENT_OVERRIDE_SET.has(val);
}

export function getColorThemeById(id: ColorThemeId): ColorThemeDefinition {
  return COLOR_THEMES.find((t) => t.id === id) ?? COLOR_THEMES[0];
}
