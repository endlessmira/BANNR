import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeHtml } from '@/renderer/escape';
import { HINT_FIELD, TAP_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

const SCHEMA: SettingsSchema = {
  style: { type: 'select', label: 'Style', default: 'full', options: [['full', 'Full cube'], ['half', 'Half cube (on a background)']] },
  direction: { type: 'select', label: 'Turns', default: 'h', options: [['h', 'Sideways'], ['v', 'Up and down']] },
  autoRotate: { type: 'toggle', label: 'Auto-rotate', default: true },
  interval: { type: 'slider', label: 'Seconds per face', default: 3, min: 1, max: 10, step: 0.5, suffix: 's' },
  autoStop: {
    type: 'number', label: 'Auto-rotate stops after', default: 15, min: 3, max: 30, suffix: 's',
    help: 'Keeps the banner within the animation limit (30 s by default).',
  },
  speed: { type: 'slider', label: 'Turn duration', default: 0.8, min: 0.2, max: 2, step: 0.1, suffix: 's' },
  fit: { type: 'select', label: 'Image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  cubeScale: { type: 'slider', label: 'Half cube size', default: 70, min: 40, max: 90, step: 5, suffix: '%' },
  tilt: { type: 'slider', label: 'Half cube tilt', default: 12, min: 0, max: 30, step: 1, suffix: '°' },
  bgColor: { type: 'color', label: 'Half cube background', default: 'transparent' },
  ...HINT_FIELD,
  ...TAP_FIELD,
};

function geometry(p: ResolvedProps, ctx: ComponentRenderCtx) {
  const half = p.style === 'half';
  const s = half ? Number(p.cubeScale) / 100 : 1;
  const cw = round(ctx.width * s);
  const ch = round(ctx.height * s);
  const v = p.direction === 'v';
  const d = round((v ? ch : cw) / 2);
  const tilt = half ? Number(p.tilt) : 0;
  const pre = v ? `rotateY(${tilt}deg)` : `rotateX(${-tilt}deg)`;
  return { half, cw, ch, v, d, pre, left: round((ctx.width - cw) / 2), top: round((ctx.height - ch) / 2) };
}

/** Live: a 3D cube showing face 1. Backup: face 1 flat (3D does not survive the backup renderer). */
function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const g = geometry(p, ctx);
  const fit = String(p.fit);
  const faces = slots.faces ?? [];
  const bgSlot = slots.background?.[0];
  const bg = g.half && bgSlot && bgSlot.kind === 'image'
    ? `<img class="bc3-bg" src="${escapeHtml(bgSlot.src)}" alt="" draggable="false">` : '';
  const box = { left: px(g.left), top: px(g.top), width: px(g.cw), height: px(g.ch) };
  const css = [rule(`${ctx.sel} .bc3`, {
    perspective: px(round(Math.max(ctx.width, ctx.height) * 2.5)),
    background: g.half ? safeColor(String(p.bgColor)) : undefined,
  })];
  let inner: string;
  if (backup) {
    css.push(rule(`${ctx.sel} .bc3-flat`, box));
    inner = `<div class="bc3-flat">${faceContent(faces[0], fit, 0, '1')}</div>`;
  } else {
    css.push(rule(`${ctx.sel} .bc3-cube`, { ...box, transform: `translateZ(${-g.d}px) ${g.pre} ${g.v ? 'rotateX(0deg)' : 'rotateY(0deg)'}` }));
    const fs: string[] = [];
    for (let i = 0; i < 4; i++) {
      css.push(rule(`${ctx.sel} .bc3-f:nth-child(${i + 1})`, {
        transform: g.v ? `rotateX(${-i * 90}deg) translateZ(${g.d}px)` : `rotateY(${i * 90}deg) translateZ(${g.d}px)`,
      }));
      fs.push(`<div class="bc3-f">${faceContent(faces[i], fit, i, String(i + 1))}</div>`);
    }
    inner = `<div class="bc3-cube">${fs.join('')}</div>`;
  }
  const html = `<div class="bc3" data-dir="${g.v ? 'v' : 'h'}" data-d="${g.d}" data-pre="${escapeHtml(g.pre)}">${bg}${inner}</div>`;
  return { html, css: css.join('\n') };
}

const RUNTIME = String.raw`bannr.define('cube', function (el, p) {
  var root = el.querySelector('.bc3'), cube = el.querySelector('.bc3-cube');
  if (!root || !cube) return null;
  var v = root.getAttribute('data-dir') === 'v', d = Number(root.getAttribute('data-d')) || 100;
  var pre = root.getAttribute('data-pre') || '', n = cube.children.length || 4, step = 360 / n;
  var dur = Math.max(0.1, Number(p.speed) || 0.8), ang = 0, a0 = 0, face = 0, size = 1;
  var dragging = false, started = false, idle = 0, t = 0, played = 0;
  var every = Math.max(1, Number(p.interval) || 3) * 1000, stopAfter = Math.min(30, Math.max(1, Number(p.autoStop) || 15)) * 1000;
  el.style.touchAction = v ? 'pan-x' : 'pan-y';
  function apply(anim) {
    cube.style.transition = anim ? 'transform ' + dur + 's cubic-bezier(.22,1,.36,1)' : 'none';
    cube.style.transform = 'translateZ(' + (-d) + 'px) ' + pre + ' ' + (v ? 'rotateX(' + ang + 'deg)' : 'rotateY(' + (-ang) + 'deg)');
  }
  function settle(k, quiet) {
    ang = k * step;
    apply(true);
    var f = ((k % n) + n) % n;
    if (f !== face) { face = f; if (!quiet) bannr.track('face_change'); }
  }
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var lp = bannr.loop(function (dt) {
    if (dragging) return;
    if (idle > 0) { idle -= dt; return; }
    played += dt;
    if (played > stopAfter) { lp.stop(); return; }
    t += dt;
    if (t >= every) { t = 0; settle(Math.round(ang / step) + 1, true); }
  });
  if (p.autoRotate && !bannr.reducedMotion) lp.start();
  var off = bannr.gesture(el, {
    start: function () { stopHint(); },
    move: function (g) {
      if (!dragging) {
        dragging = true; a0 = ang; size = (v ? el.offsetHeight : el.offsetWidth) || 1;
        if (!started) { started = true; bannr.track('interaction_start'); }
      }
      ang = a0 - ((v ? g.dy : g.dx) / size) * 90;
      apply(false);
    },
    end: function (g) {
      dragging = false; idle = 4000; t = 0;
      var k = ang / step, vel = v ? g.vy : g.vx;
      settle(vel < -0.3 ? Math.ceil(k) : vel > 0.3 ? Math.floor(k) : Math.round(k), false);
    }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () { lp.stop(); off(); stopHint(); } };
});`;

export const cube: ComponentDefinition = {
  type: 'cube',
  version: 1,
  label: 'Cube',
  category: '3d',
  description: 'A 3D cube with one image per face. Turns on its own and can be swiped.',
  icon: '◫',
  presets: [{ id: 'half', label: 'Half Cube', description: 'A smaller, tilted cube on your own background.', props: { style: 'half' } }],
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 100, height: 80 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'faces', label: 'Faces', kind: 'image', required: true, min: 4, max: 4 },
    { name: 'background', label: 'Background (half cube)', kind: 'image', max: 1 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'face_change'],
  weightBudgetKB: 6,
  styles:
    '.bc3{position:relative;width:100%;height:100%;overflow:hidden}.bc3-bg{position:absolute;inset:0;object-fit:cover}' +
    '.bc3-cube{position:absolute;transform-style:preserve-3d}' +
    '.bc3-f{position:absolute;inset:0;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden}' +
    '.bc3-flat{position:absolute;overflow:hidden}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
