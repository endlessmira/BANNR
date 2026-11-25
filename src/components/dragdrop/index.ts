import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import { GAME_CSS, GAME_JS, gameFields, gameShell } from '../game';
import { THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/** DRAG AND DROP: drag the products into a target zone (e.g. a basket). */
export interface DDBox { x: number; y: number; s: number }

/** Products along the top and the target at the bottom; on wide sizes, products left and target right. */
export function ddLayout(n: number, W: number, H: number, itemPct: number, targetPct: number): { target: DDBox; items: DDBox[] } {
  const m = Math.min(W, H);
  const wide = W / H >= 1.6;
  const t = round((m * targetPct) / 100);
  const target: DDBox = wide ? { x: round(W - t - 16), y: round((H - t) / 2), s: t } : { x: round((W - t) / 2), y: round(H - t - 40), s: t };
  const avail = wide ? W - t - 48 : W - 24;
  const s = round(Math.min((m * itemPct) / 100, (avail / Math.max(1, n)) * 0.85));
  const gap = (avail - n * s) / (n + 1);
  const x0 = wide ? 16 : 12;
  const y = wide ? round((H - s) / 2) : round(Math.max(36, (target.y - s) * 0.35));
  return { target, items: Array.from({ length: n }, (_, i) => ({ x: round(x0 + gap + i * (s + gap)), y, s })) };
}

const SCHEMA: SettingsSchema = {
  toWin: { type: 'number', label: 'Items to win', default: 0, min: 0, max: 6, step: 1, help: '0 = all of them.' },
  itemSize: { type: 'number', label: 'Item size', default: 22, min: 10, max: 40, suffix: '%' },
  targetSize: { type: 'number', label: 'Target size', default: 40, min: 20, max: 70, suffix: '%' },
  successAnim: {
    type: 'select', label: 'Drop effect', default: 'shrink',
    options: [['shrink', 'Shrink into the target'], ['fade', 'Fade out'], ['stay', 'Stay in the target']],
  },
  targetLabel: { type: 'text', label: 'Target label', default: 'Drop here', maxLength: 30, help: 'Shown when no target image is uploaded.' },
  targetBg: { type: 'color', label: 'Target background', default: 'rgba(242,169,2,0.15)' },
  targetBorder: { type: 'color', label: 'Target border and label colour', default: '#f2a902' },
  ...gameFields({
    time: 20, minTime: 0, timeHelp: 'The game is lost when time runs out. 0 = no time limit.',
    start: 'Fill the basket!', howTo: 'Drag the products into the basket.', win: 'All packed!', lose: "Time's up!",
  }),
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const imgs = (slots.items ?? []).filter((s) => s.kind === 'image');
  const n = imgs.length > 0 ? imgs.length : 3;
  const L = ddLayout(n, ctx.width, ctx.height, Number(p.itemSize), Number(p.targetSize));
  const items = L.items.map((b, i) =>
    `<div class="bdd-it" data-it="${i}" style="left:${b.x}px;top:${b.y}px;width:${b.s}px;height:${b.s}px">` +
    `${faceContent(imgs[i], 'contain', i, String(i + 1))}</div>`).join('');
  const ti = slots.target?.[0];
  const label = String(p.targetLabel).trim();
  const inner = ti && ti.kind === 'image'
    ? `<img src="${escapeHtml(ti.src)}" alt="" draggable="false">`
    : label ? `<span>${escapeText(label)}</span>` : '';
  const t = L.target;
  const target = `<div class="bdd-tg${ti ? ' bdd-tg-img' : ''}" data-target="1" style="left:${t.x}px;top:${t.y}px;width:${t.s}px;height:${t.s}px">${inner}</div>`;
  const col = safeColor(String(p.targetBorder), '#f2a902');
  const css = rule(`${ctx.sel} .bdd-tg`, {
    background: safeColor(String(p.targetBg)), 'border-color': col, color: col, 'font-size': px(round(t.s * 0.14, 1)),
  });
  const shell = gameShell(p, ctx, `<div class="bdd">${target}${items}</div>`, backup);
  return { html: shell.html, css: `${shell.css}\n${css}` };
}

const RUNTIME = String.raw`bannr.define('dragdrop', function (el, p) {
  var tgt = el.querySelector('[data-target]'), its = el.querySelectorAll('[data-it]'), n = its.length;
  if (!tgt || !n) return null;
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  var need = Math.max(1, Math.min(n, Math.round(num(p.toWin, 0)) || n)), mode = String(p.successAnim || 'shrink');
  var ok = {}, done = 0, cur = null, r0 = null, pop = 0, g = null;
  function reset() {
    for (var i = 0; i < n; i++) {
      var s = its[i].style;
      s.transition = 'none'; s.transform = ''; s.opacity = '';
      its[i].classList.remove('bdd-done');
    }
    tgt.classList.remove('bdd-pop');
    ok = {}; done = 0; cur = null; r0 = null; pop = 0;
  }
  function down(e) {
    if (!g || !g.playing()) return;
    var it = e.target && e.target.closest ? e.target.closest('[data-it]') : null;
    cur = it && !ok[it.getAttribute('data-it')] ? it : null;
    r0 = cur ? cur.getBoundingClientRect() : null;
    if (cur) cur.classList.add('bdd-drag');
  }
  el.addEventListener('pointerdown', down);
  g = bannr.game(el, p, {
    touch: 'none',
    start: function (api) { reset(); api.score('0/' + need); },
    step: function (dt) { if (pop > 0) { pop -= dt; if (pop <= 0) tgt.classList.remove('bdd-pop'); } },
    move: function (m) {
      if (!cur) return;
      cur.style.transition = 'none';
      cur.style.transform = 'translate(' + m.dx + 'px,' + m.dy + 'px) scale(1.08)';
    },
    end: function (m) {
      if (!cur || !r0) return;
      var c = cur, a = r0;
      cur = null; r0 = null;
      c.classList.remove('bdd-drag');
      c.style.transition = 'transform .35s cubic-bezier(.22,1,.36,1),opacity .35s ease';
      var tr = tgt.getBoundingClientRect(), cx = a.left + a.width / 2 + m.dx, cy = a.top + a.height / 2 + m.dy;
      if (cx >= tr.left && cx <= tr.left + tr.width && cy >= tr.top && cy <= tr.top + tr.height) {
        ok[c.getAttribute('data-it')] = 1; done++;
        var tx = tr.left + tr.width / 2 - (a.left + a.width / 2), ty = tr.top + tr.height / 2 - (a.top + a.height / 2);
        if (mode === 'fade') c.style.transform = 'translate(' + m.dx + 'px,' + m.dy + 'px)';
        else c.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + (mode === 'stay' ? '0.5' : '0.2') + ')';
        if (mode !== 'stay') c.style.opacity = '0';
        c.classList.add('bdd-done');
        tgt.classList.add('bdd-pop'); pop = 400;
        bannr.track('drop');
        g.score(done + '/' + need);
        if (done >= need) g.win();
      } else {
        c.style.transform = '';
        bannr.track('drop_miss');
      }
    },
    destroy: function () { el.removeEventListener('pointerdown', down); }
  });
  return g;
});`;

export const dragdrop: ComponentDefinition = {
  type: 'dragdrop',
  version: 1,
  label: 'Drag and Drop',
  category: 'game',
  description: 'Drag the products into a target zone, like a basket.',
  icon: '⇲',
  defaultSize: { width: 300, height: 300 },
  minSize: { width: 200, height: 200 },
  recommendedSizes: ['480x480', '300x600', '320x480'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'items', label: 'Products (to drag)', kind: 'image', required: true, min: 1, max: 6 },
    { name: 'target', label: 'Target image (e.g. a basket)', kind: 'image', max: 1 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'game_start', 'drop', 'drop_miss', 'game_won', 'game_lost', 'game_skip', 'game_replay'],
  weightBudgetKB: 14,
  styles:
    GAME_CSS +
    '.bdd{position:absolute;inset:0}.bdd-it{position:absolute;z-index:10;cursor:grab}' +
    '.bdd-drag{z-index:40;cursor:grabbing;filter:drop-shadow(0 6px 10px rgba(0,0,0,.3))}.bdd-done{pointer-events:none}' +
    '.bdd-tg{position:absolute;display:grid;place-items:center;box-sizing:border-box;border:2px dashed;border-radius:12px;' +
    'font-weight:700;text-align:center;overflow:hidden}.bdd-tg-img{border:0;background:transparent!important}' +
    '.bdd img{display:block;width:100%;height:100%;object-fit:contain;-webkit-user-drag:none;user-select:none}' +
    '.bdd-pop{animation:bdd-pop .4s ease}@keyframes bdd-pop{50%{transform:scale(1.12)}}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: `${GAME_JS}\n${RUNTIME}`,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
