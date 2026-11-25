import { px, round, rule } from '@/renderer/css';
import { GAME_CSS, GAME_JS, gameFields, gameShell } from '../game';
import { THREE_CSS, faceContent } from '../three';
import type {
  ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlot, ResolvedSlots, SettingsSchema,
} from '../types';

/** CATCH FALLING OBJECTS: move a catcher to collect good items and avoid bad ones. */
const SCHEMA: SettingsSchema = {
  scoreGoal: { type: 'number', label: 'Score to win', default: 10, min: 1, max: 50 },
  fallSpeed: { type: 'number', label: 'Fall speed', default: 160, min: 60, max: 600, suffix: 'px/s' },
  spawnEvery: { type: 'number', label: 'New item every', default: 0.9, min: 0.3, max: 3, step: 0.1, suffix: 's' },
  badShare: { type: 'number', label: 'Share of bad items', default: 30, min: 0, max: 80, suffix: '%', help: 'Only used when bad items are uploaded.' },
  badEnds: { type: 'toggle', label: 'Catching a bad item ends the game', default: false, help: 'Otherwise it costs one point.' },
  itemSize: { type: 'number', label: 'Item size', default: 16, min: 6, max: 40, suffix: '% of width' },
  catcherSize: { type: 'number', label: 'Catcher size', default: 26, min: 10, max: 60, suffix: '% of width' },
  ...gameFields({
    time: 20, minTime: 5, timeHelp: 'Reach the score before time runs out.',
    start: 'Catch them all!', howTo: 'Move the basket to catch the falling items.', win: 'Well caught!', lose: "Time's up!",
  }),
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const good = (slots.good ?? []).filter((s) => s.kind === 'image');
  const bad = (slots.bad ?? []).filter((s) => s.kind === 'image');
  const W = ctx.width;
  const H = ctx.height;
  const iw = round((W * Number(p.itemSize)) / 100);
  const cw = round((W * Number(p.catcherSize)) / 100);
  const ch = round(cw * 0.6);
  const goodT: Array<ResolvedSlot | undefined> = good.length > 0 ? good : [undefined];
  const tpl = [
    ...goodT.map((s, i) => `<div class="bca-it" data-good="1">${faceContent(s, 'contain', i, '+')}</div>`),
    ...bad.map((s, i) => `<div class="bca-it" data-good="0">${faceContent(s, 'contain', 3 + i, '✕')}</div>`),
  ].join('');
  const sample = faceContent(good[0], 'contain', 0, '+');
  const demo = [[0.2, 0.18], [0.65, 0.42]]
    .map(([x = 0, y = 0]) => `<div class="bca-it" style="left:${round((W - iw) * x)}px;top:${round(H * y)}px">${sample}</div>`)
    .join('');
  const catcher = `<div class="bca-c">${faceContent(slots.catcher?.[0], 'contain', 2, 'Basket')}</div>`;
  const stage = `<div class="bca-stage"><div class="bca-tpl">${tpl}</div><div class="bca-demo">${demo}</div>` +
    `<div class="bca-fall"></div>${catcher}</div>`;
  const css = [
    rule(`${ctx.sel} .bca-c`, { left: px(round((W - cw) / 2)), width: px(cw), height: px(ch) }),
    rule(`${ctx.sel} .bca-demo .bca-it`, { width: px(iw), height: px(iw) }),
  ].join('\n');
  const shell = gameShell(p, ctx, stage, backup);
  return { html: shell.html, css: `${shell.css}\n${css}` };
}

const RUNTIME = String.raw`bannr.define('catch', function (el, p) {
  var fall = el.querySelector('.bca-fall'), cat = el.querySelector('.bca-c');
  if (!fall || !cat) return null;
  var tpl = el.querySelectorAll('.bca-tpl .bca-it'), good = [], bad = [], i;
  for (i = 0; i < tpl.length; i++) (tpl[i].getAttribute('data-good') === '1' ? good : bad).push(tpl[i]);
  if (!good.length) return null;
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  var W = el.offsetWidth || 300, H = el.offsetHeight || 300;
  var iw = W * num(p.itemSize, 16) / 100, cw = W * num(p.catcherSize, 26) / 100, ch = cw * 0.6;
  var speed = Math.max(10, num(p.fallSpeed, 160)) / 1000, every = Math.max(0.1, num(p.spawnEvery, 0.9)) * 1000;
  var goal = Math.max(1, num(p.scoreGoal, 10)), badRate = bad.length ? Math.max(0, Math.min(1, num(p.badShare, 30) / 100)) : 0;
  var items = [], cx = (W - cw) / 2, score = 0, t = 0, g = null;
  function pxv(v) { return Math.round(v) + 'px'; }
  function place() { cat.style.left = pxv(cx); }
  function clear() { for (var k = 0; k < items.length; k++) fall.removeChild(items[k].el); items = []; }
  function spawn() {
    var isBad = Math.random() < badRate, src = isBad ? bad : good;
    var e = src[Math.floor(Math.random() * src.length)].cloneNode(true), x = Math.random() * (W - iw);
    e.style.left = pxv(x); e.style.top = pxv(-iw); e.style.width = pxv(iw); e.style.height = pxv(iw);
    fall.appendChild(e);
    items.push({ el: e, x: x, y: -iw, bad: isBad });
  }
  function aim(e) {
    if (!g || !g.playing()) return;
    var r = el.getBoundingClientRect();
    cx = Math.max(0, Math.min(W - cw, e.clientX - r.left - cw / 2));
    place();
  }
  function show() { g.score(score + '/' + goal); }
  el.addEventListener('pointermove', aim);
  g = bannr.game(el, p, {
    start: function () { clear(); score = 0; t = every; cx = (W - cw) / 2; place(); show(); },
    step: function (dt) {
      t += dt;
      if (t >= every) { t = 0; spawn(); }
      var top = H - ch - 4;
      for (var k = items.length - 1; k >= 0; k--) {
        var it = items[k];
        it.y += speed * dt;
        it.el.style.top = pxv(it.y);
        var hit = it.y + iw >= top && it.y < top + ch && it.x + iw > cx && it.x < cx + cw;
        if (!hit && it.y <= H) continue;
        fall.removeChild(it.el);
        items.splice(k, 1);
        if (!hit) continue;
        if (it.bad) {
          bannr.track('catch_bad');
          if (p.badEnds) { g.lose(); return; }
          score = Math.max(0, score - 1);
        } else { score++; bannr.track('catch'); }
        show();
        if (score >= goal) { g.win(); return; }
      }
    },
    destroy: function () { el.removeEventListener('pointermove', aim); clear(); }
  });
  return g;
});`;

export const catchGame: ComponentDefinition = {
  type: 'catch',
  version: 1,
  label: 'Catch Falling Objects',
  category: 'game',
  description: 'Move a basket to catch falling products and avoid the bad ones.',
  icon: '⇊',
  defaultSize: { width: 300, height: 300 },
  minSize: { width: 200, height: 240 },
  recommendedSizes: ['480x480', '300x600', '320x480'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'catcher', label: 'Catcher (e.g. a basket)', kind: 'image', max: 1 },
    { name: 'good', label: 'Good items (to catch)', kind: 'image', required: true, min: 1, max: 4 },
    { name: 'bad', label: 'Bad items (to avoid)', kind: 'image', max: 3 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'game_start', 'catch', 'catch_bad', 'game_won', 'game_lost', 'game_skip', 'game_replay'],
  weightBudgetKB: 14,
  styles:
    GAME_CSS +
    '.bca-stage{position:absolute;inset:0;overflow:hidden}.bca-tpl{display:none}' +
    '.bca-fall,.bca-demo{position:absolute;inset:0;pointer-events:none}.bca-it{position:absolute}' +
    '.bca-c{position:absolute;bottom:4px;pointer-events:none}.bgm-on .bca-demo{display:none}' +
    '.bca-stage img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: `${GAME_JS}\n${RUNTIME}`,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
