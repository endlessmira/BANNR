import { px, round, rule } from '@/renderer/css';
import { HINT_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

const SCHEMA: SettingsSchema = {
  style: { type: 'select', label: 'Style', default: 'single', options: [['single', 'Flip (one card)'], ['parallax', 'Flip Parallax (two halves)']] },
  direction: { type: 'select', label: 'Flips', default: 'h', options: [['h', 'Sideways'], ['v', 'Up and down']] },
  speed: { type: 'slider', label: 'Flip duration', default: 0.7, min: 0.2, max: 2, step: 0.1, suffix: 's' },
  exitOnBack: {
    type: 'toggle', label: 'Tap on the back opens landing page', default: true,
    help: 'A tap on the front always flips the card. A drag never opens the landing page.',
  },
  autoPeek: { type: 'toggle', label: 'Auto peek', default: true, help: 'If nobody has touched it yet, it flips to the back once and returns.' },
  peekDelay: { type: 'number', label: 'Peek after', default: 3, min: 1, max: 10, step: 0.5, suffix: 's' },
  fit: { type: 'select', label: 'Image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  ...HINT_FIELD,
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const fit = String(p.fit);
  const front = faceContent(slots.front?.[0], fit, 0, 'Front');
  const back = faceContent(slots.back?.[0], fit, 1, 'Back');
  const css = rule(`${ctx.sel} .bcf,${ctx.sel} .bcf-half`, { perspective: px(round(Math.max(ctx.width, ctx.height) * 3)) });
  const dir = p.direction === 'v' ? 'v' : 'h';
  if (backup) return { html: `<div class="bcf" data-dir="${dir}"><div class="bcf-s">${front}</div></div>`, css };
  const card = (f: string, b: string): string =>
    `<div class="bcf-card"><div class="bcf-s">${f}</div><div class="bcf-s bcf-b">${b}</div></div>`;
  const html = p.style === 'parallax'
    ? `<div class="bcf bcf-par" data-dir="${dir}">` +
      ['', ' bcf-lo'].map((c) => `<div class="bcf-half${c}">${card(`<div class="bcf-in">${front}</div>`, `<div class="bcf-in">${back}</div>`)}</div>`).join('') +
      '</div>'
    : `<div class="bcf" data-dir="${dir}">${card(front, back)}</div>`;
  return { html, css };
}

const RUNTIME = String.raw`bannr.define('flip', function (el, p) {
  var root = el.querySelector('.bcf');
  if (!root) return null;
  var cards = root.querySelectorAll('.bcf-card');
  if (!cards.length) return null;
  var v = root.getAttribute('data-dir') === 'v', stag = cards.length > 1 ? 0.15 : 0;
  var dur = Math.max(0.1, Number(p.speed) || 0.7), ang = 0, a0 = 0, was = false, size = 1;
  var dragging = false, started = false, touched = false, peekT = 0, peek = 0;
  var wait = Math.max(1, Number(p.peekDelay) || 3) * 1000;
  el.style.touchAction = v ? 'pan-x' : 'pan-y';
  function apply(anim) {
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.transition = anim ? 'transform ' + dur + 's cubic-bezier(.22,1,.36,1) ' + (i * stag) + 's' : 'none';
      cards[i].style.transform = v ? 'rotateX(' + (-ang) + 'deg)' : 'rotateY(' + ang + 'deg)';
    }
  }
  function flipped() { return Math.round(ang / 180) % 2 !== 0; }
  function to(k, before, quiet) {
    ang = k * 180;
    apply(true);
    if (!quiet && flipped() !== before) bannr.track('flip');
  }
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  function first() {
    touched = true;
    stopHint();
    if (!started) { started = true; bannr.track('interaction_start'); }
  }
  var lp = bannr.loop(function (dt) {
    if (touched) { lp.stop(); return; }
    peekT += dt;
    if (peek === 0 && peekT >= wait) { peek = 1; to(1, false, true); }
    else if (peek === 1 && peekT >= wait + 1500) { peek = 2; to(0, true, true); lp.stop(); }
  });
  if (p.autoPeek && !bannr.reducedMotion) lp.start();
  var off = bannr.gesture(el, {
    start: first,
    move: function (g) {
      if (!dragging) { dragging = true; a0 = ang; was = flipped(); size = (v ? el.offsetHeight : el.offsetWidth) || 1; }
      ang = a0 + ((v ? g.dy : g.dx) / size) * 180;
      apply(false);
    },
    end: function (g) {
      dragging = false;
      var k = ang / 180, vel = v ? g.vy : g.vx;
      to(vel > 0.3 ? Math.ceil(k) : vel < -0.3 ? Math.floor(k) : Math.round(k), was, false);
    },
    tap: function () {
      if (flipped() && p.exitOnBack) return false;
      to(Math.round(ang / 180) + 1, flipped(), false);
      return true;
    }
  }, { tapToExit: true });
  return { destroy: function () { lp.stop(); off(); stopHint(); } };
});`;

export const flip: ComponentDefinition = {
  type: 'flip',
  version: 1,
  label: 'Flip Card',
  category: '3d',
  description: 'Tap or drag to flip between a front and a back creative.',
  icon: '⟲',
  presets: [{ id: 'parallax', label: 'Flip Parallax', description: 'The top and bottom halves flip one after the other.', props: { style: 'parallax' } }],
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 80, height: 80 },
  recommendedSizes: ['480x480', '300x250', '300x600', '320x480'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'front', label: 'Front', kind: 'image', required: true, max: 1 },
    { name: 'back', label: 'Back', kind: 'image', required: true, max: 1 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'flip'],
  weightBudgetKB: 6,
  styles:
    '.bcf{position:relative;width:100%;height:100%}.bcf-half{position:relative;height:50%}' +
    '.bcf-card{position:relative;width:100%;height:100%;transform-style:preserve-3d}' +
    '.bcf-s{position:absolute;inset:0;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden}' +
    '.bcf-b{transform:rotateY(180deg)}.bcf[data-dir="v"] .bcf-b{transform:rotateX(180deg)}' +
    '.bcf-in{position:absolute;left:0;top:0;width:100%;height:200%}.bcf-lo .bcf-in{top:-100%}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
