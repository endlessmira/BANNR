import { round, rule, safeColor } from '@/renderer/css';
import { GAME_CSS, GAME_JS, gameFields, gameShell } from '../game';
import { THREE_CSS, faceContent } from '../three';
import type {
  ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlot, ResolvedSlots, SettingsSchema,
} from '../types';

/** SLICE GAME: products fly up in an arc; swipe across them to slice them, and avoid the bombs. */
const SCHEMA: SettingsSchema = {
  scoreGoal: { type: 'number', label: 'Score to win', default: 10, min: 1, max: 50 },
  flySpeed: { type: 'select', label: 'Fly speed', default: 'normal', options: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] },
  spawnEvery: { type: 'number', label: 'New item every', default: 0.8, min: 0.3, max: 3, step: 0.1, suffix: 's' },
  badShare: { type: 'number', label: 'Share of bombs', default: 25, min: 0, max: 80, suffix: '%', help: 'Only used when bombs are uploaded.' },
  badEnds: { type: 'toggle', label: 'Slicing a bomb ends the game', default: true, help: 'Otherwise it costs one point.' },
  itemSize: { type: 'number', label: 'Item size', default: 18, min: 8, max: 40, suffix: '% of width' },
  trailColor: { type: 'color', label: 'Slash colour', default: '#ffffff' },
  ...gameFields({
    time: 20, minTime: 5, timeHelp: 'Reach the score before time runs out.',
    start: 'Slice them all!', howTo: 'Swipe across the products to slice them. Avoid the bombs!', win: 'Sharp moves!', lose: "Time's up!",
  }),
};

const DEMO: ReadonlyArray<readonly [number, number, number]> = [[0.15, 0.45, 0], [0.45, 0.2, 1], [0.75, 0.5, 0]];

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const good = (slots.good ?? []).filter((s) => s.kind === 'image');
  const bad = (slots.bad ?? []).filter((s) => s.kind === 'image');
  const W = ctx.width;
  const H = ctx.height;
  const iw = round((W * Number(p.itemSize)) / 100);
  const goodT: Array<ResolvedSlot | undefined> = good.length > 0 ? good : [undefined];
  const tpl = [
    ...goodT.map((s, i) => `<div class="bsl-it" data-good="1">${faceContent(s, 'contain', i, '+')}</div>`),
    ...bad.map((s, i) => `<div class="bsl-it" data-good="0">${faceContent(s, 'contain', 3 + i, '✕')}</div>`),
  ].join('');
  const sample = faceContent(good[0], 'contain', 0, '+');
  const demo = DEMO.map(([x, y, c]) =>
    `<div class="bsl-it${c ? ' bsl-slashed' : ''}" style="left:${round((W - iw) * x)}px;top:${round(H * y)}px;width:${iw}px;height:${iw}px">${sample}</div>`,
  ).join('');
  const stage = `<div class="bsl-stage"><div class="bsl-tpl">${tpl}</div><div class="bsl-demo">${demo}</div><div class="bsl-fly"></div></div>`;
  const css = rule(`${ctx.sel} .bsl-stage`, { '--trail': safeColor(String(p.trailColor), '#ffffff') });
  const shell = gameShell(p, ctx, stage, backup);
  return { html: shell.html, css: `${shell.css}\n${css}` };
}

const RUNTIME = String.raw`bannr.define('slice', function (el, p) {
  var fly = el.querySelector('.bsl-fly');
  if (!fly) return null;
  var tpl = el.querySelectorAll('.bsl-tpl .bsl-it'), good = [], bad = [], i;
  for (i = 0; i < tpl.length; i++) (tpl[i].getAttribute('data-good') === '1' ? good : bad).push(tpl[i]);
  if (!good.length) return null;
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  var W = el.offsetWidth || 300, H = el.offsetHeight || 300, iw = W * num(p.itemSize, 18) / 100;
  var T = ({ slow: 1000, normal: 800, fast: 600 })[p.flySpeed] || 800;
  var every = Math.max(0.1, num(p.spawnEvery, 0.8)) * 1000, goal = Math.max(1, num(p.scoreGoal, 10));
  var badRate = bad.length ? Math.max(0, Math.min(1, num(p.badShare, 25) / 100)) : 0;
  var items = [], score = 0, t = 0, last = null, g = null;
  function pxv(v) { return Math.round(v) + 'px'; }
  function drop(k) { fly.removeChild(items[k].el); items.splice(k, 1); }
  function clear() { while (items.length) drop(items.length - 1); }
  function show() { g.score(score + '/' + goal); }
  function spawn() {
    var isBad = Math.random() < badRate, src = isBad ? bad : good;
    var e = src[Math.floor(Math.random() * src.length)].cloneNode(true), x = Math.random() * (W - iw);
    var peak = H * (0.55 + Math.random() * 0.3);
    e.style.left = pxv(x); e.style.top = pxv(H); e.style.width = pxv(iw); e.style.height = pxv(iw);
    fly.appendChild(e);
    items.push({ el: e, x: x, y: H, vx: ((W / 2 - x - iw / 2) / (2 * T)) * 0.8, vy: -2 * peak / T, g: 2 * peak / (T * T), bad: isBad, cut: 0 });
  }
  function dist(a, b, x, y) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
    var u = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0;
    var qx = a[0] + u * dx - x, qy = a[1] + u * dy - y;
    return Math.sqrt(qx * qx + qy * qy);
  }
  function cut(it) {
    it.cut = 350;
    it.el.classList.add('bsl-cut');
    if (it.bad) {
      bannr.track('slice_bad');
      if (p.badEnds) { g.lose(); return true; }
      score = Math.max(0, score - 1);
    } else { score++; bannr.track('slice'); }
    show();
    if (score >= goal) { g.win(); return true; }
    return false;
  }
  g = bannr.game(el, p, {
    touch: 'none',
    start: function () { clear(); score = 0; t = every; last = null; show(); },
    step: function (dt) {
      t += dt;
      if (t >= every) { t = 0; spawn(); }
      for (var k = items.length - 1; k >= 0; k--) {
        var it = items[k];
        if (it.cut) { it.cut -= dt; if (it.cut <= 0) drop(k); continue; }
        it.vy += it.g * dt; it.x += it.vx * dt; it.y += it.vy * dt;
        it.el.style.left = pxv(it.x); it.el.style.top = pxv(it.y);
        if (it.vy > 0 && it.y > H + iw) drop(k);
      }
    },
    move: function (m) {
      var r = el.getBoundingClientRect(), x = m.event.clientX - r.left, y = m.event.clientY - r.top;
      var a = last || [x - m.dx, y - m.dy];
      last = [x, y];
      for (var k = items.length - 1; k >= 0; k--) {
        var it = items[k];
        if (!it.cut && dist(a, last, it.x + iw / 2, it.y + iw / 2) <= iw / 2 && cut(it)) return;
      }
    },
    end: function () { last = null; },
    destroy: function () { clear(); }
  });
  return g;
});`;

export const slice: ComponentDefinition = {
  type: 'slice',
  version: 1,
  label: 'Slice Game',
  category: 'game',
  description: 'Swipe to slice products as they fly up. Avoid the bombs!',
  icon: '⚔',
  defaultSize: { width: 300, height: 300 },
  minSize: { width: 200, height: 240 },
  recommendedSizes: ['480x480', '300x600', '320x480'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'good', label: 'Products (to slice)', kind: 'image', required: true, min: 1, max: 4 },
    { name: 'bad', label: 'Bombs (to avoid)', kind: 'image', max: 3 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'game_start', 'slice', 'slice_bad', 'game_won', 'game_lost', 'game_skip', 'game_replay'],
  weightBudgetKB: 14,
  styles:
    GAME_CSS +
    '.bsl-stage{position:absolute;inset:0;overflow:hidden}.bsl-tpl{display:none}' +
    '.bsl-fly,.bsl-demo{position:absolute;inset:0;pointer-events:none}.bsl-it{position:absolute}.bgm-on .bsl-demo{display:none}' +
    '.bsl-stage img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' +
    '.bsl-cut::after,.bsl-slashed::after{content:"";position:absolute;left:-15%;right:-15%;top:50%;height:3px;margin-top:-1.5px;' +
    'background:var(--trail);box-shadow:0 0 8px var(--trail);transform:rotate(-30deg)}' +
    '.bsl-cut{animation:bsl-cut .35s ease-out forwards}@keyframes bsl-cut{to{opacity:0;transform:scale(1.25) rotate(15deg)}}' +
    THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: `${GAME_JS}\n${RUNTIME}`,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
