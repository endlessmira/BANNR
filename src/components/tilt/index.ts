import { px, round, rule } from '@/renderer/css';
import { HINT_FIELD, TAP_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

const SCHEMA: SettingsSchema = {
  idleMotion: {
    type: 'select', label: 'Idle motion', default: 'sway',
    options: [['none', 'None'], ['sway', 'Gentle sway'], ['rock', 'Rock side to side']],
    help: 'Moves on its own until someone touches it.',
  },
  maxTilt: { type: 'slider', label: 'Max tilt', default: 12, min: 2, max: 30, step: 1, suffix: '°' },
  layerDepth: {
    type: 'slider', label: 'Layer depth', default: 60, min: 0, max: 200, step: 5, suffix: 'px',
    help: 'How far the top layer floats above the background. More depth = stronger parallax.',
  },
  autoStop: {
    type: 'number', label: 'Idle motion stops after', default: 10, min: 3, max: 30, suffix: 's',
    help: 'Keeps the banner within the animation limit (30 s by default).',
  },
  deviceTilt: {
    type: 'toggle', label: 'Follow phone tilt', default: false,
    help: 'On phones that allow it, the card follows how the phone is held. iPhones ask for permission, so there it usually stays off.',
  },
  fit: { type: 'select', label: 'Background fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  ...HINT_FIELD,
  ...TAP_FIELD,
};

/**
 * Layers sit at increasing depth (translateZ). Each is scaled back by (P - z) / P, so at rest the card
 * looks exactly like the flat design; when it tilts, the layers shift against each other (parallax).
 * The backup is flat (no 3D).
 */
function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const imgs = (slots.layers ?? []).filter((s) => s.kind === 'image');
  const n = imgs.length > 0 ? imgs.length : 3;
  const P = round(Math.max(ctx.width, ctx.height) * 3);
  const depth = Number(p.layerDepth);
  const layers: string[] = [];
  for (let i = 0; i < n; i++) {
    const z = n > 1 ? round((i / (n - 1)) * depth) : 0;
    const style = [
      !backup && z ? `transform:translateZ(${z}px) scale(${round((P - z) / P, 4)})` : '',
      imgs.length === 0 && i > 0 ? `inset:${i * 18}%` : '',
    ].filter(Boolean).join(';');
    const content = faceContent(imgs[i], i === 0 ? String(p.fit) : 'contain', i, i === 0 ? 'Background' : `Layer ${i + 1}`);
    layers.push(`<div class="bct-l"${style ? ` style="${style}"` : ''}>${content}</div>`);
  }
  return {
    html: `<div class="bct"><div class="bct-card">${layers.join('')}</div></div>`,
    css: rule(`${ctx.sel} .bct`, { perspective: px(P) }),
  };
}

const RUNTIME = String.raw`bannr.define('tilt', function (el, p) {
  var root = el.querySelector('.bct'), card = el.querySelector('.bct-card');
  if (!root || !card) return null;
  var max = Math.max(0, Number(p.maxTilt) || 12), mode = bannr.reducedMotion ? 'none' : String(p.idleMotion || 'none');
  var stopAfter = Math.min(30, Math.max(1, Number(p.autoStop) || 10)) * 1000;
  var tx = 0, ty = 0, cx = 0, cy = 0, t = 0, active = false, touched = false, started = false;
  el.style.touchAction = 'pan-y';
  function clamp(v) { return Math.max(-1, Math.min(1, v)); }
  var lp = bannr.loop(function (dt) {
    if (!touched && mode !== 'none' && t < stopAfter) {
      t += dt;
      var k = t / 1000;
      if (mode === 'rock') { ty = Math.sin(k * 2.4) * max; tx = Math.sin(k * 1.2) * max * 0.15; }
      else { ty = Math.sin(k * 0.9) * max * 0.5; tx = Math.cos(k * 0.7) * max * 0.35; }
      if (t >= stopAfter) { tx = 0; ty = 0; }
    }
    var f = Math.min(1, dt / 90);
    cx += (tx - cx) * f; cy += (ty - cy) * f;
    card.style.transform = 'rotateX(' + cx.toFixed(2) + 'deg) rotateY(' + cy.toFixed(2) + 'deg)';
    var idleDone = touched || mode === 'none' || t >= stopAfter;
    if (idleDone && Math.abs(cx - tx) + Math.abs(cy - ty) < 0.02) lp.stop();
  });
  function aim(e) {
    var r = el.getBoundingClientRect(), w = r.width || 1, h = r.height || 1;
    tx = -clamp(((e.clientY - r.top) / h) * 2 - 1) * max;
    ty = clamp(((e.clientX - r.left) / w) * 2 - 1) * max;
    active = true; touched = true;
    if (!started) { started = true; bannr.track('interaction_start'); }
    lp.start();
  }
  function rest() { active = false; tx = 0; ty = 0; lp.start(); }
  function hover(e) { if (e.pointerType === 'mouse') aim(e); }
  function leave(e) { if (e.pointerType === 'mouse') rest(); }
  function orient(e) {
    if (active || e.gamma == null || e.beta == null) return;
    tx = -clamp((e.beta - 45) / 45) * max; ty = clamp(e.gamma / 45) * max; touched = true; lp.start();
  }
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  el.addEventListener('pointermove', hover);
  el.addEventListener('pointerleave', leave);
  if (p.deviceTilt && window.DeviceOrientationEvent) window.addEventListener('deviceorientation', orient);
  var off = bannr.gesture(el, {
    start: function () { stopHint(); },
    move: function (g) { aim(g.event); },
    end: function () { rest(); }
  }, { tapToExit: p.tapToExit !== false });
  if (mode !== 'none') lp.start();
  return { destroy: function () {
    lp.stop(); off(); stopHint();
    el.removeEventListener('pointermove', hover);
    el.removeEventListener('pointerleave', leave);
    if (window.removeEventListener) window.removeEventListener('deviceorientation', orient);
  } };
});`;

export const tilt: ComponentDefinition = {
  type: 'tilt',
  version: 1,
  label: 'Tilt Card',
  category: '3d',
  description: 'Layered images tilt in 3D, following the mouse or finger, with parallax depth.',
  icon: '⧉',
  presets: [
    { id: 'depth', label: 'Depth Card', description: 'Deep layers with a gentle sway.', props: { idleMotion: 'sway', maxTilt: 12, layerDepth: 80 } },
    { id: 'rocker', label: 'Rocker', description: 'Rocks side to side on its own.', props: { idleMotion: 'rock', maxTilt: 22, layerDepth: 30 } },
  ],
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 80, height: 80 },
  recommendedSizes: ['480x480', '300x250', '300x600', '320x480'],
  settingsSchema: SCHEMA,
  slots: [{ name: 'layers', label: 'Layers (background first)', kind: 'image', required: true, min: 1, max: 4 }],
  capturesPointer: true,
  emits: ['interaction_start'],
  weightBudgetKB: 6,
  styles:
    '.bct{position:relative;width:100%;height:100%;overflow:hidden}' +
    '.bct-card{position:absolute;inset:0;transform-style:preserve-3d;will-change:transform}' +
    '.bct-l{position:absolute;inset:0;overflow:hidden}.bct-l:first-child{inset:-6%}' +
    '.bct img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
