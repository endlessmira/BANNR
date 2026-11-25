import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeText } from '@/renderer/escape';
import { GAME_CSS, GAME_JS, gameFields, gameShell } from '../game';
import { THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/** MEMORY GAME: turn over two cards at a time to find all the pairs. */
export function memoryGrid(grid: string, w: number, h: number): { cols: number; rows: number; pairs: number } {
  const [a, b] = grid === '3x4' ? [3, 4] : [2, 3];
  const land = w >= h;
  return { cols: land ? b : a, rows: land ? a : b, pairs: (a * b) / 2 };
}

const SCHEMA: SettingsSchema = {
  grid: { type: 'select', label: 'Grid', default: '2x3', options: [['2x3', '2 × 3 (3 pairs)'], ['3x4', '3 × 4 (6 pairs)']] },
  backColor: { type: 'color', label: 'Card back colour', default: '#111111' },
  backText: { type: 'text', label: 'Card back text', default: '?', maxLength: 4 },
  backTextColor: { type: 'color', label: 'Card back text colour', default: '#f2a902' },
  fit: { type: 'select', label: 'Image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  gap: { type: 'number', label: 'Gap', default: 6, min: 0, max: 30, suffix: 'px' },
  ...gameFields({
    time: 30, minTime: 0, timeHelp: 'The game is lost when time runs out. 0 = no time limit.',
    start: 'Find the pairs!', howTo: 'Tap two cards to turn them over.', win: 'You found them all!', lose: "Time's up!",
  }),
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const g = memoryGrid(String(p.grid), ctx.width, ctx.height);
  const imgs = (slots.cards ?? []).filter((s) => s.kind === 'image');
  const back = `<div class="bmm-f bmm-back"><span>${escapeText(String(p.backText))}</span></div>`;
  const cards: string[] = [];
  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < g.pairs; k++) {
      cards.push(
        `<div class="bmm-c" data-k="${k}"><div class="bmm-in">${back}` +
        `<div class="bmm-f bmm-face">${faceContent(imgs[k], String(p.fit), k, String(k + 1))}</div></div></div>`,
      );
    }
  }
  const gap = Number(p.gap);
  const cell = Math.min(ctx.width / g.cols, ctx.height / g.rows);
  const css = [
    rule(`${ctx.sel} .bmm`, {
      'grid-template-columns': `repeat(${g.cols},1fr)`, 'grid-template-rows': `repeat(${g.rows},1fr)`,
      gap: px(gap), padding: `${px(gap + 24)} ${px(gap)} ${px(gap + 30)}`,
    }),
    rule(`${ctx.sel} .bmm-back`, {
      background: safeColor(String(p.backColor), '#111'), color: safeColor(String(p.backTextColor), '#f2a902'),
      'font-size': px(round(cell * 0.35, 1)),
    }),
  ].join('\n');
  const shell = gameShell(p, ctx, `<div class="bmm">${cards.join('')}</div>`, backup);
  return { html: shell.html, css: `${shell.css}\n${css}` };
}

const RUNTIME = String.raw`bannr.define('memory', function (el, p) {
  var cards = el.querySelectorAll('.bmm-c'), n = cards.length;
  if (!n) return null;
  var open = [], found = 0, lock = false, wait = 0, total = Math.floor(n / 2), g = null;
  function deal() {
    var ord = [], i, j, x;
    for (i = 0; i < n; i++) ord.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); x = ord[i]; ord[i] = ord[j]; ord[j] = x; }
    for (i = 0; i < n; i++) {
      cards[i].style.order = String(ord[i]);
      cards[i].classList.remove('bmm-open');
      cards[i].classList.remove('bmm-done');
    }
    open = []; found = 0; lock = false; wait = 0;
  }
  g = bannr.game(el, p, {
    start: function (api) { deal(); api.score('0/' + total); },
    step: function (dt) {
      if (wait <= 0) return;
      wait -= dt;
      if (wait <= 0) { for (var i = 0; i < open.length; i++) open[i].classList.remove('bmm-open'); open = []; lock = false; }
    },
    tap: function (t) {
      var c = t && t.closest ? t.closest('.bmm-c') : null;
      if (!c || lock || c.classList.contains('bmm-open')) return;
      c.classList.add('bmm-open');
      open.push(c);
      if (open.length < 2) return;
      var a = open[0], b = open[1];
      if (a.getAttribute('data-k') === b.getAttribute('data-k')) {
        a.classList.add('bmm-done'); b.classList.add('bmm-done'); open = [];
        found++;
        g.score(found + '/' + total);
        bannr.track('match');
        if (found >= total) g.win();
      } else { lock = true; wait = 800; }
    }
  });
  return g;
});`;

export const memory: ComponentDefinition = {
  type: 'memory',
  version: 1,
  label: 'Memory Game',
  category: 'game',
  description: 'Turn over cards two at a time to find all the matching pairs.',
  icon: '⊞',
  defaultSize: { width: 300, height: 300 },
  minSize: { width: 200, height: 200 },
  recommendedSizes: ['480x480', '300x600', '320x480'],
  settingsSchema: SCHEMA,
  slots: [{ name: 'cards', label: 'Cards', kind: 'image', required: true, min: 3, max: 6 }],
  capturesPointer: true,
  emits: ['interaction_start', 'game_start', 'match', 'game_won', 'game_lost', 'game_skip', 'game_replay'],
  weightBudgetKB: 14,
  styles:
    GAME_CSS +
    '.bmm{position:absolute;inset:0;display:grid;box-sizing:border-box}' +
    '.bmm-c{position:relative;min-width:0;min-height:0;perspective:600px;cursor:pointer}' +
    '.bmm-in{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .4s ease}.bmm-open .bmm-in{transform:rotateY(180deg)}' +
    '.bmm-f{position:absolute;inset:0;overflow:hidden;border-radius:6px;backface-visibility:hidden;-webkit-backface-visibility:hidden}' +
    '.bmm-back{display:grid;place-items:center;font-weight:900}.bmm-face{transform:rotateY(180deg);background:#fff}' +
    '.bmm-done{opacity:.6;transition:opacity .3s}' +
    '.bmm img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: `${GAME_JS}\n${RUNTIME}`,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
  validate: (p, slots) => {
    const need = memoryGrid(String(p.grid), 1, 1).pairs;
    const have = (slots?.cards ?? []).filter((v) => v.kind === 'image').length;
    return have > 0 && have < need
      ? [{ ruleId: 'memory-cards', level: 'error' as const, message: `Memory Game: the ${String(p.grid).replace('x', ' × ')} grid needs ${need} card images (${have} uploaded)` }]
      : [];
  },
};
