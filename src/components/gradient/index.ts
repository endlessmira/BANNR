import { round, rule, safeColor } from '@/renderer/css';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, SettingsSchema } from '../types';

const SCHEMA: SettingsSchema = {
  colorCount: { type: 'slider', label: 'Colours', default: 3, min: 2, max: 5, step: 1 },
  color1: { type: 'color', label: 'Colour 1', default: '#f2a902' },
  color2: { type: 'color', label: 'Colour 2', default: '#ff3ea5' },
  color3: { type: 'color', label: 'Colour 3', default: '#7c3aed' },
  color4: { type: 'color', label: 'Colour 4', default: '#22d3ee' },
  color5: { type: 'color', label: 'Colour 5', default: '#16a34a' },
  angle: { type: 'number', label: 'Angle', default: 135, min: 0, max: 360, suffix: '°' },
  speed: { type: 'slider', label: 'Seconds per sweep', default: 6, min: 2, max: 20, step: 0.5, suffix: 's' },
  sweeps: {
    type: 'number', label: 'Sweeps', default: 4, min: 1, max: 10, step: 1,
    help: 'Stops after this many sweeps. Keep sweeps × seconds within your animation limit (30 s by default).',
  },
};

function gradient(p: ResolvedProps): string {
  const n = Math.max(2, Math.min(5, Math.round(Number(p.colorCount))));
  const cols = [p.color1, p.color2, p.color3, p.color4, p.color5].slice(0, n).map((c) => safeColor(String(c), '#000'));
  return `linear-gradient(${round(Number(p.angle))}deg,${cols.join(',')})`;
}

function output(p: ResolvedProps, ctx: ComponentRenderCtx, still: boolean) {
  const css = still
    ? rule(`${ctx.sel} .bc-grad`, { background: gradient(p), animation: 'none' })
    : rule(`${ctx.sel} .bc-grad`, {
        background: gradient(p),
        'background-size': '400% 400%',
        animation: `bc-grad-move ${round(Number(p.speed))}s ease-in-out 0s ${Math.round(Number(p.sweeps))} alternate both`,
      });
  return { html: '<div class="bc-grad"></div>', css };
}

export const gradient_: ComponentDefinition = {
  type: 'gradient',
  version: 1,
  label: 'Animated Gradient',
  category: 'motion',
  description: 'A smoothly shifting multi-colour background.',
  icon: '◐',
  defaultSize: { width: 480, height: 480 },
  minSize: { width: 10, height: 10 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [],
  capturesPointer: false,
  addAsBackground: true,
  emits: [],
  weightBudgetKB: 2,
  styles:
    '.bc-grad{width:100%;height:100%}' +
    '@keyframes bc-grad-move{0%{background-position:0% 50%}100%{background-position:100% 50%}}' +
    '@media (prefers-reduced-motion:reduce){.bc-grad{animation:none!important}}',
  render: (p, _s, ctx) => output(p, ctx, false),
  // Pure CSS: nothing to run.
  runtime: "bannr.define('gradient', function () { return null; });",
  backupState: (p, _s, ctx) => output(p, ctx, true),
};
