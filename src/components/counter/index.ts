import { fontStack, px, rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, SettingsSchema } from '../types';

/** 10000 → "10,000"; with "." or " " as thousands separator the decimal mark is ",". Same logic as the runtime. */
export function formatNumber(v: number, decimals: number, sep: string): string {
  const d = Math.max(0, Math.min(3, Math.round(decimals)));
  const fixed = Math.abs(v).toFixed(d);
  const [int = '0', frac] = fixed.split('.');
  const grouped = sep ? int.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : int;
  const decSep = sep === '.' || sep === ' ' ? ',' : '.';
  const neg = v < 0 && Number(fixed) !== 0;
  return `${neg ? '-' : ''}${grouped}${frac ? decSep + frac : ''}`;
}

const SCHEMA: SettingsSchema = {
  start: { type: 'number', label: 'Start value', default: 0 },
  end: { type: 'number', label: 'End value', default: 50 },
  decimals: { type: 'number', label: 'Decimals', default: 0, min: 0, max: 3, step: 1 },
  separator: { type: 'select', label: 'Thousands', default: ',', options: [['', 'None'], [',', '1,000'], ['.', '1.000'], [' ', '1 000']] },
  prefix: { type: 'text', label: 'Prefix', default: '', maxLength: 20 },
  suffix: { type: 'text', label: 'Suffix', default: '%', maxLength: 20 },
  duration: { type: 'slider', label: 'Duration', default: 2, min: 0.2, max: 10, step: 0.1, suffix: 's' },
  delay: { type: 'number', label: 'Delay', default: 0, min: 0, max: 30, step: 0.1, suffix: 's' },
  easing: { type: 'select', label: 'Easing', default: 'easeOut', options: [['easeOut', 'Ease out'], ['easeInOut', 'Ease in-out'], ['linear', 'Linear']] },
  fontFamily: { type: 'font', label: 'Font', default: 'Arial' },
  fontSize: { type: 'number', label: 'Font size', default: 48, min: 6, max: 300, suffix: 'px' },
  fontWeight: { type: 'select', label: 'Weight', default: '700', options: [['400', 'Regular'], ['700', 'Bold'], ['900', 'Black']] },
  color: { type: 'color', label: 'Color', default: '#111111' },
  align: { type: 'select', label: 'Align', default: 'center', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] },
};

const JUSTIFY: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };

/** Edit mode and backup show the end value; the live banner counts up to it. */
function output(p: ResolvedProps, ctx: ComponentRenderCtx) {
  const html =
    `<div class="bc-counter"><span class="bc-pre">${escapeText(String(p.prefix))}</span>` +
    `<span class="bc-val">${escapeHtml(formatNumber(Number(p.end), Number(p.decimals), String(p.separator)))}</span>` +
    `<span class="bc-suf">${escapeText(String(p.suffix))}</span></div>`;
  const css = rule(`${ctx.sel} .bc-counter`, {
    'font-family': fontStack(String(p.fontFamily)),
    'font-size': px(Number(p.fontSize)),
    'font-weight': Number(p.fontWeight),
    color: safeColor(String(p.color), '#111111'),
    'justify-content': JUSTIFY[String(p.align)] ?? 'center',
  });
  return { html, css };
}

const RUNTIME = String.raw`bannr.define('counter', function (el, p) {
  var n = el.querySelector('.bc-val');
  if (!n) return null;
  var a = Number(p.start) || 0, z = Number(p.end) || 0;
  var dec = Math.max(0, Math.min(3, Math.round(Number(p.decimals) || 0)));
  var sep = typeof p.separator === 'string' ? p.separator : '';
  var dur = Math.max(0, Number(p.duration) || 0) * 1000, wait = Math.max(0, Number(p.delay) || 0) * 1000;
  var ease = p.easing === 'linear' ? function (t) { return t; }
    : p.easing === 'easeInOut' ? function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    : function (t) { return 1 - Math.pow(1 - t, 3); };
  function fmt(v) {
    var f = Math.abs(v).toFixed(dec), parts = f.split('.'), i = parts[0];
    if (sep) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    var ds = sep === '.' || sep === ' ' ? ',' : '.';
    return (v < 0 && Number(f) !== 0 ? '-' : '') + i + (parts[1] ? ds + parts[1] : '');
  }
  function show(v) { n.textContent = fmt(v); }
  if (bannr.reducedMotion || dur === 0) { show(z); bannr.track('counter_complete'); return null; }
  show(a);
  var t = -wait;
  var lp = bannr.loop(function (dt) {
    t += dt;
    if (t < 0) return;
    var k = Math.min(1, t / dur);
    show(a + (z - a) * ease(k));
    if (k >= 1) { lp.stop(); bannr.track('counter_complete'); }
  });
  lp.start();
  return { destroy: lp.stop };
});`;

export const counter: ComponentDefinition = {
  type: 'counter',
  version: 1,
  label: 'Counter',
  category: 'widget',
  description: 'An animated number, e.g. "-50%" or "10,000+ sold".',
  icon: '123',
  presets: [
    { id: 'discount', label: 'Discount', description: 'Counts to -50%', props: { start: 0, end: -50, prefix: '', suffix: '%' } },
    { id: 'sold', label: 'Sold counter', description: 'Counts to 10,000+ sold', props: { start: 0, end: 10000, separator: ',', suffix: '+ sold' } },
  ],
  defaultSize: { width: 240, height: 80 },
  minSize: { width: 40, height: 20 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [],
  capturesPointer: false,
  emits: ['counter_complete'],
  weightBudgetKB: 3,
  styles: '.bc-counter{display:flex;align-items:center;width:100%;height:100%;white-space:pre;line-height:1;font-variant-numeric:tabular-nums}',
  render: (p, _slots, ctx) => output(p, ctx),
  runtime: RUNTIME,
  backupState: (p, _slots, ctx) => output(p, ctx),
};
