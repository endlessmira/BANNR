import { fontStack, px, round, rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import { offsetOf } from '../carousel';
import { HINT_FIELD, TAP_FIELD, THREE_CSS, faceContent } from '../three';
import { NAV_BCS, NAV_FIELDS, navCss } from '../nav';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedItem, ResolvedProps, SettingsSchema } from '../types';

/**
 * CAROUSEL SET: a multi-layer carousel. 2–6 slides, each with up to 4 image or text layers.
 * Every layer has a position (in % of the slide) and an entrance effect that plays whenever its slide appears.
 */
const TEXT = { key: 'kind', is: ['text'] } as const;
const IMAGE = { key: 'kind', is: ['image'] } as const;
const SIZED = { key: 'place', is: ['center', 'top', 'bottom', 'left', 'right', 'custom'] } as const;
const CUSTOM = { key: 'place', is: ['custom'] } as const;

const FX: ReadonlyArray<readonly [string, string]> = [
  ['none', 'None'], ['fade', 'Fade'], ['slide-left', 'Slide left ←'], ['slide-right', 'Slide right →'],
  ['slide-up', 'Slide up ↑'], ['slide-down', 'Slide down ↓'], ['zoom', 'Zoom'], ['grow', 'Grow'], ['shrink', 'Shrink'], ['blur', 'Blur'],
];

const LAYER: SettingsSchema = {
  kind: { type: 'select', label: 'Type', default: 'image', options: [['image', 'Image'], ['text', 'Text']] },
  image: { type: 'image', label: 'Image', default: '', when: IMAGE },
  fit: { type: 'select', label: 'Image fit', default: 'contain', options: [['contain', 'Contain'], ['cover', 'Cover']], when: IMAGE },
  text: { type: 'text', label: 'Text', default: 'Your headline', multiline: true, maxLength: 200, when: TEXT },
  fontFamily: { type: 'font', label: 'Font', default: 'Arial', when: TEXT },
  fontSize: { type: 'slider', label: 'Text size', default: 12, min: 3, max: 40, step: 0.5, suffix: '% of height', when: TEXT },
  fontWeight: { type: 'select', label: 'Weight', default: '700', options: [['400', 'Regular'], ['700', 'Bold'], ['900', 'Black']], when: TEXT },
  color: { type: 'color', label: 'Text colour', default: '#111111', when: TEXT },
  align: { type: 'select', label: 'Align', default: 'center', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], when: TEXT },
  place: {
    type: 'select', label: 'Position', default: 'center',
    options: [['center', 'Centre'], ['fill', 'Fill the slide'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['custom', 'Custom (X / Y)']],
  },
  x: { type: 'number', label: 'X', default: 10, min: -50, max: 150, suffix: '%', when: CUSTOM },
  y: { type: 'number', label: 'Y', default: 10, min: -50, max: 150, suffix: '%', when: CUSTOM },
  w: { type: 'number', label: 'Width', default: 60, min: 1, max: 100, suffix: '%', when: SIZED },
  h: { type: 'number', label: 'Height', default: 40, min: 1, max: 100, suffix: '%', when: SIZED },
  effect: { type: 'select', label: 'Entrance', default: 'fade', options: FX },
  delay: { type: 'number', label: 'Delay', default: 0, min: 0, max: 10, step: 0.1, suffix: 's' },
  duration: { type: 'number', label: 'Length', default: 0.5, min: 0.1, max: 5, step: 0.1, suffix: 's' },
};

const sample = (bg: string, n: number): ResolvedItem => ({
  bgColor: bg,
  layers: [
    { kind: 'image', place: 'center', w: 55, h: 55, effect: 'zoom', delay: 0, duration: 0.5 },
    { kind: 'text', text: `Headline ${n}`, place: 'bottom', w: 90, h: 20, effect: 'slide-up', delay: 0.3, duration: 0.5 },
  ],
});

const SLIDE: SettingsSchema = {
  bgColor: { type: 'color', label: 'Background colour', default: '#ffffff' },
  bgImage: { type: 'image', label: 'Background image', default: '' },
  bgFit: { type: 'select', label: 'Background fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  layers: { type: 'group', label: 'Layers', itemLabel: 'Layer', min: 0, max: 4, layout: 'list', fields: LAYER, default: [] },
};

const SCHEMA: SettingsSchema = {
  slides: {
    type: 'group', label: 'Slides', itemLabel: 'Slide', min: 2, max: 6, layout: 'tabs', fields: SLIDE,
    default: [sample('#f2a902', 1), sample('#22d3ee', 2), sample('#ff3ea5', 3)], selectProp: 'editSlide',
  },
  editSlide: { type: 'number', label: 'Slide shown in the editor', default: 1, min: 1, max: 6, step: 1, hidden: true },
  transition: {
    type: 'select', label: 'Between slides', default: 'slide',
    options: [['slide', 'Slide'], ['fade', 'Fade'], ['cube', 'Cube turn'], ['none', 'None']],
  },
  speed: { type: 'slider', label: 'Transition duration', default: 0.6, min: 0.2, max: 1.5, step: 0.1, suffix: 's' },
  autoAdvance: { type: 'toggle', label: 'Auto-advance', default: true },
  interval: { type: 'slider', label: 'Seconds per slide', default: 4, min: 1.5, max: 12, step: 0.5, suffix: 's', help: 'Leave time for the layer entrances.' },
  autoStop: {
    type: 'number', label: 'Auto-advance stops after', default: 15, min: 3, max: 30, suffix: 's',
    help: 'Keeps the banner within the animation limit (30 s by default).',
  },
  loop: { type: 'toggle', label: 'Loop (wrap around)', default: true, help: 'Needs at least 3 slides.' },
  ...NAV_FIELDS,
  ...HINT_FIELD,
  ...TAP_FIELD,
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** [x, y, width, height] in % of the slide. */
export function layerBox(l: ResolvedItem): [number, number, number, number] {
  const place = String(l.place);
  if (place === 'fill') return [0, 0, 100, 100];
  const w = clamp(Number(l.w) || 60, 1, 100);
  const h = clamp(Number(l.h) || 40, 1, 100);
  const cx = (100 - w) / 2;
  const cy = (100 - h) / 2;
  switch (place) {
    case 'top': return [cx, 5, w, h];
    case 'bottom': return [cx, Math.max(0, 95 - h), w, h];
    case 'left': return [5, cy, w, h];
    case 'right': return [Math.max(0, 95 - w), cy, w, h];
    case 'custom': return [Number(l.x) || 0, Number(l.y) || 0, w, h];
    default: return [cx, cy, w, h];
  }
}

const JUSTIFY: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
const itemsOf = (v: unknown): ResolvedItem[] => (Array.isArray(v) ? (v as ResolvedItem[]) : []);

function renderLayer(l: ResolvedItem, ctx: ComponentRenderCtx, asset: (id: string) => string, n: number): string {
  const [x, y, w, h] = layerBox(l).map((v) => round(v, 2));
  const style = `left:${x}%;top:${y}%;width:${w}%;height:${h}%;` +
    `--d:${round(Math.max(0, Number(l.delay)), 2)}s;--t:${round(Math.max(0.05, Number(l.duration)), 2)}s`;
  let content: string;
  if (l.kind === 'text') {
    const al = String(l.align);
    const ts = `font-family:${fontStack(String(l.fontFamily))};font-size:${round((ctx.height * Number(l.fontSize)) / 100, 1)}px;` +
      `font-weight:${Number(l.fontWeight) || 700};color:${safeColor(String(l.color), '#111')};text-align:${al};justify-content:${JUSTIFY[al] ?? 'center'}`;
    content = `<div class="bcs-t" style="${escapeHtml(ts)}"><span>${escapeText(String(l.text))}</span></div>`;
  } else {
    const id = String(l.image);
    content = id
      ? `<img src="${escapeHtml(asset(id))}" alt="" draggable="false" style="object-fit:${l.fit === 'cover' ? 'cover' : 'contain'}">`
      : faceContent(undefined, 'contain', n, 'Image');
  }
  return `<div class="bcs-l" data-fx="${escapeHtml(String(l.effect))}" style="${escapeHtml(style)}">${content}</div>`;
}

function placeSlide(tr: string, o: number, d: number): { t: string; op: number; z: number } {
  if (tr === 'cube') return { t: `translateZ(${-d}px) rotateY(${round(o * 90, 3)}deg) translateZ(${d}px)`, op: Math.abs(o) < 1 ? 1 : 0, z: 1 };
  if (tr === 'slide') return { t: `translateX(${round(o * 100, 3)}%)`, op: 1, z: Math.abs(o) < 0.5 ? 2 : 1 };
  return { t: 'none', op: Math.abs(o) < 0.5 ? 1 : 0, z: Math.abs(o) < 0.5 ? 2 : 1 };
}

function output(p: ResolvedProps, ctx: ComponentRenderCtx, backup: boolean) {
  const asset = ctx.asset ?? ((id: string) => id);
  const slides = itemsOf(p.slides);
  const n = slides.length;
  const tr = String(p.transition);
  const loopOn = p.loop === true && n > 2;
  const show = backup ? 0 : clamp(Math.round(Number(p.editSlide)) - 1, 0, Math.max(0, n - 1));
  const d = round(ctx.width / 2);

  const html = slides.map((s, i) => {
    const q = placeSlide(tr, offsetOf(i, show, n, loopOn, 0), d);
    const t = backup && tr === 'cube' && q.op > 0 ? 'none' : q.t;
    const bgId = String(s.bgImage ?? '');
    const bg = bgId
      ? `<img class="bcs-bg" src="${escapeHtml(asset(bgId))}" alt="" draggable="false" style="object-fit:${s.bgFit === 'contain' ? 'contain' : 'cover'}">`
      : '';
    const layers = itemsOf(s.layers).map((l, j) => renderLayer(l, ctx, asset, i * 4 + j)).join('');
    const st = `transform:${t};opacity:${q.op};z-index:${q.z};background:${safeColor(String(s.bgColor), '#fff')}`;
    return `<div class="bcs-s${i === show ? ' bcs-on' : ''}" data-s="${i}" style="${escapeHtml(st)}">${bg}${layers}</div>`;
  }).join('');

  const nav = p.arrows === true && n > 1
    ? '<button type="button" class="bcs-nav bcs-prev" data-nav="prev" aria-label="Previous">‹</button>' +
      '<button type="button" class="bcs-nav bcs-next" data-nav="next" aria-label="Next">›</button>'
    : '';
  const dots = p.dots === true && n > 1
    ? `<div class="bcs-dots">${slides.map((_, j) => `<i class="bcs-dot${j === show ? ' bcs-cur' : ''}" data-i="${j}"></i>`).join('')}</div>`
    : '';
  const css = rule(`${ctx.sel} .bcs`, {
    perspective: px(round(Math.max(ctx.width, ctx.height) * 2.5)),
    color: safeColor(String(p.navColor), '#111'),
  }) + '\n' + navCss(p, ctx.sel, NAV_BCS);
  return {
    html: `<div class="bcs${backup ? ' bcs-still' : ''}" data-tr="${escapeHtml(tr)}" data-d="${d}"><div class="bcs-track">${html}</div>${nav}${dots}</div>`,
    css,
  };
}

const KEYFRAMES = [
  ['fade', 'opacity:0'], ['slide-left', 'opacity:0;transform:translateX(40%)'], ['slide-right', 'opacity:0;transform:translateX(-40%)'],
  ['slide-up', 'opacity:0;transform:translateY(40%)'], ['slide-down', 'opacity:0;transform:translateY(-40%)'],
  ['zoom', 'opacity:0;transform:scale(.2)'], ['grow', 'transform:scale(.5)'], ['shrink', 'transform:scale(1.5)'],
  ['blur', 'opacity:0;filter:blur(12px)'],
] as const;

const STYLES =
  '.bcs{position:relative;width:100%;height:100%;overflow:hidden}.bcs-track{position:absolute;inset:0;transform-style:preserve-3d}' +
  '.bcs-s{position:absolute;inset:0;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden}' +
  '.bcs-bg{position:absolute;inset:0;width:100%;height:100%}.bcs-l{position:absolute;overflow:hidden}' +
  '.bcs-l img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' +
  '.bcs-t{display:flex;align-items:center;width:100%;height:100%;line-height:1.1;overflow-wrap:break-word}' +
  '.bcs-s:not(.bcs-on) .bcs-l:not([data-fx="none"]){opacity:0}' +
  '.bcs-on .bcs-l{animation-duration:var(--t);animation-delay:var(--d);animation-fill-mode:both;animation-timing-function:cubic-bezier(.22,1,.36,1)}' +
  KEYFRAMES.map(([k, from]) => `@keyframes bcs-${k}{from{${from}}}.bcs-on .bcs-l[data-fx="${k}"]{animation-name:bcs-${k}}`).join('') +
  '.bcs-still .bcs-l{animation:none!important;opacity:1!important}' +
  '@media (prefers-reduced-motion:reduce){.bcs-l{animation:none!important;opacity:1!important}}' +
  '.bcs-nav{position:absolute;top:50%;z-index:300;width:28px;height:28px;margin-top:-14px;padding:0;border:0;border-radius:50%;' +
  'background:rgba(255,255,255,.8);color:inherit;font:700 18px/28px Arial,sans-serif;cursor:pointer}.bcs-prev{left:6px}.bcs-next{right:6px}' +
  '.bcs-dots{position:absolute;left:0;right:0;bottom:6px;z-index:300;display:flex;justify-content:center;gap:6px}' +
  '.bcs-dot{width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.35;cursor:pointer}.bcs-dot.bcs-cur{opacity:1}' +
  THREE_CSS;

const RUNTIME = String.raw`bannr.define('carouselset', function (el, p) {
  var root = el.querySelector('.bcs');
  if (!root) return null;
  var slides = root.querySelectorAll('.bcs-s'), n = slides.length;
  if (!n) return null;
  var dots = root.querySelectorAll('.bcs-dot');
  var tr = root.getAttribute('data-tr') || 'slide', d = Number(root.getAttribute('data-d')) || 150;
  var loop = !!p.loop && n > 2, dur = tr === 'none' ? 0 : Math.max(0.1, Number(p.speed) || 0.6);
  var every = Math.max(1, Number(p.interval) || 4) * 1000;
  var stopAfter = Math.min(30, Math.max(1, Number(p.autoStop) || 15)) * 1000;
  var pos = 0, p0 = 0, w = 1, cur = -1, dragging = false, started = false, idle = 0, t = 0, played = 0;
  var downT = null, last = [], seen = {}, seenN = 0;
  el.style.touchAction = 'pan-y';
  function r(v) { return Math.round(v * 1000) / 1000; }
  function offset(i) { var o = i - pos; return loop ? (((o + n / 2) % n) + n) % n - n / 2 : o; }
  function place(o) {
    var a = Math.abs(o);
    if (tr === 'cube') return ['translateZ(' + (-d) + 'px) rotateY(' + r(o * 90) + 'deg) translateZ(' + d + 'px)', a < 1 ? 1 : 0];
    if (tr === 'slide') return ['translateX(' + r(o * 100) + '%)', 1];
    return ['none', tr === 'fade' ? r(Math.max(0, 1 - a)) : (a < 0.5 ? 1 : 0)];
  }
  function draw(anim) {
    for (var i = 0; i < n; i++) {
      var o = offset(i), q = place(o), s = slides[i].style;
      var jump = last[i] !== undefined && Math.abs(o - last[i]) > n / 2;
      s.transition = anim && dur && !jump ? 'transform ' + dur + 's cubic-bezier(.22,1,.36,1),opacity ' + dur + 's ease' : 'none';
      s.transform = q[0]; s.opacity = String(q[1]); s.zIndex = Math.abs(o) < 0.5 ? '2' : '1';
      last[i] = o;
    }
  }
  function idx() { return ((Math.round(pos) % n) + n) % n; }
  function activate(c, user) {
    if (c === cur) return;
    for (var i = 0; i < n; i++) slides[i].classList.remove('bcs-on');
    void root.offsetWidth;
    slides[c].classList.add('bcs-on');
    for (var k = 0; k < dots.length; k++) { if (k === c) dots[k].classList.add('bcs-cur'); else dots[k].classList.remove('bcs-cur'); }
    if (cur >= 0 && user) bannr.track('slide_change');
    cur = c;
    if (!seen[c]) { seen[c] = 1; seenN++; if (seenN === n) bannr.track('carousel_complete'); }
  }
  function go(k, user) { pos = loop ? k : Math.max(0, Math.min(n - 1, k)); draw(true); activate(idx(), user); }
  function touch() { if (!started) { started = true; bannr.track('interaction_start'); } idle = 4000; t = 0; }
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var lp = bannr.loop(function (dt) {
    if (dragging) return;
    if (idle > 0) { idle -= dt; return; }
    played += dt;
    if (played > stopAfter) { lp.stop(); return; }
    t += dt;
    if (t >= every) { t = 0; var k = Math.round(pos) + 1; go(!loop && k > n - 1 ? 0 : k, false); }
  });
  function down(e) { downT = e.target || null; }
  el.addEventListener('pointerdown', down);
  draw(false);
  activate(0, false);
  if (p.autoAdvance && !bannr.reducedMotion && n > 1) lp.start();
  var off = bannr.gesture(el, {
    start: function () { stopHint(); },
    move: function (g) {
      if (!dragging) { dragging = true; p0 = pos; w = el.offsetWidth || 1; touch(); }
      pos = p0 - g.dx / w;
      if (!loop) pos = Math.max(-0.3, Math.min(n - 0.7, pos));
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
      var nav = b.getAttribute('data-nav'), base = Math.round(pos);
      if (nav) go(base + (nav === 'next' ? 1 : -1), true);
      else go(base + (Number(b.getAttribute('data-i')) || 0) - idx(), true);
      return true;
    }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () { lp.stop(); off(); stopHint(); el.removeEventListener('pointerdown', down); } };
});`;

type Issue = { ruleId: string; level: 'error' | 'warning'; message: string };

export const carouselset: ComponentDefinition = {
  type: 'carouselset',
  version: 1,
  label: 'Carousel Set',
  category: 'carousel',
  description: 'A multi-layer carousel: several images and texts per slide, each with its own entrance effect.',
  icon: '▤',
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 120, height: 90 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [],
  capturesPointer: true,
  emits: ['interaction_start', 'slide_change', 'carousel_complete'],
  weightBudgetKB: 10,
  styles: STYLES,
  render: (p, _s, ctx) => output(p, ctx, false),
  runtime: RUNTIME,
  backupState: (p, _s, ctx) => output(p, ctx, true),
  validate: (p) => {
    const out: Issue[] = [];
    itemsOf(p.slides).forEach((s, i) => {
      itemsOf(s.layers).forEach((l, j) => {
        if (l.kind === 'image' && !String(l.image ?? '')) {
          out.push({ ruleId: 'carouselset-image', level: 'error', message: `Carousel Set: slide ${i + 1}, layer ${j + 1} has no image` });
        }
      });
    });
    return out;
  },
};
