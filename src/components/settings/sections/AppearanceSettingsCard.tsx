'use client';

import React from 'react';
import { Check, Monitor, Moon, Palette, RotateCcw, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ACCENT_OVERRIDES, COLOR_THEMES, DEFAULT_ACCENT_OVERRIDE, DEFAULT_COLOR_THEME, getColorThemeById,
  type AccentOverrideId, type ColorThemeId,
} from '@/lib/themes';

const SURFACE_MODES = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
] as const;

function SurfaceModeSelector(params: {
  activeMode: string | undefined;
  activeResolved: string | undefined;
  setTheme: (mode: 'light' | 'dark' | 'system') => void;
}) {
  const modeLabel =
    params.activeMode === 'system'
      ? `Following OS (${params.activeResolved === 'dark' ? 'Dark' : 'Light'})`
      : params.activeMode === 'dark'
        ? 'Dark surface'
        : 'Light surface';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Surface Mode</span>
        <span className="text-xs text-muted-foreground">{modeLabel}</span>
      </div>
      <div role="radiogroup" aria-label="Surface mode" className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60">
        {SURFACE_MODES.map((opt) => {
          const isSelected = params.activeMode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => params.setTheme(opt.value)}
              className={cn(
                'min-h-[38px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-2 text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
                isSelected ? 'bg-card text-foreground shadow-xs border border-border' : 'text-muted-foreground hover:text-foreground border border-transparent'
              )}
            >
              <opt.icon className="w-3.5 h-3.5 shrink-0" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemePaletteGallery(params: {
  activeColorTheme: ColorThemeId;
  activeResolved: string | undefined;
  activeThemeName: string;
  setColorTheme: (id: ColorThemeId) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Theme Palette</span>
        <span className="text-xs font-medium text-foreground">{params.activeThemeName}</span>
      </div>
      <div role="radiogroup" aria-label="Theme palette" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {COLOR_THEMES.map((item) => {
          const isSelected = params.activeColorTheme === item.id;
          const preview = params.activeResolved === 'dark' ? item.darkPreview : item.lightPreview;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => params.setColorTheme(item.id)}
              className={cn(
                'group relative flex flex-col text-left rounded-xl overflow-hidden border transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]',
                isSelected ? 'border-primary ring-1 ring-primary/30 shadow-xs' : 'border-border hover:border-foreground/25'
              )}
            >
              <div className="w-full p-2.5 border-b" style={{ backgroundColor: preview.bg, borderColor: preview.border }} aria-hidden="true">
                <div className="rounded-lg p-2 space-y-2 border" style={{ backgroundColor: preview.card, borderColor: preview.border }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-1.5 w-12 rounded-sm opacity-35" style={{ backgroundColor: params.activeResolved === 'dark' ? '#e5e7eb' : '#1f2937' }} />
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: preview.secondary }} />
                  </div>
                  <div className="h-1.5 w-full rounded-sm overflow-hidden" style={{ backgroundColor: preview.border }}>
                    <div className="h-full w-2/3 rounded-sm" style={{ backgroundColor: preview.primary }} />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="h-2.5 w-9 rounded-sm" style={{ backgroundColor: preview.primary }} />
                    <span className="h-1.5 w-6 rounded-sm opacity-60" style={{ backgroundColor: preview.secondary }} />
                  </div>
                </div>
              </div>
              <div className="p-2.5 bg-card flex items-start justify-between gap-2 flex-1">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-snug truncate">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">{item.tagline}</p>
                </div>
                {isSelected && (
                  <span className="w-4 h-4 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AccentOverrideRow(params: {
  activeAccentOverride: AccentOverrideId;
  activeResolved: string | undefined;
  activeThemePreview: { primary: string; secondary: string };
  isCustomized: boolean;
  setAccentOverride: (id: AccentOverrideId) => void;
  resetAppearance: () => void;
}) {
  return (
    <div className="space-y-2.5 pt-4 border-t border-border">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Accent Color Override</span>
        {params.isCustomized && (
          <button
            type="button"
            onClick={params.resetAppearance}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" /> <span>Reset</span>
          </button>
        )}
      </div>

      <div role="radiogroup" aria-label="Accent color override" className="flex flex-wrap items-center gap-2">
        {ACCENT_OVERRIDES.map((item) => {
          const isSelected = params.activeAccentOverride === item.id;
          const swatchColor = params.activeResolved === 'dark' ? item.swatchDark : item.swatchLight;
          const checkColor = item.id === 'ink' && params.activeResolved === 'dark' ? 'text-zinc-950' : 'text-white';

          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => params.setAccentOverride(item.id)}
              title={item.label}
              className={cn(
                'min-h-[36px] pl-2 pr-3 py-1.5 rounded-lg inline-flex items-center gap-2 border text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
                isSelected ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
              )}
            >
              {item.id === 'theme' ? (
                <span className="relative flex items-center justify-center w-3.5 h-3.5 rounded-sm overflow-hidden border border-border/80 shrink-0" aria-hidden="true">
                  <span className="w-1/2 h-full" style={{ backgroundColor: params.activeThemePreview.primary }} />
                  <span className="w-1/2 h-full" style={{ backgroundColor: params.activeThemePreview.secondary }} />
                </span>
              ) : (
                <span className="relative flex items-center justify-center w-3.5 h-3.5 rounded-sm border border-black/15 dark:border-white/20 shrink-0" style={{ backgroundColor: swatchColor }} aria-hidden="true">
                  {isSelected && <Check className={cn('w-2.5 h-2.5 stroke-[3]', checkColor)} />}
                </span>
              )}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AppearanceSettingsCard(params: {
  mounted: boolean;
  theme?: string;
  setTheme: (mode: 'light' | 'dark' | 'system') => void;
  resolvedTheme?: string;
  colorTheme: ColorThemeId;
  setColorTheme: (id: ColorThemeId) => void;
  accentOverride: AccentOverrideId;
  setAccentOverride: (id: AccentOverrideId) => void;
  resetAppearance: () => void;
}) {
  const activeMode = params.mounted ? params.theme : 'system';
  const activeResolved = params.mounted ? params.resolvedTheme : 'light';
  const activeColorTheme = params.mounted ? params.colorTheme : DEFAULT_COLOR_THEME;
  const activeAccentOverride = params.mounted ? params.accentOverride : DEFAULT_ACCENT_OVERRIDE;
  const activeThemeMeta = getColorThemeById(activeColorTheme);
  const activeThemePreview = activeResolved === 'dark' ? activeThemeMeta.darkPreview : activeThemeMeta.lightPreview;
  const isCustomized = params.mounted && (activeColorTheme !== DEFAULT_COLOR_THEME || activeAccentOverride !== DEFAULT_ACCENT_OVERRIDE);

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3 pb-5 border-b border-border">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><Palette className="h-4 w-4" /></div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground tracking-tight">Appearance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Customize surface brightness, theme palette, and accent color</p>
        </div>
      </div>

      <div className="space-y-5 pt-5">
        <SurfaceModeSelector activeMode={activeMode} activeResolved={activeResolved} setTheme={params.setTheme} />
        <ThemePaletteGallery activeColorTheme={activeColorTheme} activeResolved={activeResolved} activeThemeName={activeThemeMeta.name} setColorTheme={params.setColorTheme} />
        <AccentOverrideRow
          activeAccentOverride={activeAccentOverride}
          activeResolved={activeResolved}
          activeThemePreview={activeThemePreview}
          isCustomized={isCustomized}
          setAccentOverride={params.setAccentOverride}
          resetAppearance={params.resetAppearance}
        />
      </div>
    </section>
  );
}
