import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeHtml } from '@/renderer/escape';
import { NAV_FIELDS, type NavNames, navCss } from '../nav';
import { HINT_FIELD, TAP_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/** PANORAMA SCROLLER: one wide image, or a strip of several images, dragged sideways. */
export const NAV_BPN: NavNames = { pre: 'bpn', on: 'bpn-on' };

/** The carousel arrow settings, without the dots (a panorama has no slides). */
const ARROW_FIELDS: SettingsSchema = Object.fromEntries(Object.entries(NAV_FIELDS).filter(([k]) => !k.startsWith('dot')));

const SCHEMA: SettingsSchema = {
  autoPan: { type: 'toggle', label: 'Auto-pan when idle', default: true },
  panSpeed: { type: 'slider', label: 'Pan speed', default: 30, min: 5, max: 120, step: 5, suffix: 'px/s' },
  autoStop: {
    type: 'number', label: 'Auto-pan stops after', default: 15, min: 3, max: 30, suffix: 's',
    help: 'Keeps the banner within the animation limit (30 s by default).',
  },
  startAt: { type: 'select', label: 'Start at', default: 'left', options: [['left', 'Left end'], ['center', 'Centre']] },
  itemWidth: {
    type: 'slider', label: 'Image width', default: 40, min: 15, max: 100, step: 1, suffix: '%',
    help: 'For several images: the width of each image, in % of the banner width.',
  },
  gap: { type: 'number', label: 'Gap', default: 8, min: 0, max: 60, suffix: 'px' },
  fit: { type: 'select', label: 'Image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  bgColor: { type: 'color', label: 'Background colour', default: 'transparent' },
  edgeFade: { type: 'toggle', label: 'Fade the edges', default: true, help: 'A soft shadow at both edges shows there is more to see.' },
  ...ARROW_FIELDS,
  ...HINT_FIELD,
  ...TAP_FIELD,
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx) {
  const imgs = (slots.images ?? []).filter((s) => s.kind === 'image');
  const gap = Number(p.gap);
  const w = round((ctx.width * Number(p.itemWidth)) / 100);
  const first = imgs[0];
  let items: string;
  let startX = 0;
  if (imgs.length === 1 && first && first.kind === 'image') {
    items = `<img class="bpn-wide" src="${escapeHtml(first.src)}" alt="" draggable="false">`;
  } else {
    const n = imgs.length > 1 ? imgs.length : 5;
    items = Array.from({ length: n }, (_, i) =>
      `<div class="bpn-i" data-p="${i}" style="width:${w}px">${faceContent(imgs[i], String(p.fit), i, String(i + 1))}</div>`).join('');
    if (p.startAt === 'center') startX = round(Math.min(0, (ctx.width - (n * w + (n - 1) * gap)) / 2));
  }
  const fade = p.edgeFade === true ? '<div class="bpn-fade bpn-fl"></div><div class="bpn-fade bpn-fr"></div>' : '';
  const nav = p.arrows === true
    ? '<button type="button" class="bpn-nav bpn-prev" data-nav="prev" aria-label="Previous"></button>' +
      '<button type="button" class="bpn-nav bpn-next" data-nav="next" aria-label="Next"></button>'
    : '';
  const css = [
    rule(`${ctx.sel} .bpn`, { background: safeColor(String(p.bgColor)) }),
    rule(`${ctx.sel} .bpn-track`, { gap: px(gap) }),
    navCss(p, ctx.sel, NAV_BPN),
  ].filter(Boolean).join('\n');
  return {
    html: `<div class="bpn" data-start="${escapeHtml(String(p.startAt))}">` +
      `<div class="bpn-track" style="transform:translateX(${startX}px)">${items}</div>${fade}${nav}</div>`,
    css,
  };
}

const RUNTIME = String.raw`bannr.define('panorama', function (el, p) {
  var root = el.querySelector('.bpn'), track = el.querySelector('.bpn-track');
  if (!root || !track) return null;
  var x = 0, x0 = 0, vel = 0, dir = -1, dragging = false, started = false, ended = false, idle = 0, auto = 0, downT = null;
  var spd = Math.max(1, Number(p.panSpeed) || 30) / 1000;
  var stopAfter = Math.min(30, Math.max(1, Number(p.autoStop) || 15)) * 1000;
  var autoOn = !!p.autoPan && !bannr.reducedMotion, center = root.getAttribute('data-start') === 'center';
  el.style.touchAction = 'pan-y';
  function minX() { return Math.min(0, (el.offsetWidth || 0) - (track.scrollWidth || track.offsetWidth || 0)); }
  function clamp(v) { return Math.max(minX(), Math.min(0, v)); }
  function apply(anim) {
    track.style.transition = anim ? 'transform .45s cubic-bezier(.22,1,.36,1)' : 'none';
    track.style.transform = 'translateX(' + Math.round(x) + 'px)';
  }
  function atEnd() { var m = minX(); if (!ended && m < 0 && x <= m + 1) { ended = true; bannr.track('panorama_end'); } }
  function first() { if (!started) { started = true; bannr.track('interaction_start'); } }
  function relayout() { if (started) return; x = center ? minX() / 2 : clamp(x); apply(false); }
  var imgs = track.querySelectorAll ? track.querySelectorAll('img') : [];
  for (var i = 0; i < imgs.length; i++) imgs[i].addEventListener('load', relayout);
  relayout();
  var lp = bannr.loop(function (dt) {
    if (dragging) return;
    if (vel !== 0) {
      x = clamp(x + vel * dt); vel *= Math.pow(0.994, dt);
      if (Math.abs(vel) < 0.01 || x === 0 || x === minX()) { vel = 0; atEnd(); }
      apply(false); return;
    }
    if (idle > 0) { idle -= dt; return; }
    if (autoOn && auto < stopAfter) {
      auto += dt;
      var m = minX();
      if (m < 0) {
        x += dir * spd * dt;
        if (x <= m) { x = m; dir = 1; } else if (x >= 0) { x = 0; dir = -1; }
        apply(false);
      }
      return;
    }
    lp.stop();
  });
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  function down(e) { downT = e.target || null; }
  el.addEventListener('pointerdown', down);
  if (autoOn) lp.start();
  var off = bannr.gesture(el, {
    start: function () { stopHint(); vel = 0; },
    move: function (g) {
      if (!dragging) { dragging = true; x0 = x; first(); }
      var m = minX(), v = x0 + g.dx;
      if (v > 0) v = v * 0.3; else if (v < m) v = m + (v - m) * 0.3;
      x = v; apply(false);
    },
    end: function (g) {
      dragging = false; idle = 4000;
      x = clamp(x);
      vel = Math.max(-2, Math.min(2, g.vx || 0));
      if (Math.abs(vel) < 0.05) { vel = 0; apply(true); } else apply(false);
      atEnd();
      lp.start();
    },
    tap: function () {
      var b = downT && downT.closest ? downT.closest('[data-nav]') : null;
      if (!b) return false;
      first(); idle = 4000; vel = 0;
      var step = (el.offsetWidth || 300) * 0.6;
      x = clamp(x + (b.getAttribute('data-nav') === 'next' ? -step : step));
      apply(true); atEnd(); lp.start();
      return true;
    }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () {
    lp.stop(); off(); stopHint(); el.removeEventListener('pointerdown', down);
    for (var j = 0; j < imgs.length; j++) imgs[j].removeEventListener('load', relayout);
  } };
});`;

export const panorama: ComponentDefinition = {
  type: 'panorama',
  version: 1,
  label: 'Panorama Scroller',
  category: 'carousel',
  description: 'Drag a wide image or a product strip sideways. Pans slowly on its own when idle.',
  icon: '⇔',
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 120, height: 60 },
  recommendedSizes: ['970x250', '480x300', '300x250', '480x480'],
  settingsSchema: SCHEMA,
  slots: [{ name: 'images', label: 'Images (one wide image, or several products)', kind: 'image', required: true, min: 1, max: 8 }],
  capturesPointer: true,
  emits: ['interaction_start', 'panorama_end'],
  weightBudgetKB: 8,
  styles:
    '.bpn{position:relative;width:100%;height:100%;overflow:hidden}' +
    '.bpn-track{position:absolute;left:0;top:0;height:100%;display:flex;width:max-content;will-change:transform}' +
    '.bpn-i{flex:none;height:100%;overflow:hidden}' +
    '.bpn img{display:block;height:100%;-webkit-user-drag:none;user-select:none}.bpn-i img{width:100%}' +
    '.bpn-wide{width:auto;max-width:none}' +
    '.bpn-fade{position:absolute;top:0;bottom:0;width:12%;z-index:100;pointer-events:none}' +
    '.bpn-fl{left:0;background:linear-gradient(90deg,rgba(0,0,0,.25),transparent)}' +
    '.bpn-fr{right:0;background:linear-gradient(270deg,rgba(0,0,0,.25),transparent)}' +
    '.bpn-nav{position:absolute;z-index:300;cursor:pointer;border:0;padding:0}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx),
};
