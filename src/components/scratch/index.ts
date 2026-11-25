import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import { HINT_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/**
 * SCRATCH: a cover drawn on a canvas is scratched away to reveal the content underneath.
 * Edit mode and the backup use a static cover (no canvas); the live banner paints the cover onto the canvas.
 */
const SCHEMA: SettingsSchema = {
  coverColor: { type: 'color', label: 'Cover colour', default: '#c0c0c0' },
  coverText: { type: 'text', label: 'Cover text', default: 'Scratch here!', maxLength: 40 },
  textColor: { type: 'color', label: 'Cover text colour', default: '#555555' },
  textSize: { type: 'number', label: 'Cover text size', default: 9, min: 3, max: 30, suffix: '% of height' },
  brushSize: { type: 'number', label: 'Brush size', default: 36, min: 8, max: 120, suffix: 'px' },
  revealAt: {
    type: 'number', label: 'Reveal at', default: 50, min: 5, max: 95, suffix: '%',
    help: 'When this much of the cover is scratched, the rest disappears on its own.',
  },
  revealAnim: { type: 'select', label: 'Reveal', default: 'fade', options: [['fade', 'Fade out'], ['instant', 'Instantly']] },
  fit: { type: 'select', label: 'Hidden image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  backupShows: {
    type: 'select', label: 'Backup image shows', default: 'reveal',
    options: [['reveal', 'The hidden content'], ['cover', 'The cover']],
  },
  ...HINT_FIELD,
  tapToExit: {
    type: 'toggle', label: 'Tap opens landing page after the reveal', default: true,
    help: 'Before the reveal, taps and drags only scratch.',
  },
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, live: boolean) {
  const hidden = `<div class="bsc-r" data-rv="1">${faceContent(slots.reveal?.[0], String(p.fit), 0, 'Prize')}</div>`;
  const ci = slots.cover?.[0];
  const coverImg = ci && ci.kind === 'image' ? `<img src="${escapeHtml(ci.src)}" alt="" draggable="false">` : '';
  const tx = String(p.coverText).trim();
  const cover = `<div class="bsc-cov" data-cov="1">${coverImg}${tx ? `<span class="bsc-tx">${escapeText(tx)}</span>` : ''}</div>`;
  const showCover = live || p.backupShows === 'cover';
  const canvas = live ? '<canvas class="bsc-cv" data-cv="1"></canvas>' : '';
  const css = [
    rule(`${ctx.sel} .bsc-cov`, { background: safeColor(String(p.coverColor), '#c0c0c0') }),
    rule(`${ctx.sel} .bsc-tx`, {
      color: safeColor(String(p.textColor), '#555'),
      'font-size': px(round((ctx.height * Number(p.textSize)) / 100, 1)),
    }),
  ].join('\n');
  return { html: `<div class="bsc">${hidden}${showCover ? cover : ''}${canvas}</div>`, css };
}

const RUNTIME = String.raw`bannr.define('scratch', function (el, p) {
  var root = el.querySelector('.bsc'), cv = el.querySelector('.bsc-cv'), cov = el.querySelector('.bsc-cov');
  if (!root || !cv || !cv.getContext) return null;
  var c = cv.getContext('2d', { willReadFrequently: true });
  if (!c) return null;
  var w = el.offsetWidth || 300, h = el.offsetHeight || 250, dpr = Math.min(2, window.devicePixelRatio || 1);
  var brush = Math.max(4, Number(p.brushSize) || 36), at = Math.max(1, Math.min(100, Number(p.revealAt) || 50)) / 100;
  var started = false, revealed = false, last = null, moves = 0, painted = 0;
  el.style.touchAction = 'none';
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  function paintCover() {
    if (started) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = String(p.coverColor || '#c0c0c0');
    c.fillRect(0, 0, w, h);
    var ci = cov && cov.querySelector ? cov.querySelector('img') : null;
    if (ci && ci.complete && ci.naturalWidth) {
      var s = Math.max(w / ci.naturalWidth, h / ci.naturalHeight);
      try { c.drawImage(ci, (w - ci.naturalWidth * s) / 2, (h - ci.naturalHeight * s) / 2, ci.naturalWidth * s, ci.naturalHeight * s); } catch (e) {}
    } else if (ci) {
      ci.addEventListener('load', paintCover);
    }
    var tx = String(p.coverText || '').trim();
    if (tx) {
      c.fillStyle = String(p.textColor || '#555');
      c.font = '700 ' + Math.round(h * (Number(p.textSize) || 9) / 100) + 'px Arial,sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(tx, w / 2, h / 2);
    }
    if (cov) cov.style.visibility = 'hidden';
  }
  function pt(e) { var r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function scratch(q) {
    c.globalCompositeOperation = 'destination-out';
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = brush;
    c.beginPath();
    if (last) { c.moveTo(last[0], last[1]); c.lineTo(q[0], q[1]); painted += Math.hypot(q[0] - last[0], q[1] - last[1]) * brush; }
    else { c.moveTo(q[0], q[1]); c.lineTo(q[0] + 0.1, q[1]); painted += brush * brush * 0.8; }
    c.stroke();
    last = q;
  }
  function cleared() {
    try {
      var d = c.getImageData(0, 0, cv.width, cv.height).data, n = 0, k = 0;
      for (var i = 3; i < d.length; i += 64) { k++; if (d[i] < 128) n++; }
      return k ? n / k : 0;
    } catch (e) { return Math.min(1, painted / (w * h)); }
  }
  function reveal() {
    revealed = true;
    cv.style.transition = p.revealAnim === 'instant' ? 'none' : 'opacity .5s ease';
    cv.style.opacity = '0';
    cv.style.pointerEvents = 'none';
    el.style.touchAction = 'pan-y';
    bannr.track('reveal_complete');
  }
  function check() { if (!revealed && cleared() >= at) reveal(); }
  paintCover();
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var off = bannr.gesture(el, {
    start: function (e) {
      stopHint();
      if (revealed) return;
      if (!started) { started = true; bannr.track('interaction_start'); }
      last = null;
      scratch(pt(e));
    },
    move: function (g) { if (revealed) return; scratch(pt(g.event)); moves++; if (moves % 8 === 0) check(); },
    end: function () { last = null; check(); },
    tap: function () { var was = revealed; last = null; check(); return !was; }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () { off(); stopHint(); } };
});`;

export const scratch: ComponentDefinition = {
  type: 'scratch',
  version: 1,
  label: 'Scratch',
  category: 'reveal',
  description: 'Scratch off a cover with a finger or mouse to reveal what is underneath.',
  icon: '▨',
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 100, height: 80 },
  recommendedSizes: ['480x480', '300x250', '300x600', '320x480'],
  settingsSchema: SCHEMA,
  slots: [
    { name: 'reveal', label: 'Hidden content', kind: 'image', required: true, max: 1 },
    { name: 'cover', label: 'Cover image (optional)', kind: 'image', max: 1 },
  ],
  capturesPointer: true,
  emits: ['interaction_start', 'reveal_complete'],
  weightBudgetKB: 6,
  styles:
    '.bsc{position:relative;width:100%;height:100%;overflow:hidden}' +
    '.bsc-r,.bsc-cov,.bsc-cv{position:absolute;inset:0;width:100%;height:100%}' +
    '.bsc-r img{display:block;width:100%;height:100%}' +
    '.bsc-cov{display:grid;place-items:center;overflow:hidden}' +
    '.bsc-cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
    '.bsc-tx{position:relative;padding:0 6%;font-weight:700;font-family:Arial,sans-serif;text-align:center}' +
    '.bsc-cv{display:block;cursor:crosshair}.bsc img{-webkit-user-drag:none;user-select:none}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, true),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, false),
};
