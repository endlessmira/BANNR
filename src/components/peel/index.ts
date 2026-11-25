import { rule, safeColor } from '@/renderer/css';
import { escapeHtml } from '@/renderer/escape';
import { HINT_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/** PEEL: a sticker is peeled back from a corner (CSS clip-path), revealing the content underneath. */
const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Clip paths for what is left of the sticker and for the folded flap, peeled s % from the corner.
 * Worked out for the bottom-right corner, then mirrored. The runtime uses the same formula.
 */
export function peelPolygons(corner: string, s: number): { top: string; flap: string } {
  const right = corner.charAt(1) === 'r';
  const bottom = corner.charAt(0) === 'b';
  const mp = (x: number, y: number): string => `${right ? r2(x) : r2(100 - x)}% ${bottom ? r2(y) : r2(100 - y)}%`;
  return {
    top: `polygon(${[mp(0, 0), mp(100, 0), mp(100, 100 - s), mp(100 - s, 100), mp(0, 100)].join(',')})`,
    flap: `polygon(${[mp(100 - s, 100), mp(100, 100 - s), mp(100 - s, 100 - s)].join(',')})`,
  };
}

const SCHEMA: SettingsSchema = {
  corner: {
    type: 'select', label: 'Peel from', default: 'br',
    options: [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left']],
  },
  autoPeek: { type: 'toggle', label: 'Auto peek', default: true, help: 'Lifts the corner briefly until someone touches it.' },
  peekDelay: { type: 'number', label: 'Peek after', default: 2, min: 0.5, max: 10, step: 0.5, suffix: 's' },
  peekAmount: { type: 'number', label: 'Peek size', default: 15, min: 0, max: 60, suffix: '%' },
  fullAt: {
    type: 'number', label: 'Full peel at', default: 50, min: 10, max: 100, suffix: '%',
    help: 'Peel at least this far and the sticker comes off. Less springs back.',
  },
  backColor: { type: 'color', label: 'Back of the sticker', default: '#f2f2f2' },
  shadow: { type: 'toggle', label: 'Shadow under the flap', default: true },
  fit: { type: 'select', label: 'Image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  backupShows: {
    type: 'select', label: 'Backup image shows', default: 'cover',
    options: [['cover', 'The sticker (with a peeled corner)'], ['under', 'The content underneath']],
  },
  ...HINT_FIELD,
  tapToExit: {
    type: 'toggle', label: 'Tap opens landing page after peeling', default: true,
    help: 'Before that, a drag peels and a tap does nothing.',
  },
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const corner = String(p.corner);
  const fit = String(p.fit);
  const under = `<div class="bpl-u" data-pu="1">${faceContent(slots.under?.[0], fit, 1, 'Underneath')}</div>`;
  const showTop = !backup || p.backupShows === 'cover';
  const g = peelPolygons(corner, Math.max(0, Math.min(60, Number(p.peekAmount))));
  const top = showTop
    ? `<div class="bpl-top" data-pt="1" style="clip-path:${g.top}">${faceContent(slots.sticker?.[0], fit, 0, 'Sticker')}</div>` +
      `<div class="bpl-fw"><div class="bpl-flap" style="clip-path:${g.flap}"></div></div>`
    : '';
  const ox = corner.charAt(1) === 'r' ? '-45%' : '45%';
  const oy = corner.charAt(0) === 'b' ? '-45%' : '45%';
  const css = [
    rule(`${ctx.sel} .bpl-flap`, {
      background: `linear-gradient(135deg,rgba(0,0,0,0.12),rgba(255,255,255,0.35)),${safeColor(String(p.backColor), '#f2f2f2')}`,
    }),
    rule(`${ctx.sel} .bpl-fw`, { filter: p.shadow === true ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' : 'none' }),
  ].join('\n');
  return { html: `<div class="bpl" data-corner="${escapeHtml(corner)}" style="--ox:${ox};--oy:${oy}">${under}${top}</div>`, css };
}

const RUNTIME = String.raw`bannr.define('peel', function (el, p) {
  var root = el.querySelector('.bpl'), top = el.querySelector('.bpl-top'), flap = el.querySelector('.bpl-flap');
  if (!root || !top || !flap) return null;
  var cn = root.getAttribute('data-corner') || 'br', right = cn.charAt(1) === 'r', bottom = cn.charAt(0) === 'b';
  var s = 0, s0 = 0, done = false, started = false, touched = false, dragging = false, t = 0, phase = 0;
  var full = Math.max(5, Math.min(100, Number(p.fullAt) || 50)), peek = Math.max(0, Math.min(60, Number(p.peekAmount) || 15));
  var wait = Math.max(0.5, Number(p.peekDelay) || 2) * 1000;
  el.style.touchAction = 'none';
  function r(v) { return Math.round(v * 100) / 100; }
  function mp(x, y) { return (right ? r(x) : r(100 - x)) + '% ' + (bottom ? r(y) : r(100 - y)) + '%'; }
  function apply(anim) {
    var tr = anim ? 'clip-path .45s cubic-bezier(.22,1,.36,1)' : 'none';
    top.style.transition = tr; flap.style.transition = tr;
    top.style.clipPath = 'polygon(' + [mp(0, 0), mp(100, 0), mp(100, 100 - s), mp(100 - s, 100), mp(0, 100)].join(',') + ')';
    flap.style.clipPath = 'polygon(' + [mp(100 - s, 100), mp(100, 100 - s), mp(100 - s, 100 - s)].join(',') + ')';
  }
  function off() {
    done = true;
    top.style.transition = 'opacity .5s ease,transform .5s ease';
    root.classList.add('bpl-off');
    el.style.touchAction = 'pan-y';
    bannr.track('peel_complete');
  }
  var lp = bannr.loop(function (dt) {
    if (touched) { lp.stop(); return; }
    t += dt;
    if (phase === 0 && t >= wait) { phase = 1; s = peek; apply(true); }
    else if (phase === 1 && t >= wait + 900) { phase = 2; s = 0; apply(true); lp.stop(); }
  });
  apply(false);
  if (p.autoPeek && !bannr.reducedMotion) lp.start();
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var ungesture = bannr.gesture(el, {
    start: function () { stopHint(); touched = true; },
    move: function (g) {
      if (done) return;
      if (!dragging) { dragging = true; s0 = s; if (!started) { started = true; bannr.track('interaction_start'); } }
      var w = el.offsetWidth || 1, h = el.offsetHeight || 1, dxp = g.dx / w * 100, dyp = g.dy / h * 100;
      s = Math.max(0, Math.min(100, s0 + ((right ? -dxp : dxp) + (bottom ? -dyp : dyp)) / 2));
      apply(false);
    },
    end: function () {
      if (!dragging) return;
      dragging = false;
      if (done) return;
      if (s >= full) off(); else { s = 0; apply(true); }
    },
    tap: function () { return !done; }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () { lp.stop(); ungesture(); stopHint(); } };
});`;

export const peel: ComponentDefinition = {
  type: 'peel',
  version: 1,
  label: 'Peel',
  category: 'reveal',
  description: 'Peel a sticker off from a corner to reveal what is underneath.',
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
  weightBudgetKB: 6,
  styles:
    '.bpl{position:relative;width:100%;height:100%;overflow:hidden}' +
    '.bpl-u,.bpl-top,.bpl-fw,.bpl-flap{position:absolute;inset:0}' +
    '.bpl img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' +
    '.bpl-fw{pointer-events:none;transition:opacity .5s ease,transform .5s ease}' +
    '.bpl-off .bpl-top,.bpl-off .bpl-fw{opacity:0;transform:translate(var(--ox),var(--oy));pointer-events:none}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
