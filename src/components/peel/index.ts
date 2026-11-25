import { rule, safeColor } from '@/renderer/css';
import { escapeHtml } from '@/renderer/escape';
import { HINT_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/**
 * PEEL: a sticker peeled back from a corner. The corner is always slightly curled.
 * 3D look: the flap is shaded like a curling page (crease, highlight, soft shade) and casts a shadow
 * on the content just past the fold. Flap and shadow are boxes of s% × s% in the corner, so their
 * gradients always follow the fold line. The runtime uses the same geometry.
 */
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** What is left of the sticker, peeled s % from the corner (bottom-right maths, mirrored). */
export function peelTop(corner: string, s: number): string {
  const right = corner.charAt(1) === 'r';
  const bottom = corner.charAt(0) === 'b';
  const mp = (x: number, y: number): string => `${right ? r2(x) : r2(100 - x)}% ${bottom ? r2(y) : r2(100 - y)}%`;
  return `polygon(${[mp(0, 0), mp(100, 0), mp(100, 100 - s), mp(100 - s, 100), mp(0, 100)].join(',')})`;
}

interface CornerGeo { pos: string; clip: string; dir: string; shClip: string; shDir: string }
/** Per corner: position, flap triangle, flap shading direction, shadow triangle, shadow direction. */
export const CORNERS: Readonly<Record<string, CornerGeo>> = {
  br: { pos: 'right:0;bottom:0', clip: 'polygon(0 0,100% 0,0 100%)', dir: 'to top left', shClip: 'polygon(100% 0,100% 100%,0 100%)', shDir: 'to bottom right' },
  bl: { pos: 'left:0;bottom:0', clip: 'polygon(0 0,100% 0,100% 100%)', dir: 'to top right', shClip: 'polygon(0 0,0 100%,100% 100%)', shDir: 'to bottom left' },
  tr: { pos: 'right:0;top:0', clip: 'polygon(0 0,0 100%,100% 100%)', dir: 'to bottom left', shClip: 'polygon(0 0,100% 0,100% 100%)', shDir: 'to top right' },
  tl: { pos: 'left:0;top:0', clip: 'polygon(100% 0,100% 100%,0 100%)', dir: 'to bottom right', shClip: 'polygon(0 0,100% 0,0 100%)', shDir: 'to top left' },
};

const AUTO = { key: 'autoPeek', is: ['true'] } as const;

const SCHEMA: SettingsSchema = {
  corner: {
    type: 'select', label: 'Peel from', default: 'br',
    options: [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left']],
  },
  restCurl: {
    type: 'number', label: 'Corner always visible', default: 10, min: 0, max: 30, suffix: '%',
    help: 'How much of the corner stays curled all the time. 0 = hidden until it peeks.',
  },
  peekAmount: { type: 'number', label: 'Peek size', default: 25, min: 5, max: 60, suffix: '%', help: 'How far the corner lifts when it peeks or on hover.' },
  autoPeek: { type: 'toggle', label: 'Auto peek', default: true, help: 'Peels a bit and springs back, repeatedly, until someone touches it.' },
  peekDelay: { type: 'number', label: 'Peek first after', default: 1.5, min: 0.5, max: 10, step: 0.5, suffix: 's', when: AUTO },
  peekEvery: { type: 'number', label: 'Repeat every', default: 4, min: 2, max: 15, step: 0.5, suffix: 's', when: AUTO },
  autoStop: {
    type: 'number', label: 'Auto peek stops after', default: 15, min: 3, max: 30, suffix: 's', when: AUTO,
    help: 'Keeps the banner within the animation limit (30 s by default).',
  },
  hoverPeek: { type: 'toggle', label: 'Lift on mouse hover', default: true, help: 'With a mouse, the corner lifts while the pointer is over the banner.' },
  fullAt: {
    type: 'number', label: 'Full peel at', default: 50, min: 10, max: 100, suffix: '%',
    help: 'Peel at least this far and the sticker comes off. Less springs back.',
  },
  backColor: { type: 'color', label: 'Back of the sticker', default: '#f2f2f2' },
  shading: { type: 'slider', label: 'Curl shading', default: 60, min: 0, max: 100, step: 5, suffix: '%', help: 'How strong the 3D curl and its shadow look.' },
  shadow: { type: 'toggle', label: 'Shadow under the flap', default: true },
  fit: { type: 'select', label: 'Image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  backupShows: {
    type: 'select', label: 'Backup image shows', default: 'cover',
    options: [['cover', 'The sticker (with the curled corner)'], ['under', 'The content underneath']],
  },
  ...HINT_FIELD,
  tapToExit: {
    type: 'toggle', label: 'Tap opens landing page after peeling', default: true,
    help: 'Before that, a drag peels and a tap does nothing.',
  },
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const corner = CORNERS[String(p.corner)] ? String(p.corner) : 'br';
  const geo = CORNERS[corner]!;
  const fit = String(p.fit);
  const rest = r2(Math.max(0, Math.min(30, Number(p.restCurl))));
  const box = `width:${rest}%;height:${rest}%`;
  const under = `<div class="bpl-u" data-pu="1">${faceContent(slots.under?.[0], fit, 1, 'Underneath')}</div>`;
  const showTop = !backup || p.backupShows === 'cover';
  const top = showTop
    ? `<div class="bpl-sh" data-sh="1" style="${box}"></div>` +
      `<div class="bpl-top" data-pt="1" style="clip-path:${peelTop(corner, rest)}">${faceContent(slots.sticker?.[0], fit, 0, 'Sticker')}</div>` +
      `<div class="bpl-fw"><div class="bpl-fl" data-fl="1" style="${box}"></div></div>`
    : '';
  const k = Math.max(0, Math.min(100, Number(p.shading))) / 100;
  const a = (v: number): number => r2(v * k);
  const css = [
    rule(`${ctx.sel} .bpl-fl`, {
      background: `linear-gradient(${geo.dir},rgba(0,0,0,${a(0.4)}) 50%,rgba(255,255,255,${a(0.65)}) 57%,` +
        `rgba(255,255,255,0) 78%,rgba(0,0,0,${a(0.2)}) 100%),${safeColor(String(p.backColor), '#f2f2f2')}`,
    }),
    rule(`${ctx.sel} .bpl-sh`, { background: `linear-gradient(${geo.shDir},rgba(0,0,0,${a(0.55)}) 50%,rgba(0,0,0,0) 80%)` }),
    rule(`${ctx.sel} .bpl-fw`, { filter: p.shadow === true ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' : 'none' }),
  ].join('\n');
  const ox = corner.charAt(1) === 'r' ? '-45%' : '45%';
  const oy = corner.charAt(0) === 'b' ? '-45%' : '45%';
  return { html: `<div class="bpl" data-corner="${escapeHtml(corner)}" style="--ox:${ox};--oy:${oy}">${under}${top}</div>`, css };
}

const RUNTIME = String.raw`bannr.define('peel', function (el, p) {
  var root = el.querySelector('.bpl'), top = el.querySelector('.bpl-top'), fl = el.querySelector('.bpl-fl'), sh = el.querySelector('.bpl-sh');
  if (!root || !top || !fl) return null;
  var cn = root.getAttribute('data-corner') || 'br', right = cn.charAt(1) === 'r', bottom = cn.charAt(0) === 'b';
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  var rest = Math.max(0, Math.min(30, num(p.restCurl, 10)));
  var peek = Math.max(rest, Math.min(60, num(p.peekAmount, 25)));
  var full = Math.max(5, Math.min(100, num(p.fullAt, 50)));
  var next = Math.max(0.5, num(p.peekDelay, 1.5)) * 1000, every = Math.max(1, num(p.peekEvery, 4)) * 1000;
  var stopAfter = Math.min(30, Math.max(1, num(p.autoStop, 15))) * 1000;
  var s = rest, s0 = 0, done = false, started = false, touched = false, dragging = false, up = false, t = 0;
  var EASE = ' .5s cubic-bezier(.22,1,.36,1)';
  el.style.touchAction = 'none';
  function r(v) { return Math.round(v * 100) / 100; }
  function mp(x, y) { return (right ? r(x) : r(100 - x)) + '% ' + (bottom ? r(y) : r(100 - y)) + '%'; }
  function box(e, anim) {
    if (!e) return;
    e.style.transition = anim ? 'width' + EASE + ',height' + EASE : 'none';
    e.style.width = r(s) + '%';
    e.style.height = r(s) + '%';
  }
  function apply(anim) {
    top.style.transition = anim ? 'clip-path' + EASE : 'none';
    top.style.clipPath = 'polygon(' + [mp(0, 0), mp(100, 0), mp(100, 100 - s), mp(100 - s, 100), mp(0, 100)].join(',') + ')';
    box(fl, anim);
    box(sh, anim);
  }
  function to(v) { s = v; apply(true); }
  function off() {
    done = true;
    root.classList.add('bpl-off');
    el.style.touchAction = 'pan-y';
    bannr.track('peel_complete');
  }
  var lp = bannr.loop(function (dt) {
    if (touched || done) { lp.stop(); return; }
    t += dt;
    if (up) {
      if (t >= next) { up = false; to(rest); next = t + every; if (t > stopAfter) lp.stop(); }
      return;
    }
    if (t > stopAfter) { lp.stop(); return; }
    if (t >= next) { up = true; to(peek); next = t + 900; }
  });
  apply(false);
  if (p.autoPeek && !bannr.reducedMotion) lp.start();
  function enter(e) { if (e.pointerType !== 'mouse' || done || dragging || !p.hoverPeek) return; touched = true; to(peek); }
  function leave(e) { if (e.pointerType !== 'mouse' || done || dragging || !p.hoverPeek) return; to(rest); }
  el.addEventListener('pointerenter', enter);
  el.addEventListener('pointerleave', leave);
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var ungesture = bannr.gesture(el, {
    start: function () { stopHint(); touched = true; },
    move: function (g) {
      if (done) return;
      if (!dragging) { dragging = true; s0 = s; if (!started) { started = true; bannr.track('interaction_start'); } }
      var w = el.offsetWidth || 1, h = el.offsetHeight || 1, dxp = g.dx / w * 100, dyp = g.dy / h * 100;
      s = Math.max(rest, Math.min(100, s0 + ((right ? -dxp : dxp) + (bottom ? -dyp : dyp)) / 2));
      apply(false);
    },
    end: function () {
      if (!dragging) return;
      dragging = false;
      if (done) return;
      if (s >= full) off(); else to(rest);
    },
    tap: function () { return !done; }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () {
    lp.stop(); ungesture(); stopHint();
    el.removeEventListener('pointerenter', enter);
    el.removeEventListener('pointerleave', leave);
  } };
});`;

const CORNER_CSS = Object.entries(CORNERS)
  .map(([c, g]) => `.bpl[data-corner="${c}"] .bpl-fl{${g.pos};clip-path:${g.clip}}.bpl[data-corner="${c}"] .bpl-sh{${g.pos};clip-path:${g.shClip}}`)
  .join('');

export const peel: ComponentDefinition = {
  type: 'peel',
  version: 1,
  label: 'Peel',
  category: 'reveal',
  description: 'Peel a sticker off from a curled corner to reveal what is underneath.',
  icon: '◩',
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 100, height: 80 },
  recommendedSizes: ['480x480', '300x250', '300x600', '320x480'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'sticker', label: 'Sticker (top)', kind: 'image', required: true, max: 1 },
    { name: 'under', label: 'Underneath', kind: 'image', required: true, max: 1 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'peel_complete'],
  weightBudgetKB: 8,
  styles:
    '.bpl{position:relative;width:100%;height:100%;overflow:hidden}' +
    '.bpl-u,.bpl-top,.bpl-fw{position:absolute;inset:0}' +
    '.bpl img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' +
    '.bpl-fl,.bpl-sh{position:absolute;pointer-events:none}' +
    '.bpl-fw,.bpl-sh{pointer-events:none;transition:opacity .5s ease,transform .5s ease}' +
    '.bpl-off .bpl-top,.bpl-off .bpl-fw,.bpl-off .bpl-sh{opacity:0;transform:translate(var(--ox),var(--oy));pointer-events:none}' +
    CORNER_CSS + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
