import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import { HINT_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/** HOVER REVEAL: covered tiles revealed on hover (mouse) or tap (touch), then an end screen with a CTA. */
const SCHEMA: SettingsSchema = {
  cols: { type: 'number', label: 'Columns', default: 2, min: 1, max: 4, step: 1 },
  gap: { type: 'number', label: 'Gap', default: 6, min: 0, max: 40, suffix: 'px' },
  coverColor: { type: 'color', label: 'Cover colour', default: '#111111' },
  coverText: { type: 'text', label: 'Cover text', default: '?', maxLength: 12 },
  coverTextColor: { type: 'color', label: 'Cover text colour', default: '#ffffff' },
  revealAnim: { type: 'select', label: 'Reveal effect', default: 'fade', options: [['fade', 'Fade'], ['zoom', 'Zoom out']] },
  fit: { type: 'select', label: 'Image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  timeout: {
    type: 'number', label: 'End screen after', default: 15, min: 0, max: 30, suffix: 's',
    help: 'Shows the end screen even if not everything was revealed. 0 = only when all images are revealed.',
  },
  endDelay: { type: 'number', label: 'Pause before the end screen', default: 1.2, min: 0, max: 5, step: 0.1, suffix: 's' },
  endTitle: { type: 'text', label: 'End screen title', default: 'You found them all!', maxLength: 80 },
  endCta: { type: 'text', label: 'End screen button', default: 'Shop now', maxLength: 30, help: 'Always opens the landing page. Leave empty to hide it.' },
  endBg: { type: 'color', label: 'End screen background', default: '#ffffff' },
  endTextColor: { type: 'color', label: 'End screen text colour', default: '#111111' },
  ctaBg: { type: 'color', label: 'Button colour', default: '#f2a902' },
  ctaColor: { type: 'color', label: 'Button text colour', default: '#111111' },
  backupShows: {
    type: 'select', label: 'Backup image shows', default: 'revealed',
    options: [['revealed', 'All images revealed'], ['covered', 'The covered tiles'], ['end', 'The end screen']],
  },
  ...HINT_FIELD,
  tapToExit: {
    type: 'toggle', label: 'Tap on a revealed image opens landing page', default: true,
    help: 'On phones, the first tap on a tile reveals it.',
  },
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const imgs = (slots.images ?? []).filter((s) => s.kind === 'image');
  const n = imgs.length > 0 ? imgs.length : 4;
  const cols = Math.max(1, Math.min(4, Math.round(Number(p.cols))));
  const rows = Math.ceil(n / cols);
  const shows = String(p.backupShows);
  const open = backup && shows === 'revealed';
  const tiles = Array.from({ length: n }, (_, i) =>
    `<div class="bhr-t${open ? ' bhr-on' : ''}" data-t="${i}"><div class="bhr-img">${faceContent(imgs[i], String(p.fit), i, String(i + 1))}</div>` +
    `<div class="bhr-cov"><span>${escapeText(String(p.coverText))}</span></div></div>`).join('');
  const cta = String(p.endCta).trim();
  const end = `<div class="bhr-end${backup && shows === 'end' ? ' bhr-show' : ''}"><p class="bhr-end-t">${escapeText(String(p.endTitle))}</p>` +
    `${cta ? `<button type="button" class="bhr-cta" data-cta="1">${escapeText(cta)}</button>` : ''}</div>`;
  const gap = px(Number(p.gap));
  const sel = ctx.sel;
  const css = [
    rule(`${sel} .bhr-grid`, { 'grid-template-columns': `repeat(${cols},1fr)`, 'grid-template-rows': `repeat(${rows},1fr)`, gap, padding: gap }),
    rule(`${sel} .bhr-cov`, {
      background: safeColor(String(p.coverColor), '#111'), color: safeColor(String(p.coverTextColor), '#fff'),
      'font-size': px(round(Math.min(ctx.width / cols, ctx.height / rows) * 0.35, 1)),
    }),
    rule(`${sel} .bhr-end`, { background: safeColor(String(p.endBg), '#fff'), color: safeColor(String(p.endTextColor), '#111') }),
    rule(`${sel} .bhr-cta`, { background: safeColor(String(p.ctaBg), '#f2a902'), color: safeColor(String(p.ctaColor), '#111') }),
  ].join('\n');
  return {
    html: `<div class="bhr" data-anim="${escapeHtml(String(p.revealAnim))}"><div class="bhr-grid">${tiles}</div>${end}</div>`,
    css,
  };
}

const RUNTIME = String.raw`bannr.define('hoverreveal', function (el, p) {
  var root = el.querySelector('.bhr');
  if (!root) return null;
  var tiles = root.querySelectorAll('.bhr-t'), n = tiles.length, end = root.querySelector('.bhr-end');
  if (!n) return null;
  var on = {}, count = 0, started = false, shown = false, t = 0, wait = -1, downT = null;
  var limit = Math.max(0, Number(p.timeout) || 0) * 1000, delay = Math.max(0, Number(p.endDelay) || 0) * 1000;
  el.style.touchAction = 'pan-y';
  function near(e, sel) { var x = e && e.closest ? e.closest(sel) : null; return x; }
  function show() { if (shown) return; shown = true; if (end) end.classList.add('bhr-show'); bannr.track('end_screen'); }
  function reveal(tile) {
    var i = tile.getAttribute('data-t');
    if (on[i]) return false;
    on[i] = 1; count++;
    tile.classList.add('bhr-on');
    if (!started) { started = true; bannr.track('interaction_start'); }
    bannr.track('reveal');
    if (count >= n) { bannr.track('reveal_all'); wait = delay; lp.start(); }
    return true;
  }
  var lp = bannr.loop(function (dt) {
    if (shown) { lp.stop(); return; }
    if (wait >= 0) { wait -= dt; if (wait <= 0) { show(); lp.stop(); } return; }
    if (limit > 0) { t += dt; if (t >= limit) { show(); lp.stop(); } } else lp.stop();
  });
  lp.start();
  function hover(e) { if (e.pointerType !== 'mouse' || shown) return; var tl = near(e.target, '[data-t]'); if (tl) reveal(tl); }
  function down(e) { downT = e.target || null; }
  el.addEventListener('pointermove', hover);
  el.addEventListener('pointerdown', down);
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var off = bannr.gesture(el, {
    start: function () { stopHint(); },
    tap: function () {
      if (near(downT, '[data-cta]')) { bannr.exit(); return true; }
      if (shown) return false;
      var tl = near(downT, '[data-t]');
      return !!(tl && reveal(tl));
    }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () {
    lp.stop(); off(); stopHint();
    el.removeEventListener('pointermove', hover);
    el.removeEventListener('pointerdown', down);
  } };
});`;

export const hoverreveal: ComponentDefinition = {
  type: 'hoverreveal',
  version: 1,
  label: 'Hover Reveal',
  category: 'reveal',
  description: 'Hidden images revealed on hover (or tap on phones), then an end screen with a CTA.',
  icon: '▦',
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 120, height: 100 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [{ name: 'images', label: 'Images to reveal', kind: 'image', required: true, min: 2, max: 6 }],
  capturesPointer: true,
  emits: ['interaction_start', 'reveal', 'reveal_all', 'end_screen'],
  weightBudgetKB: 6,
  styles:
    '.bhr{position:relative;width:100%;height:100%;overflow:hidden}' +
    '.bhr-grid{position:absolute;inset:0;display:grid;box-sizing:border-box}' +
    '.bhr-t{position:relative;overflow:hidden;border-radius:6px;cursor:pointer}.bhr-img,.bhr-cov{position:absolute;inset:0}' +
    '.bhr img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' +
    '.bhr-cov{display:grid;place-items:center;font-weight:900;font-family:Arial,sans-serif;transition:opacity .4s ease,transform .4s ease}' +
    '.bhr-on .bhr-cov{opacity:0;pointer-events:none}.bhr[data-anim="zoom"] .bhr-on .bhr-cov{transform:scale(1.4)}' +
    '.bhr-end{position:absolute;inset:0;z-index:200;display:none;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:12px;padding:10%;text-align:center}.bhr-end.bhr-show{display:flex}' +
    '.bhr-end-t{margin:0;font:700 18px/1.25 Arial,sans-serif}' +
    '.bhr-cta{padding:10px 18px;border:0;border-radius:6px;font:700 15px Arial,sans-serif;cursor:pointer}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
