import { px, round, rule, safeColor } from '@/renderer/css';
import { HINT_FIELD, TAP_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

const SCHEMA: SettingsSchema = {
  autoRotate: { type: 'toggle', label: 'Auto-rotate', default: true },
  speed: { type: 'slider', label: 'Spin speed', default: 25, min: 5, max: 90, step: 5, suffix: '°/s' },
  autoStop: {
    type: 'number', label: 'Auto-rotate stops after', default: 15, min: 3, max: 30, suffix: 's',
    help: 'Keeps the banner within the animation limit (30 s by default).',
  },
  radius: { type: 'slider', label: 'Ring width', default: 36, min: 20, max: 48, step: 1, suffix: '%' },
  tilt: { type: 'slider', label: 'Ring tilt', default: 15, min: 0, max: 40, step: 1, suffix: '°' },
  itemSize: { type: 'slider', label: 'Item size', default: 30, min: 15, max: 45, step: 1, suffix: '%' },
  centerSize: { type: 'slider', label: 'Centre size', default: 34, min: 0, max: 60, step: 1, suffix: '%' },
  centerBg: { type: 'color', label: 'Centre background', default: 'transparent' },
  fit: { type: 'select', label: 'Image fit', default: 'contain', options: [['contain', 'Contain'], ['cover', 'Cover']] },
  ...HINT_FIELD,
  ...TAP_FIELD,
};

/**
 * Position of item i on the ring at angle `ang` (degrees). Drawn in 2D with a 3D look (perspective scale,
 * depth order, back items dimmed), so items always face the viewer and the backup image matches exactly.
 * The runtime uses the same formula.
 */
export function placeItem(i: number, n: number, ang: number, R: number, tiltDeg: number): string {
  const a = ((ang + (i * 360) / n) * Math.PI) / 180;
  const x = Math.sin(a) * R;
  const z = Math.cos(a) * R;
  const k = (z / R + 1) / 2;
  const y = z * Math.sin((tiltDeg * Math.PI) / 180);
  return `transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(0.6 + 0.4 * k).toFixed(3)});` +
    `opacity:${(0.45 + 0.55 * k).toFixed(2)};z-index:${Math.round(k * 100) + 1}`;
}

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx) {
  const imgs = (slots.items ?? []).filter((s) => s.kind === 'image');
  const n = imgs.length > 0 ? imgs.length : 5;
  const m = Math.min(ctx.width, ctx.height);
  const R = round((ctx.width * Number(p.radius)) / 100);
  const tiltDeg = Number(p.tilt);
  const item = round((m * Number(p.itemSize)) / 100);
  const cs = round((m * Number(p.centerSize)) / 100);
  const items: string[] = [];
  for (let i = 0; i < n; i++) {
    items.push(`<div class="bco-i" style="${placeItem(i, n, 0, R, tiltDeg)}">${faceContent(imgs[i], String(p.fit), i, String(i + 1))}</div>`);
  }
  const center = cs > 0 ? `<div class="bco-c">${faceContent(slots.center?.[0], 'contain', 0, 'LOGO')}</div>` : '';
  const css = [
    rule(`${ctx.sel} .bco-i`, { width: px(item), height: px(item), 'margin-left': px(-item / 2), 'margin-top': px(-item / 2) }),
    rule(`${ctx.sel} .bco-c`, {
      width: px(cs), height: px(cs), 'margin-left': px(-cs / 2), 'margin-top': px(-cs / 2), background: safeColor(String(p.centerBg)),
    }),
  ].join('\n');
  return { html: `<div class="bco" data-r="${R}" data-tilt="${tiltDeg}">${center}${items.join('')}</div>`, css };
}

const RUNTIME = String.raw`bannr.define('orbit', function (el, p) {
  var root = el.querySelector('.bco');
  if (!root) return null;
  var items = root.querySelectorAll('.bco-i'), n = items.length;
  if (!n) return null;
  var R = Number(root.getAttribute('data-r')) || 100, tl = (Number(root.getAttribute('data-tilt')) || 0) * Math.PI / 180;
  var ang = 0, a0 = 0, vel = 0, dragging = false, started = false, idle = 0, auto = 0, w = 1;
  var spd = (Number(p.speed) || 25) / 1000, stopAfter = Math.min(30, Math.max(1, Number(p.autoStop) || 15)) * 1000;
  var autoOn = !!p.autoRotate && !bannr.reducedMotion;
  el.style.touchAction = 'pan-y';
  function draw() {
    for (var i = 0; i < n; i++) {
      var a = (ang + i * 360 / n) * Math.PI / 180, x = Math.sin(a) * R, z = Math.cos(a) * R, k = (z / R + 1) / 2, s = items[i].style;
      s.transform = 'translate(' + x.toFixed(1) + 'px,' + (z * Math.sin(tl)).toFixed(1) + 'px) scale(' + (0.6 + 0.4 * k).toFixed(3) + ')';
      s.opacity = (0.45 + 0.55 * k).toFixed(2);
      s.zIndex = String(Math.round(k * 100) + 1);
    }
  }
  var lp = bannr.loop(function (dt) {
    if (dragging) return;
    if (vel !== 0) {
      ang += vel * dt; vel *= Math.pow(0.995, dt);
      if (Math.abs(vel) < 0.001) vel = 0;
      draw(); return;
    }
    if (idle > 0) { idle -= dt; return; }
    if (autoOn && auto < stopAfter) { auto += dt; ang += spd * dt; draw(); return; }
    lp.stop();
  });
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var off = bannr.gesture(el, {
    start: function () { stopHint(); vel = 0; },
    move: function (g) {
      if (!dragging) {
        dragging = true; a0 = ang; w = el.offsetWidth || 1;
        if (!started) { started = true; bannr.track('interaction_start'); }
      }
      ang = a0 + (g.dx / w) * 180;
      draw();
    },
    end: function (g) {
      dragging = false; idle = 4000;
      vel = Math.max(-1, Math.min(1, ((g.vx || 0) / w) * 180));
      bannr.track('spin');
      lp.start();
    }
  }, { tapToExit: p.tapToExit !== false });
  if (autoOn) lp.start();
  return { destroy: function () { lp.stop(); off(); stopHint(); } };
});`;

export const orbit: ComponentDefinition = {
  type: 'orbit',
  version: 1,
  label: 'Orbit Carousel',
  category: '3d',
  description: 'A 3D ring of product images around a centre logo. Drag to spin it.',
  icon: '◎',
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 160, height: 120 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'items', label: 'Products', kind: 'image', required: true, min: 3, max: 8 },
    { name: 'center', label: 'Centre (e.g. logo)', kind: 'image', max: 1 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'spin'],
  weightBudgetKB: 6,
  styles:
    '.bco{position:relative;width:100%;height:100%;overflow:hidden}' +
    '.bco-i,.bco-c{position:absolute;left:50%;top:50%;overflow:hidden;border-radius:8px}.bco-c{z-index:51}' +
    '.bco img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx),
};
