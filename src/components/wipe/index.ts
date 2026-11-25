import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeText } from '@/renderer/escape';
import { HINT_FIELD, TAP_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/** BEFORE/AFTER WIPE: a draggable divider between two images (CSS clip-path, driven by --p). */
const LABELS = { key: 'showLabels', is: ['true'] } as const;
const HANDLE = { key: 'showHandle', is: ['true'] } as const;
const AUTO = { key: 'autoPlay', is: ['true'] } as const;

const SCHEMA: SettingsSchema = {
  style: { type: 'select', label: 'Style', default: 'wipe', options: [['wipe', 'Wipe'], ['box', '50:50 Box (pulsing play handle)']] },
  orientation: {
    type: 'select', label: 'Divider', default: 'v',
    options: [['v', 'Vertical line (drag sideways)'], ['h', 'Horizontal line (drag up and down)']],
  },
  start: { type: 'number', label: 'Start position', default: 50, min: 0, max: 100, suffix: '%' },
  fit: { type: 'select', label: 'Image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  lineColor: { type: 'color', label: 'Line colour', default: '#ffffff' },
  lineWidth: { type: 'number', label: 'Line width', default: 3, min: 1, max: 12, suffix: 'px' },
  glow: { type: 'toggle', label: 'Glowing line', default: false },
  showHandle: { type: 'toggle', label: 'Handle', default: true },
  handleColor: { type: 'color', label: 'Handle colour', default: '#ffffff', when: HANDLE },
  handleIconColor: { type: 'color', label: 'Handle icon colour', default: '#111111', when: HANDLE },
  showLabels: { type: 'toggle', label: 'Before / After labels', default: true },
  beforeLabel: { type: 'text', label: 'Before label', default: 'Before', maxLength: 20, when: LABELS },
  afterLabel: { type: 'text', label: 'After label', default: 'After', maxLength: 20, when: LABELS },
  labelBg: { type: 'color', label: 'Label background', default: 'rgba(0,0,0,0.55)', when: LABELS },
  labelColor: { type: 'color', label: 'Label text colour', default: '#ffffff', when: LABELS },
  autoPlay: { type: 'toggle', label: 'Auto-play', default: false, help: 'The line sweeps back and forth until someone touches it.' },
  playSpeed: { type: 'number', label: 'Seconds per sweep', default: 3, min: 1, max: 10, step: 0.5, suffix: 's', when: AUTO },
  playRange: { type: 'number', label: 'Sweep range', default: 30, min: 10, max: 50, suffix: '%', when: AUTO },
  autoStop: {
    type: 'number', label: 'Auto-play stops after', default: 12, min: 3, max: 30, suffix: 's', when: AUTO,
    help: 'Keeps the banner within the animation limit (30 s by default).',
  },
  ...HINT_FIELD,
  ...TAP_FIELD,
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx) {
  const v = p.orientation !== 'h';
  const box = p.style === 'box';
  const pos = round(clamp(Number(p.start), 0, 100), 1);
  const fit = String(p.fit);
  const labels = p.showLabels === true
    ? `<span class="bwp-lb bwp-lb-b" data-lb="b">${escapeText(String(p.beforeLabel))}</span>` +
      `<span class="bwp-lb bwp-lb-a" data-lb="a">${escapeText(String(p.afterLabel))}</span>`
    : '';
  const handle = p.showHandle === true ? `<span class="bwp-h">${box ? '▶' : v ? '⇔' : '⇕'}</span>` : '';
  const html =
    `<div class="bwp" data-o="${v ? 'v' : 'h'}" data-st="${box ? 'box' : 'wipe'}" style="--p:${pos}%">` +
    `<div class="bwp-a">${faceContent(slots.after?.[0], fit, 1, 'After')}</div>` +
    `<div class="bwp-b">${faceContent(slots.before?.[0], fit, 0, 'Before')}</div>` +
    `${labels}<div class="bwp-line">${handle}</div></div>`;
  const line = safeColor(String(p.lineColor), '#fff');
  const css = [
    rule(`${ctx.sel} .bwp`, { '--lw': px(Number(p.lineWidth)) }),
    rule(`${ctx.sel} .bwp-line`, { background: line, 'box-shadow': p.glow === true ? `0 0 12px 3px ${line}` : undefined }),
    rule(`${ctx.sel} .bwp-h`, {
      background: safeColor(String(p.handleColor), '#fff'), color: safeColor(String(p.handleIconColor), '#111'),
    }),
    rule(`${ctx.sel} .bwp-lb`, {
      background: safeColor(String(p.labelBg), 'rgba(0,0,0,0.55)'), color: safeColor(String(p.labelColor), '#fff'),
    }),
  ].join('\n');
  return { html, css };
}

const RUNTIME = String.raw`bannr.define('wipe', function (el, p) {
  var root = el.querySelector('.bwp');
  if (!root) return null;
  var v = root.getAttribute('data-o') !== 'h';
  var base = Number(p.start);
  if (!isFinite(base)) base = 50;
  var started = false, touched = false, t = 0, played = 0;
  var period = Math.max(1, Number(p.playSpeed) || 3) * 1000, range = Number(p.playRange) || 30;
  var stopAfter = Math.min(30, Math.max(1, Number(p.autoStop) || 12)) * 1000;
  el.style.touchAction = v ? 'pan-y' : 'pan-x';
  function set(x) { var q = Math.max(0, Math.min(100, x)); root.style.setProperty('--p', (Math.round(q * 10) / 10) + '%'); }
  function at(e) {
    var r = el.getBoundingClientRect();
    return v ? ((e.clientX - r.left) / (r.width || 1)) * 100 : ((e.clientY - r.top) / (r.height || 1)) * 100;
  }
  var lp = bannr.loop(function (dt) {
    if (touched) { lp.stop(); return; }
    played += dt; t += dt;
    if (played > stopAfter) { set(base); lp.stop(); return; }
    set(base + range * Math.sin((t / period) * Math.PI * 2));
  });
  if (p.autoPlay && !bannr.reducedMotion) lp.start();
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var off = bannr.gesture(el, {
    start: function () { stopHint(); touched = true; },
    move: function (g) {
      if (!started) { started = true; bannr.track('interaction_start'); }
      set(at(g.event));
    },
    end: function () { bannr.track('wipe'); }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () { lp.stop(); off(); stopHint(); } };
});`;

export const wipe: ComponentDefinition = {
  type: 'wipe',
  version: 1,
  label: 'Before/After Wipe',
  category: 'reveal',
  description: 'Drag a divider line to wipe between a before and an after image.',
  icon: '◧',
  presets: [
    { id: 'wipe', label: 'Wipe', description: 'A glowing divider line you drag.', props: { style: 'wipe', glow: true, autoPlay: false } },
    { id: 'box', label: '50:50 Box', description: 'Starts split in half and sweeps on its own, with a play handle.', props: { style: 'box', glow: false, autoPlay: true } },
  ],
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 100, height: 80 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'before', label: 'Before image', kind: 'image', required: true, max: 1 },
    { name: 'after', label: 'After image', kind: 'image', required: true, max: 1 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'wipe'],
  weightBudgetKB: 6,
  styles:
    '.bwp{position:relative;width:100%;height:100%;overflow:hidden}.bwp-a,.bwp-b{position:absolute;inset:0}' +
    '.bwp img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' +
    '.bwp[data-o="v"] .bwp-b{clip-path:inset(0 calc(100% - var(--p)) 0 0)}' +
    '.bwp[data-o="h"] .bwp-b{clip-path:inset(0 0 calc(100% - var(--p)) 0)}' +
    '.bwp-line{position:absolute;z-index:5;pointer-events:none}' +
    '.bwp[data-o="v"] .bwp-line{top:0;bottom:0;left:var(--p);width:var(--lw,3px);margin-left:calc(var(--lw,3px) / -2)}' +
    '.bwp[data-o="h"] .bwp-line{left:0;right:0;top:var(--p);height:var(--lw,3px);margin-top:calc(var(--lw,3px) / -2)}' +
    '.bwp-h{position:absolute;left:50%;top:50%;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;' +
    'display:grid;place-items:center;font:700 15px/1 Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)}' +
    '.bwp[data-st="box"] .bwp-h{animation:bwp-pulse 1.2s ease-in-out 5}@keyframes bwp-pulse{50%{transform:scale(1.15)}}' +
    '.bwp-lb{position:absolute;z-index:4;padding:3px 8px;border-radius:4px;font:700 12px Arial,sans-serif;pointer-events:none}' +
    '.bwp-lb-b{left:8px;top:8px}.bwp[data-o="v"] .bwp-lb-a{right:8px;top:8px}.bwp[data-o="h"] .bwp-lb-a{left:8px;bottom:8px}' +
    '@media (prefers-reduced-motion:reduce){.bwp-h{animation:none!important}}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx),
};
