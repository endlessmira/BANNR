import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeHtml } from '@/renderer/escape';
import { HINT_FIELD, TAP_FIELD, THREE_CSS, faceContent } from '../three';
import { NAV_BCC, NAV_FIELDS, navCss } from '../nav';
import type {
  ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlot, ResolvedSlots, SettingsSchema,
} from '../types';

/**
 * CAROUSEL ENGINE: one component, six styles (each also a preset card).
 * Every slide ("unit") is placed from its offset to the current position. The functions below draw the
 * editor and backup state; the runtime uses exactly the same formulas (checked by unit tests).
 */
export type CarouselStyle = 'classic' | 'double' | 'change' | 'blur' | 'deck' | 'cubeflow';

const STYLES: ReadonlyArray<readonly [string, string]> = [
  ['classic', 'Classic'], ['double', 'Double (two visible)'], ['change', 'Double Change (background changes)'],
  ['blur', 'Blur (blurred background)'], ['deck', 'Card Deck'], ['cubeflow', 'Cube Flow (two per slide, cube turn)'],
];

/** Slides visible at once. */
export const visibleCount = (s: string): number => (s === 'double' || s === 'change' ? 2 : 1);
/** Where the loop wraps around: always out of view for each style. */
export const wrapShift = (s: string, n: number): number => (visibleCount(s) === 2 ? 0.5 : s === 'deck' ? n / 2 - 1 : 0);
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

export function offsetOf(i: number, pos: number, n: number, loop: boolean, shift: number): number {
  const o = i - pos;
  if (!loop) return o;
  const lo = -n / 2 + shift;
  return ((((o - lo) % n) + n) % n) + lo;
}

export interface Placement { t: string; op: number; z: number }

export function placeUnit(style: string, o: number, d: number): Placement {
  if (style === 'deck') {
    if (o < 0) return { t: `translateX(${r3(o * 120)}%) rotate(${r3(o * 12)}deg)`, op: r3(Math.max(0, 1 + o)), z: 200 };
    return {
      t: `translate(${r3(o * 6)}%,${r3(o * 4)}%) scale(${r3(Math.max(0.5, 1 - o * 0.08))})`,
      op: o > 3 ? 0 : 1, z: 100 - Math.round(o * 10),
    };
  }
  if (style === 'cubeflow') {
    return { t: `translateZ(${r3(-d)}px) rotateY(${r3(o * 90)}deg) translateZ(${r3(d)}px)`, op: Math.abs(o) < 1 ? 1 : 0, z: 1 };
  }
  return { t: `translateX(${r3(o * 100)}%)`, op: 1, z: 1 };
}

const SCHEMA: SettingsSchema = {
  style: { type: 'select', label: 'Style', default: 'classic', options: STYLES },
  autoAdvance: { type: 'toggle', label: 'Auto-advance', default: true },
  interval: { type: 'slider', label: 'Seconds per slide', default: 3, min: 1, max: 10, step: 0.5, suffix: 's' },
  autoStop: {
    type: 'number', label: 'Auto-advance stops after', default: 15, min: 3, max: 30, suffix: 's',
    help: 'Keeps the banner within the animation limit (30 s by default).',
  },
  loop: { type: 'toggle', label: 'Loop (wrap around)', default: true, help: 'Double and Double Change need at least 3 products to loop.' },
  speed: { type: 'slider', label: 'Transition duration', default: 0.5, min: 0.2, max: 1.5, step: 0.1, suffix: 's' },
  itemScale: { type: 'slider', label: 'Product size', default: 80, min: 50, max: 100, step: 5, suffix: '%' },
  fit: { type: 'select', label: 'Image fit', default: 'contain', options: [['contain', 'Contain'], ['cover', 'Cover']] },
  bgColor: { type: 'color', label: 'Background colour', default: 'transparent' },
  ...NAV_FIELDS,
  ...HINT_FIELD,
  ...TAP_FIELD,
};

const PH = ['#f2a902', '#ff3ea5', '#7c3aed', '#22d3ee'];

function bgLayer(s: ResolvedSlot | undefined, i: number, on: boolean): string {
  const op = on ? 1 : 0;
  if (s && s.kind === 'image') return `<img src="${escapeHtml(s.src)}" alt="" draggable="false" style="opacity:${op}">`;
  return `<div class="bc3-ph" style="background:${PH[i % PH.length] ?? '#999'};opacity:${op}"></div>`;
}

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const style = String(p.style);
  const fit = String(p.fit);
  const imgs = (slots.items ?? []).filter((s) => s.kind === 'image');
  const bgImgs = (slots.backgrounds ?? []).filter((s) => s.kind === 'image');
  const count = imgs.length > 0 ? imgs.length : 4;
  const item = (i: number): string => `<div class="bcc-c">${faceContent(imgs[i], fit, i, String(i + 1))}</div>`;

  const contents: string[] = [];
  if (style === 'cubeflow') for (let i = 0; i < count; i += 2) contents.push(item(i) + (i + 1 < count ? item(i + 1) : ''));
  else for (let i = 0; i < count; i++) contents.push(item(i));
  const n = contents.length;
  const vis = visibleCount(style);
  const loopOn = p.loop === true && n > vis;
  const shift = wrapShift(style, n);
  const d = round(ctx.width / 2);

  const units = contents.map((h, i) => {
    const q = placeUnit(style, offsetOf(i, 0, n, loopOn, shift), d);
    // 3D does not survive the backup renderer: the front slide is drawn flat there.
    const t = backup && style === 'cubeflow' && q.op > 0 ? 'none' : q.t;
    return `<div class="bcc-i${style === 'cubeflow' ? ' bcc-pair' : ''}" style="transform:${t};opacity:${q.op};z-index:${q.z}">${h}</div>`;
  }).join('');

  let bg = '';
  if (style === 'blur') {
    bg = `<div class="bcc-bg bcc-blur">${contents.map((_, i) => bgLayer(imgs[i], i, i === 0)).join('')}</div>`;
  } else if (style === 'change') {
    bg = `<div class="bcc-bg">${contents.map((_, i) => bgLayer(bgImgs.length > 0 ? bgImgs[i % bgImgs.length] : undefined, i, i === 0)).join('')}</div>`;
  } else if (bgImgs[0]) {
    bg = `<div class="bcc-static">${bgLayer(bgImgs[0], 0, true)}</div>`;
  }

  const nav = p.arrows === true
    ? '<button type="button" class="bcc-nav bcc-prev" data-nav="prev" aria-label="Previous">‹</button>' +
      '<button type="button" class="bcc-nav bcc-next" data-nav="next" aria-label="Next">›</button>'
    : '';
  const dotCount = loopOn ? n : Math.max(1, n - vis + 1);
  const dots = p.dots === true && dotCount > 1
    ? `<div class="bcc-dots">${Array.from({ length: dotCount }, (_, j) => `<i class="bcc-dot${j === 0 ? ' bcc-on' : ''}" data-i="${j}"></i>`).join('')}</div>`
    : '';

  const scale = Number(p.itemScale);
  const css = [
    rule(`${ctx.sel} .bcc`, {
      background: safeColor(String(p.bgColor)),
      color: safeColor(String(p.navColor), '#111'),
      perspective: px(round(Math.max(ctx.width, ctx.height) * 2.5)),
    }),
    rule(`${ctx.sel} .bcc-c`, { width: `${scale}%`, height: `${scale}%` }),
    rule(`${ctx.sel} .bcc-pair .bcc-c`, { width: `${round(scale / 2)}%` }),
    navCss(p, ctx.sel, NAV_BCC),
  ].join('\n');
  return {
    html: `<div class="bcc" data-style="${escapeHtml(style)}" data-d="${d}">${bg}<div class="bcc-track">${units}</div>${nav}${dots}</div>`,
    css,
  };
}

const RUNTIME = String.raw`bannr.define('carousel', function (el, p) {
  var root = el.querySelector('.bcc');
  if (!root) return null;
  var units = root.querySelectorAll('.bcc-i'), n = units.length;
  if (!n) return null;
  var bgs = root.querySelectorAll('.bcc-bg > *'), dots = root.querySelectorAll('.bcc-dot');
  var style = root.getAttribute('data-style') || 'classic', d = Number(root.getAttribute('data-d')) || 150;
  var vis = style === 'double' || style === 'change' ? 2 : 1, loop = !!p.loop && n > vis;
  var shift = vis === 2 ? 0.5 : style === 'deck' ? n / 2 - 1 : 0, maxPos = loop ? 1e9 : Math.max(0, n - vis);
  var dur = Math.max(0.1, Number(p.speed) || 0.5), every = Math.max(1, Number(p.interval) || 3) * 1000;
  var stopAfter = Math.min(30, Math.max(1, Number(p.autoStop) || 15)) * 1000;
  var pos = 0, p0 = 0, uw = 1, cur = 0, dragging = false, started = false, idle = 0, t = 0, played = 0, downT = null, last = [];
  el.style.touchAction = 'pan-y';
  function r(v) { return Math.round(v * 1000) / 1000; }
  function offset(i) {
    var o = i - pos;
    if (!loop) return o;
    var lo = -n / 2 + shift;
    return (((o - lo) % n) + n) % n + lo;
  }
  function place(o) {
    if (style === 'deck') {
      if (o < 0) return ['translateX(' + r(o * 120) + '%) rotate(' + r(o * 12) + 'deg)', r(Math.max(0, 1 + o)), 200];
      return ['translate(' + r(o * 6) + '%,' + r(o * 4) + '%) scale(' + r(Math.max(0.5, 1 - o * 0.08)) + ')', o > 3 ? 0 : 1, 100 - Math.round(o * 10)];
    }
    if (style === 'cubeflow') return ['translateZ(' + r(-d) + 'px) rotateY(' + r(o * 90) + 'deg) translateZ(' + r(d) + 'px)', Math.abs(o) < 1 ? 1 : 0, 1];
    return ['translateX(' + r(o * 100) + '%)', 1, 1];
  }
  function draw(anim) {
    for (var i = 0; i < n; i++) {
      var o = offset(i), q = place(o), s = units[i].style;
      var jump = last[i] !== undefined && Math.abs(o - last[i]) > n / 2;
      s.transition = anim && !jump ? 'transform ' + dur + 's cubic-bezier(.22,1,.36,1),opacity ' + dur + 's ease' : 'none';
      s.transform = q[0]; s.opacity = String(q[1]); s.zIndex = String(q[2]);
      last[i] = o;
    }
    var c = ((Math.round(pos) % n) + n) % n;
    for (var j = 0; j < bgs.length; j++) bgs[j].style.opacity = j === c ? '1' : '0';
    for (var k = 0; k < dots.length; k++) { if (k === c) dots[k].classList.add('bcc-on'); else dots[k].classList.remove('bcc-on'); }
    return c;
  }
  function go(k, user) {
    pos = loop ? k : Math.max(0, Math.min(maxPos, k));
    var c = draw(true);
    if (c !== cur) { cur = c; if (user) bannr.track('slide_change'); }
  }
  function touch() { if (!started) { started = true; bannr.track('interaction_start'); } idle = 4000; t = 0; }
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var lp = bannr.loop(function (dt) {
    if (dragging) return;
    if (idle > 0) { idle -= dt; return; }
    played += dt;
    if (played > stopAfter) { lp.stop(); return; }
    t += dt;
    if (t >= every) { t = 0; var k = Math.round(pos) + 1; go(!loop && k > maxPos ? 0 : k, false); }
  });
  function down(e) { downT = e.target || null; }
  el.addEventListener('pointerdown', down);
  draw(false);
  if (p.autoAdvance && !bannr.reducedMotion && n > vis) lp.start();
  var ungesture = bannr.gesture(el, {
    start: function () { stopHint(); },
    move: function (g) {
      if (!dragging) { dragging = true; p0 = pos; uw = (el.offsetWidth || 1) / vis; touch(); }
      pos = p0 - g.dx / uw;
      if (!loop) pos = Math.max(-0.3, Math.min(maxPos + 0.3, pos));
      draw(false);
    },
    end: function (g) {
      dragging = false; touch();
      var v = g.vx || 0;
      go(v < -0.3 ? Math.ceil(pos) : v > 0.3 ? Math.floor(pos) : Math.round(pos), true);
    },
    tap: function () {
      var b = downT && downT.closest ? downT.closest('[data-nav],[data-i]') : null;
      if (!b) return false;
      touch();
      var nav = b.getAttribute('data-nav'), base = Math.round(pos), c0 = ((base % n) + n) % n;
      if (nav) go(base + (nav === 'next' ? 1 : -1), true);
      else go(base + (Number(b.getAttribute('data-i')) || 0) - c0, true);
      return true;
    }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () { lp.stop(); ungesture(); stopHint(); el.removeEventListener('pointerdown', down); } };
});`;

export const carousel: ComponentDefinition = {
  type: 'carousel',
  version: 1,
  label: 'Carousel',
  category: 'carousel',
  description: 'A swipeable product carousel with auto-advance, arrows and dots.',
  icon: '⇆',
  presets: [
    { id: 'classic', label: 'Classic', description: 'One product at a time on your own background.', props: { style: 'classic' } },
    { id: 'double', label: 'Double', description: 'Two products visible at the same time.', props: { style: 'double', itemScale: 90 } },
    { id: 'change', label: 'Double Change', description: 'Two products; the background image changes with each slide.', props: { style: 'change', itemScale: 90 } },
    { id: 'blur', label: 'Blur', description: 'A blurred copy of the product fills the background.', props: { style: 'blur' } },
    { id: 'deck', label: 'Card Deck', description: 'Products as a stacked deck of cards.', props: { style: 'deck', itemScale: 75, arrows: false } },
    { id: 'cubeflow', label: 'Cube Flow', description: 'Two products per slide; slides turn like a cube.', props: { style: 'cubeflow', itemScale: 90 } },
  ],
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 120, height: 90 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'items', label: 'Products', kind: 'image', required: true, min: 2, max: 8 },
    { name: 'backgrounds', label: 'Backgrounds (one per slide for Double Change)', kind: 'image', max: 8 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'slide_change'],
  weightBudgetKB: 10,
  styles:
    '.bcc{position:relative;width:100%;height:100%;overflow:hidden}' +
    '.bcc-track{position:absolute;inset:0;transform-style:preserve-3d}' +
    '.bcc-i{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;' +
    'backface-visibility:hidden;-webkit-backface-visibility:hidden}' +
    '.bcc[data-style="double"] .bcc-i,.bcc[data-style="change"] .bcc-i{width:50%}.bcc-pair{gap:4%}' +
    '.bcc-c{position:relative;overflow:hidden}' +
    '.bcc[data-style="deck"] .bcc-c{border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.25);background:#fff}' +
    '.bcc img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' +
    '.bcc-bg,.bcc-static{position:absolute;inset:0}.bcc-bg>*,.bcc-static>*{position:absolute;inset:0;transition:opacity .6s ease}' +
    '.bcc-bg img,.bcc-static img{object-fit:cover}.bcc-blur>*{filter:blur(16px);transform:scale(1.15)}' +
    '.bcc-nav{position:absolute;top:50%;z-index:300;width:28px;height:28px;margin-top:-14px;padding:0;border:0;border-radius:50%;' +
    'background:rgba(255,255,255,.8);color:inherit;font:700 18px/28px Arial,sans-serif;cursor:pointer}' +
    '.bcc-prev{left:6px}.bcc-next{right:6px}' +
    '.bcc-dots{position:absolute;left:0;right:0;bottom:6px;z-index:300;display:flex;justify-content:center;gap:6px}' +
    '.bcc-dot{width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.35;cursor:pointer}.bcc-dot.bcc-on{opacity:1}' +
    THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
