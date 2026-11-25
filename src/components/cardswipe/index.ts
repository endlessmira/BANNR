import { rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import { HINT_FIELD, TAP_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/** CARD SWIPE: swipe product cards right (like) or left (dislike); an end screen with a CTA follows. */
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Position of a card o places below the top of the stack. The runtime uses the same formula. */
export function placeCard(o: number): { t: string; op: number; z: number } {
  return { t: `translateY(${r3(o * 4)}%) scale(${r3(Math.max(0.5, 1 - o * 0.05))})`, op: o > 2 ? 0 : 1, z: 100 - o };
}

const SCHEMA: SettingsSchema = {
  likeLabel: { type: 'text', label: 'Like label', default: 'LIKE', maxLength: 16 },
  dislikeLabel: { type: 'text', label: 'Dislike label', default: 'NOPE', maxLength: 16 },
  likeColor: { type: 'color', label: 'Like colour', default: '#16a34a' },
  dislikeColor: { type: 'color', label: 'Dislike colour', default: '#e5484d' },
  showButtons: { type: 'toggle', label: 'Like and dislike buttons', default: true },
  cardScale: { type: 'slider', label: 'Card size', default: 78, min: 50, max: 100, step: 2, suffix: '%' },
  fit: { type: 'select', label: 'Image fit', default: 'cover', options: [['cover', 'Cover'], ['contain', 'Contain']] },
  bgColor: { type: 'color', label: 'Background colour', default: 'transparent' },
  endTitle: { type: 'text', label: 'End screen title', default: 'Thanks! Here are your favourites.', maxLength: 80 },
  endCta: { type: 'text', label: 'End screen button', default: 'Shop now', maxLength: 30, help: 'Always opens the landing page. Leave empty to hide it.' },
  endBg: { type: 'color', label: 'End screen background', default: '#ffffff' },
  endTextColor: { type: 'color', label: 'End screen text colour', default: '#111111' },
  ctaBg: { type: 'color', label: 'Button colour', default: '#f2a902' },
  ctaColor: { type: 'color', label: 'Button text colour', default: '#111111' },
  ...HINT_FIELD,
  ...TAP_FIELD,
};

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const imgs = (slots.cards ?? []).filter((s) => s.kind === 'image');
  const n = imgs.length > 0 ? imgs.length : 4;
  const shown = backup ? 1 : n;
  const like = String(p.likeLabel);
  const nope = String(p.dislikeLabel);
  const cards: string[] = [];
  for (let i = 0; i < shown; i++) {
    const q = placeCard(i);
    cards.push(
      `<div class="bsw-c" data-c="${i}" style="transform:${q.t};opacity:${q.op};z-index:${q.z}">` +
      `${faceContent(imgs[i], String(p.fit), i, String(i + 1))}` +
      `<span class="bsw-st bsw-like">${escapeText(like)}</span><span class="bsw-st bsw-nope">${escapeText(nope)}</span></div>`,
    );
  }
  const btns = !backup && p.showButtons === true
    ? '<div class="bsw-btns">' +
      `<button type="button" class="bsw-btn bsw-no" data-vote="dislike" aria-label="${escapeHtml(nope)}">✕</button>` +
      `<button type="button" class="bsw-btn bsw-yes" data-vote="like" aria-label="${escapeHtml(like)}">♥</button></div>`
    : '';
  const cta = String(p.endCta).trim();
  const end = backup
    ? ''
    : `<div class="bsw-end"><p class="bsw-end-t">${escapeText(String(p.endTitle))}</p>` +
      `${cta ? `<button type="button" class="bsw-cta" data-cta="1">${escapeText(cta)}</button>` : ''}</div>`;
  const sel = ctx.sel;
  const scale = Number(p.cardScale);
  const css = [
    rule(`${sel} .bsw`, { background: safeColor(String(p.bgColor)) }),
    rule(`${sel} .bsw-stack`, { bottom: btns ? '16%' : '0' }),
    rule(`${sel} .bsw-c`, { width: `${scale}%`, height: `${scale}%` }),
    rule(`${sel} .bsw-like`, { color: safeColor(String(p.likeColor), '#16a34a') }),
    rule(`${sel} .bsw-nope`, { color: safeColor(String(p.dislikeColor), '#e5484d') }),
    rule(`${sel} .bsw-yes`, { background: safeColor(String(p.likeColor), '#16a34a') }),
    rule(`${sel} .bsw-no`, { background: safeColor(String(p.dislikeColor), '#e5484d') }),
    rule(`${sel} .bsw-end`, { background: safeColor(String(p.endBg), '#fff'), color: safeColor(String(p.endTextColor), '#111') }),
    rule(`${sel} .bsw-cta`, { background: safeColor(String(p.ctaBg), '#f2a902'), color: safeColor(String(p.ctaColor), '#111') }),
  ].join('\n');
  return { html: `<div class="bsw"><div class="bsw-stack">${cards.join('')}</div>${btns}${end}</div>`, css };
}

const RUNTIME = String.raw`bannr.define('cardswipe', function (el, p) {
  var root = el.querySelector('.bsw');
  if (!root) return null;
  var cards = root.querySelectorAll('.bsw-c'), n = cards.length;
  if (!n) return null;
  var end = root.querySelector('.bsw-end');
  var k = 0, dragging = false, started = false, w = 1, downT = null;
  el.style.touchAction = 'pan-y';
  function r(v) { return Math.round(v * 1000) / 1000; }
  function layout(anim) {
    for (var i = k; i < n; i++) {
      var o = i - k, s = cards[i].style;
      s.transition = anim ? 'transform .3s ease,opacity .3s ease' : 'none';
      s.transform = 'translateY(' + r(o * 4) + '%) scale(' + r(Math.max(0.5, 1 - o * 0.05)) + ')';
      s.opacity = o > 2 ? '0' : '1';
      s.zIndex = String(100 - o);
    }
  }
  function stamps(c, v) {
    var l = c.querySelector('.bsw-like'), d = c.querySelector('.bsw-nope');
    if (l) l.style.opacity = String(Math.max(0, v));
    if (d) d.style.opacity = String(Math.max(0, -v));
  }
  function first() { if (!started) { started = true; bannr.track('interaction_start'); } }
  function vote(dir) {
    if (k >= n) return;
    var c = cards[k];
    c.style.transition = 'transform .35s ease-in,opacity .35s ease-in';
    c.style.transform = 'translateX(' + (dir * 150) + '%) rotate(' + (dir * 25) + 'deg)';
    c.style.opacity = '0';
    stamps(c, dir);
    bannr.track(dir > 0 ? 'like' : 'dislike');
    k++;
    layout(true);
    if (k >= n) { if (end) end.classList.add('bsw-show'); bannr.track('swipe_complete'); }
  }
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  function down(e) { downT = e.target || null; }
  el.addEventListener('pointerdown', down);
  layout(false);
  var off = bannr.gesture(el, {
    start: function () { stopHint(); },
    move: function (g) {
      if (k >= n) return;
      if (!dragging) { dragging = true; w = el.offsetWidth || 1; first(); }
      var c = cards[k];
      c.style.transition = 'none';
      c.style.transform = 'translateX(' + g.dx + 'px) rotate(' + r((g.dx / w) * 20) + 'deg)';
      stamps(c, Math.max(-1, Math.min(1, g.dx / (w * 0.3))));
    },
    end: function (g) {
      if (!dragging) return;
      dragging = false;
      if (k >= n) return;
      if (Math.abs(g.dx) > w * 0.3 || Math.abs(g.vx || 0) > 0.5) {
        var dir = Math.abs(g.dx) > w * 0.3 ? g.dx : g.vx;
        vote(dir > 0 ? 1 : -1);
      } else {
        stamps(cards[k], 0);
        layout(true);
      }
    },
    tap: function () {
      var b = downT && downT.closest ? downT.closest('[data-vote],[data-cta]') : null;
      if (!b) return false;
      if (b.getAttribute('data-cta')) { bannr.exit(); return true; }
      if (k >= n) return true;
      first();
      vote(b.getAttribute('data-vote') === 'like' ? 1 : -1);
      return true;
    }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () { off(); stopHint(); el.removeEventListener('pointerdown', down); } };
});`;

export const cardswipe: ComponentDefinition = {
  type: 'cardswipe',
  version: 1,
  label: 'Card Swipe',
  category: 'carousel',
  description: 'Swipe product cards right to like or left to dislike, then show an end screen with a CTA.',
  icon: '♥',
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 160, height: 160 },
  recommendedSizes: ['480x480', '300x600', '320x480', '300x250'],
  settingsSchema: SCHEMA,
  slots: [{ name: 'cards', label: 'Cards', kind: 'image', required: true, min: 2, max: 8 }],
  capturesPointer: true,
  emits: ['interaction_start', 'like', 'dislike', 'swipe_complete'],
  weightBudgetKB: 8,
  styles:
    '.bsw{position:relative;width:100%;height:100%;overflow:hidden}.bsw-stack{position:absolute;inset:0}' +
    '.bsw-c{position:absolute;inset:0;margin:auto;overflow:hidden;border-radius:12px;background:#fff;' +
    'box-shadow:0 6px 18px rgba(0,0,0,.25);will-change:transform}' +
    '.bsw-c img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' +
    '.bsw-st{position:absolute;top:8%;padding:2px 10px;border:3px solid currentColor;border-radius:6px;' +
    'font:900 22px Arial,sans-serif;letter-spacing:.05em;opacity:0;pointer-events:none}' +
    '.bsw-like{left:8%;transform:rotate(-15deg)}.bsw-nope{right:8%;transform:rotate(15deg)}' +
    '.bsw-btns{position:absolute;left:0;right:0;bottom:3%;z-index:150;display:flex;justify-content:center;gap:16px}' +
    '.bsw-btn{width:44px;height:44px;padding:0;border:0;border-radius:50%;color:#fff;font:700 20px/44px Arial,sans-serif;' +
    'cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.25)}' +
    '.bsw-end{position:absolute;inset:0;z-index:200;display:none;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:12px;padding:10%;text-align:center}.bsw-end.bsw-show{display:flex}' +
    '.bsw-end-t{margin:0;font:700 18px/1.25 Arial,sans-serif}' +
    '.bsw-cta{padding:10px 18px;border:0;border-radius:6px;font:700 15px Arial,sans-serif;cursor:pointer}' + THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
