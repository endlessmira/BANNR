import { safeEasing } from '@/renderer/animation/cssKeyframes';
import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, SettingsSchema } from '../types';

/**
 * GESTURE: an animated hand or pointer that shows the user how to interact (tap, swipe, scratch, drag…).
 * It never catches the pointer: clicks, swipes and drags pass straight through to the layers underneath.
 * One cycle = the movement played `repeat` times, then a pause. Cycles repeat until the stop time.
 * It hides when the user hovers or touches the banner (setting), or when its time is up.
 */
export type Frame = readonly [number, number, number, number, number]; // t (0..1), x px, y px, scale, opacity
export interface Motion { frames: Frame[]; presses: number[] }

const F = (t: number, x: number, y: number, s: number, o: number): Frame => [t, x, y, s, o];
const DIRS: Readonly<Record<string, readonly [number, number]>> = {
  'swipe-left': [-1, 0], 'swipe-right': [1, 0], 'swipe-up': [0, -1], 'swipe-down': [0, 1],
};

/** One movement, relative to the position: L = movement size in px, (dx, dy) = drag target offset. */
export function gestureMotion(g: string, L: number, dx: number, dy: number): Motion {
  const h = L / 2;
  const d = DIRS[g];
  if (d) {
    const ax = -d[0] * h;
    const ay = -d[1] * h;
    const bx = d[0] * h;
    const by = d[1] * h;
    return {
      frames: [F(0, ax, ay, 1, 0), F(0.1, ax, ay, 1, 1), F(0.2, ax, ay, 0.9, 1), F(0.7, bx, by, 0.9, 1), F(0.8, bx, by, 1, 0), F(1, ax, ay, 1, 0)],
      presses: [0.2],
    };
  }
  switch (g) {
    case 'tap':
      return { frames: [F(0, 0, 0, 1, 1), F(0.35, 0, 0, 0.85, 1), F(0.55, 0, 0, 1, 1), F(1, 0, 0, 1, 1)], presses: [0.35] };
    case 'doubletap':
      return {
        frames: [F(0, 0, 0, 1, 1), F(0.2, 0, 0, 0.85, 1), F(0.32, 0, 0, 1, 1), F(0.46, 0, 0, 0.85, 1), F(0.6, 0, 0, 1, 1), F(1, 0, 0, 1, 1)],
        presses: [0.2, 0.46],
      };
    case 'swipe-v':
      return { frames: [F(0, 0, -h, 1, 1), F(0.1, 0, -h, 0.9, 1), F(0.5, 0, h, 0.9, 1), F(0.9, 0, -h, 0.9, 1), F(1, 0, -h, 1, 1)], presses: [0.1] };
    case 'drag':
      return {
        frames: [F(0, 0, 0, 1, 0), F(0.1, 0, 0, 1, 1), F(0.2, 0, 0, 0.88, 1), F(0.75, dx, dy, 0.88, 1), F(0.85, dx, dy, 1, 0), F(1, 0, 0, 1, 0)],
        presses: [0.2],
      };
    case 'scratch': {
      const ys = [-0.3, -0.15, 0, 0.15, 0.3, 0.15, 0, -0.15, -0.3];
      return { frames: ys.map((y, i) => F(i / 8, i % 2 ? h : -h, y * L, 0.9, 1)), presses: [0] };
    }
    case 'circle':
      return {
        frames: Array.from({ length: 13 }, (_, i) => F(i / 12, h * Math.sin((i * Math.PI) / 6), -h * Math.cos((i * Math.PI) / 6), 0.95, 1)),
        presses: [],
      };
    case 'hover':
      return { frames: [F(0, h, 0, 1, 1), F(0.5, -h, 0, 1, 1), F(1, h, 0, 1, 1)], presses: [] };
    default:
      return { frames: [F(0, h, 0, 1, 1), F(0.1, h, 0, 0.9, 1), F(0.5, -h, 0, 0.9, 1), F(0.9, h, 0, 0.9, 1), F(1, h, 0, 1, 1)], presses: [0.1] };
  }
}

export interface GestureKeyframes { cycle: number; move: string; ripple: string }

/** Keyframes for one cycle: the movement `reps` times, then the pause (holding the last frame). */
export function gestureKeyframes(m: Motion, D: number, reps: number, pause: number, ease: string): GestureKeyframes {
  const C = reps * D + pause;
  const pct = (s: number): number => round(Math.min(100, Math.max(0, (s / C) * 100)), 3);
  const st = (f: Frame): string =>
    `transform:translate(${round(f[1])}px,${round(f[2])}px) scale(${round(f[3], 3)});opacity:${round(f[4], 3)};animation-timing-function:${ease}`;
  const stops = new Map<number, string>();
  for (let r = 0; r < reps; r++) for (const f of m.frames) stops.set(pct((r + f[0]) * D), st(f));
  const last = m.frames[m.frames.length - 1];
  const first = m.frames[0];
  if (last && first) {
    if (pause > 0.05) {
      // Hidden during the pause: fade out at the end, fade back in at the start position.
      const fade = Math.min(0.25, pause / 3);
      const hidden = (f: Frame): string => st([f[0], f[1], f[2], f[3], 0]);
      stops.set(pct(reps * D + fade), hidden(last));
      stops.set(pct(C - fade), hidden(first));
      stops.set(100, st(first));
    } else {
      stops.set(100, st(last));
    }
  }
  const body = (mp: Map<number, string>): string => [...mp].sort((a, b) => a[0] - b[0]).map(([p, d]) => `${p}%{${d}}`).join('');

  const times: number[] = [];
  for (let r = 0; r < reps; r++) for (const p of m.presses) times.push((r + p) * D);
  times.sort((a, b) => a - b);
  const rp = new Map<number, string>();
  const off = (s: number): string => `opacity:0;transform:scale(${s})`;
  rp.set(0, off(0.3));
  times.forEach((a, i) => {
    const next = times[i + 1] ?? C;
    rp.set(pct(Math.max(0, a - 0.01)), off(0.3));
    rp.set(pct(a), 'opacity:0.6;transform:scale(0.3);animation-timing-function:ease-out');
    rp.set(pct(Math.min(a + 0.4, next - 0.02)), off(1.8));
  });
  rp.set(100, off(0.3));
  return { cycle: round(C, 3), move: body(stops), ripple: times.length > 0 ? body(rp) : '' };
}

interface Look { w: number; h: number; hx: number; hy: number; svg: string }
/** Cursor shapes; (hx, hy) is the hotspot (fingertip / arrow tip). */
const LOOKS: Readonly<Record<string, Look>> = {
  hand: {
    w: 32, h: 40, hx: 11, hy: 2,
    svg: '<path d="M11 2c1.7 0 3 1.3 3 3v10.5l1-.3c1.6-.4 3.1.6 3.4 2.1l.1.4 1-.2c1.6-.3 3.1.7 3.4 2.3l.1.5.8-.1c1.6-.2 3 .9 3.2 2.5L28 30c.5 4.4-2.9 8-7.3 8h-6.2c-2.3 0-4.4-1.1-5.8-2.9L3 27.6c-1-1.3-.8-3.2.5-4.2 1.2-.9 2.9-.8 4 .2L8 24.1V5c0-1.7 1.3-3 3-3z"/>',
  },
  pointer: { w: 28, h: 36, hx: 4, hy: 2, svg: '<path d="M4 2v28l7-7 4.8 10.6 4.4-2-4.8-10.3H25z"/>' },
  dot: { w: 32, h: 32, hx: 16, hy: 16, svg: '<circle cx="16" cy="16" r="11"/>' },
  ring: { w: 32, h: 32, hx: 16, hy: 16, svg: '<circle cx="16" cy="16" r="12" fill-opacity="0.35"/><circle cx="16" cy="16" r="4"/>' },
};

const DRAG = { key: 'gesture', is: ['drag'] } as const;
const RIPPLE = { key: 'ripple', is: ['true'] } as const;
const LABEL = { key: 'showLabel', is: ['true'] } as const;

const SCHEMA: SettingsSchema = {
  gesture: {
    type: 'select', label: 'Gesture', default: 'swipe-h',
    options: [
      ['tap', 'Tap'], ['doubletap', 'Double tap'], ['swipe-h', 'Swipe left and right'], ['swipe-v', 'Swipe up and down'],
      ['swipe-left', 'Swipe left ←'], ['swipe-right', 'Swipe right →'], ['swipe-up', 'Swipe up ↑'], ['swipe-down', 'Swipe down ↓'],
      ['drag', 'Drag (from A to B)'], ['scratch', 'Scratch'], ['circle', 'Circle / rotate'], ['hover', 'Hover (move left and right, no press)'],
    ],
  },
  look: { type: 'select', label: 'Cursor', default: 'hand', options: [['hand', 'Hand'], ['pointer', 'Mouse pointer'], ['dot', 'Finger dot'], ['ring', 'Touch ring']] },
  fill: { type: 'color', label: 'Fill colour', default: '#ffffff' },
  stroke: { type: 'color', label: 'Stroke colour', default: '#111111' },
  strokeWidth: { type: 'number', label: 'Stroke width', default: 1.5, min: 0, max: 4, step: 0.5 },
  size: { type: 'number', label: 'Cursor size', default: 48, min: 16, max: 160, suffix: 'px' },
  shadow: { type: 'toggle', label: 'Shadow', default: true },
  posX: {
    type: 'number', label: 'Position X', default: 50, min: 0, max: 100, suffix: '%',
    help: 'The centre of the movement (the start point for Drag), in % of the banner.',
  },
  posY: { type: 'number', label: 'Position Y', default: 55, min: 0, max: 100, suffix: '%' },
  travel: { type: 'number', label: 'Movement size', default: 40, min: 5, max: 90, suffix: '%', help: 'How far it moves, in % of the shorter banner side.' },
  endX: { type: 'number', label: 'Drag to X', default: 75, min: 0, max: 100, suffix: '%', when: DRAG },
  endY: { type: 'number', label: 'Drag to Y', default: 30, min: 0, max: 100, suffix: '%', when: DRAG },
  duration: { type: 'number', label: 'One movement', default: 1.2, min: 0.3, max: 5, step: 0.1, suffix: 's' },
  repeat: { type: 'number', label: 'Repeats', default: 2, min: 1, max: 10, step: 1, help: 'How many times the movement plays before each pause.' },
  pause: { type: 'number', label: 'Pause', default: 1.5, min: 0, max: 10, step: 0.1, suffix: 's' },
  easing: {
    type: 'select', label: 'Easing', default: 'ease-in-out',
    options: [['ease-in-out', 'Ease in-out'], ['ease-out', 'Ease out'], ['ease-in', 'Ease in'], ['ease', 'Ease'], ['linear', 'Linear'], ['cubic-bezier(0.34,1.56,0.64,1)', 'Back (overshoot)']],
  },
  delay: { type: 'number', label: 'Appear after', default: 1, min: 0, max: 10, step: 0.1, suffix: 's' },
  autoStop: {
    type: 'number', label: 'Stop after', default: 15, min: 3, max: 30, suffix: 's',
    help: 'It disappears after this time. Keeps the banner within the animation limit (30 s by default).',
  },
  ripple: { type: 'toggle', label: 'Ripple on press', default: false },
  rippleColor: { type: 'color', label: 'Ripple colour', default: 'rgba(255,255,255,0.7)', when: RIPPLE },
  showLabel: { type: 'toggle', label: 'Label', default: false },
  labelText: { type: 'text', label: 'Label text', default: 'Swipe', maxLength: 30, when: LABEL },
  labelColor: { type: 'color', label: 'Label text colour', default: '#ffffff', when: LABEL },
  labelBg: { type: 'color', label: 'Label background', default: 'rgba(0,0,0,0.6)', when: LABEL },
  hideOn: {
    type: 'select', label: 'Hide when', default: 'hover',
    options: [['hover', 'Mouse hover or touch'], ['touch', 'Touch or click'], ['never', 'Never (only after the stop time)']],
    help: 'Phones cannot hover, so in hover mode a touch hides it there.',
  },
  inBackup: { type: 'toggle', label: 'Show in the backup image', default: false },
};

function output(p: ResolvedProps, ctx: ComponentRenderCtx, animated: boolean) {
  const look = LOOKS[String(p.look)] ?? LOOKS.hand!;
  const size = Number(p.size);
  const k = size / look.h;
  const sx = (ctx.width * Number(p.posX)) / 100;
  const sy = (ctx.height * Number(p.posY)) / 100;
  const L = (Math.min(ctx.width, ctx.height) * Number(p.travel)) / 100;
  const m = gestureMotion(String(p.gesture), L, (ctx.width * Number(p.endX)) / 100 - sx, (ctx.height * Number(p.endY)) / 100 - sy);
  const reps = Math.max(1, Math.min(10, Math.round(Number(p.repeat))));
  const kf = gestureKeyframes(m, Math.max(0.1, Number(p.duration)), reps, Math.max(0, Number(p.pause)), safeEasing(String(p.easing)));
  const iters = Math.max(1, Math.floor(Number(p.autoStop) / kf.cycle));
  const delay = round(Math.max(0, Number(p.delay)), 2);
  const total = round(delay + iters * kf.cycle, 2);
  const rippleOn = p.ripple === true && kf.ripple !== '';
  const rs = round(size * 0.9);
  const text = String(p.labelText).trim();
  const label = p.showLabel === true && text ? `<span class="bgs-lb">${escapeText(text)}</span>` : '';
  const svg = `<svg class="bgs-c" viewBox="0 0 ${look.w} ${look.h}" width="${round(look.w * k)}" height="${round(size)}" ` +
    `style="left:${round(-look.hx * k)}px;top:${round(-look.hy * k)}px" aria-hidden="true">${look.svg}</svg>`;
  const html = `<div class="bgs" data-g="${escapeHtml(String(p.gesture))}" data-hide="${escapeHtml(String(p.hideOn))}" data-total="${total}">` +
    `<div class="bgs-w"><div class="bgs-m">${rippleOn ? '<span class="bgs-rp"></span>' : ''}${svg}</div>${label}</div></div>`;
  const sel = ctx.sel;
  const id = ctx.id;
  const css: string[] = [
    rule(`${sel} .bgs-w`, { left: px(round(sx)), top: px(round(sy)) }),
    rule(`${sel} .bgs-c`, {
      fill: safeColor(String(p.fill), '#ffffff'), stroke: safeColor(String(p.stroke), '#111111'),
      // Outside stroke: double width, painted behind the fill, so only the outer half shows.
      'stroke-width': round(Math.max(0, Number(p.strokeWidth)) * 2, 2), 'paint-order': 'stroke',
      filter: p.shadow === true ? 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' : undefined,
    }),
    rippleOn ? rule(`${sel} .bgs-rp`, {
      width: px(rs), height: px(rs), 'margin-left': px(-rs / 2), 'margin-top': px(-rs / 2),
      background: safeColor(String(p.rippleColor), 'rgba(255,255,255,0.7)'),
    }) : '',
    label ? rule(`${sel} .bgs-lb`, {
      top: px(round(size - look.hy * k + 8)),
      color: safeColor(String(p.labelColor), '#ffffff'), background: safeColor(String(p.labelBg), 'rgba(0,0,0,0.6)'),
    }) : '',
  ];
  if (animated) {
    css.push(
      `@keyframes bgs-k-${id}{${kf.move}}`,
      `${sel} .bgs-m{animation:bgs-k-${id} ${kf.cycle}s linear ${delay}s ${iters} both}`,
      `${sel} .bgs-w{animation:bgs-in .3s ease ${delay}s both}`,
    );
    if (rippleOn) css.push(`@keyframes bgs-r-${id}{${kf.ripple}}`, `${sel} .bgs-rp{animation:bgs-r-${id} ${kf.cycle}s linear ${delay}s ${iters} both}`);
  }
  return { html, css: css.filter(Boolean).join('\n') };
}

const RUNTIME = String.raw`bannr.define('gesture', function (el, p) {
  var root = el.querySelector('.bgs');
  if (!root) return null;
  var mode = root.getAttribute('data-hide') || 'hover', total = (Number(root.getAttribute('data-total')) || 15) * 1000;
  var host = document.getElementById('banner') || document, t = 0, done = false;
  function off() { host.removeEventListener('pointermove', mv, true); host.removeEventListener('pointerdown', dn, true); }
  function hide(user) {
    if (done) return;
    done = true;
    root.classList.add('bgs-off');
    lp.stop();
    off();
    if (user) bannr.track('gesture_dismissed');
  }
  function mv(e) { if (!e.pointerType || e.pointerType === 'mouse') hide(true); }
  function dn() { hide(true); }
  var lp = bannr.loop(function (dt) { t += dt; if (t >= total) hide(false); });
  if (mode === 'hover') host.addEventListener('pointermove', mv, true);
  if (mode !== 'never') host.addEventListener('pointerdown', dn, true);
  lp.start();
  return { destroy: function () { lp.stop(); off(); } };
});`;

export const gesture: ComponentDefinition = {
  type: 'gesture',
  version: 1,
  label: 'Gesture',
  category: 'motion',
  description: 'An animated hand or pointer that shows how to interact. Clicks and swipes pass through it.',
  icon: '☝',
  presets: [
    { id: 'tap', label: 'Tap', description: 'A tap with a ripple. For CTAs, Flip Card, Hover Reveal on phones.', props: { gesture: 'tap', posY: 70, pause: 1.2 } },
    { id: 'swipe', label: 'Swipe', description: 'Left and right. For Carousel, Carousel Set, Cube, Card Swipe, Panorama.', props: { gesture: 'swipe-h' } },
    { id: 'swipe-v', label: 'Swipe up and down', description: 'For a Cube or Flip Card that turns up and down.', props: { gesture: 'swipe-v' } },
    { id: 'scratch', label: 'Scratch', description: 'A zigzag. For Scratch.', props: { gesture: 'scratch', travel: 50, repeat: 1 } },
    { id: 'drag', label: 'Drag', description: 'From A to B. For Drag and Drop and Before/After Wipe.', props: { gesture: 'drag', posX: 30, posY: 30, endX: 55, endY: 75, repeat: 1 } },
    { id: 'peel', label: 'Peel', description: 'From the corner inwards. For Peel.', props: { gesture: 'drag', posX: 88, posY: 88, endX: 55, endY: 55, repeat: 1 } },
    { id: 'rotate', label: 'Rotate', description: 'A circle. For Orbit Carousel and Tilt Card.', props: { gesture: 'circle', repeat: 1, duration: 2 } },
    {
      id: 'hover', label: 'Hover', description: 'A pointer moving left and right, without pressing. For Zoom, Tilt Card and Hover Reveal.',
      props: { gesture: 'hover', look: 'pointer', travel: 40, duration: 1.6, repeat: 2 },
    },
  ],
  hidePresetCards: true,
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 40, height: 40 },
  recommendedSizes: ['480x480', '300x250', '300x300', '300x600', '480x300', '320x480', '970x250'],
  settingsSchema: SCHEMA,
  slots: [],
  capturesPointer: false,
  emits: ['gesture_dismissed'],
  weightBudgetKB: 8,
  styles:
    '.bgs{position:relative;width:100%;height:100%;overflow:hidden;pointer-events:none;transition:opacity .35s ease}.bgs.bgs-off{opacity:0}' +
    '.bgs-w{position:absolute;width:0;height:0}.bgs-m{position:absolute;left:0;top:0;transform-origin:0 0}' +
    '.bgs-c{position:absolute;overflow:visible;stroke-linejoin:round;stroke-linecap:round}' +
    '.bgs-rp{position:absolute;left:0;top:0;border-radius:50%;opacity:0}' +
    '.bgs-lb{position:absolute;left:0;white-space:nowrap;transform:translateX(-50%);padding:3px 8px;border-radius:999px;font:700 12px Arial,sans-serif}' +
    '@keyframes bgs-in{from{opacity:0}}' +
    '@media (prefers-reduced-motion:reduce){.bgs-m,.bgs-rp{animation:none!important}}',
  render: (p, _s, ctx) => output(p, ctx, true),
  runtime: RUNTIME,
  backupState: (p, _s, ctx) => (p.inBackup === true ? output(p, ctx, false) : { html: '', css: '' }),
};
