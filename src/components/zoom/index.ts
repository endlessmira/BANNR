import { px, round, rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import { HINT_FIELD, TAP_FIELD, THREE_CSS, faceContent } from '../three';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

/**
 * ZOOM: a magnifier lens. The lens holds a scaled copy of the image layer, so the zoomed view matches
 * any image fit exactly. Edit mode and the backup show the lens in the centre.
 */
const SCHEMA: SettingsSchema = {
  zoom: { type: 'slider', label: 'Zoom level', default: 2.5, min: 1.5, max: 6, step: 0.5, suffix: '×' },
  lensSize: { type: 'number', label: 'Lens size', default: 120, min: 40, max: 400, suffix: 'px' },
  shape: { type: 'select', label: 'Lens shape', default: 'circle', options: [['circle', 'Circle'], ['rounded', 'Rounded square'], ['square', 'Square']] },
  borderColor: { type: 'color', label: 'Lens border colour', default: '#ffffff' },
  borderWidth: { type: 'number', label: 'Lens border width', default: 3, min: 0, max: 12, suffix: 'px' },
  shadow: { type: 'toggle', label: 'Lens shadow', default: true },
  fit: { type: 'select', label: 'Image fit', default: 'contain', options: [['contain', 'Contain'], ['cover', 'Cover']] },
  bgColor: { type: 'color', label: 'Background colour', default: 'transparent' },
  tipText: {
    type: 'text', label: 'Tip text', default: 'Hover to zoom', maxLength: 40,
    help: 'Shown until the first interaction. Leave empty to hide.',
  },
  ...HINT_FIELD,
  ...TAP_FIELD,
};

const RADIUS: Record<string, string> = { circle: '50%', rounded: '18%', square: '0' };

function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx, backup: boolean) {
  const content = faceContent(slots.image?.[0], String(p.fit), 0, 'Product');
  const L = Number(p.lensSize);
  const z = Number(p.zoom);
  const cx = ctx.width / 2;
  const cy = ctx.height / 2;
  const lens = `left:${round(cx - L / 2)}px;top:${round(cy - L / 2)}px`;
  const inner = `width:${round(ctx.width)}px;height:${round(ctx.height)}px;transform:translate(${round(L / 2 - cx * z)}px,${round(L / 2 - cy * z)}px) scale(${z})`;
  const tipText = String(p.tipText).trim();
  const tip = !backup && tipText ? `<span class="bzm-tip">${escapeText(tipText)}</span>` : '';
  const bw = Number(p.borderWidth);
  const css = [
    rule(`${ctx.sel} .bzm`, { background: safeColor(String(p.bgColor)) }),
    rule(`${ctx.sel} .bzm-lens`, {
      width: px(L), height: px(L), 'border-radius': RADIUS[String(p.shape)] ?? '50%',
      border: bw > 0 ? `${px(bw)} solid ${safeColor(String(p.borderColor), '#fff')}` : undefined,
      'box-shadow': p.shadow === true ? '0 6px 20px rgba(0,0,0,0.35)' : undefined,
    }),
  ].join('\n');
  return {
    html: `<div class="bzm bzm-on" data-shape="${escapeHtml(String(p.shape))}"><div class="bzm-base">${content}</div>` +
      `<div class="bzm-lens" data-lens="1" style="${lens}"><div class="bzm-in" style="${inner}">${content}</div></div>${tip}</div>`,
    css,
  };
}

const RUNTIME = String.raw`bannr.define('zoom', function (el, p) {
  var root = el.querySelector('.bzm'), lens = el.querySelector('.bzm-lens'), inner = el.querySelector('.bzm-in'), tip = el.querySelector('.bzm-tip');
  if (!root || !lens || !inner) return null;
  var z = Math.max(1, Number(p.zoom) || 2.5), L = Math.max(10, Number(p.lensSize) || 120);
  var vis = false, started = false, idle = 0, downE = null;
  el.style.touchAction = 'pan-y';
  root.classList.remove('bzm-on');
  function at(e) {
    var r = el.getBoundingClientRect(), w = r.width || 1, h = r.height || 1;
    var x = Math.max(0, Math.min(w, e.clientX - r.left)), y = Math.max(0, Math.min(h, e.clientY - r.top));
    lens.style.left = (x - L / 2) + 'px';
    lens.style.top = (y - L / 2) + 'px';
    inner.style.transform = 'translate(' + (L / 2 - x * z) + 'px,' + (L / 2 - y * z) + 'px) scale(' + z + ')';
  }
  function show(e) {
    at(e);
    if (vis) return;
    vis = true;
    root.classList.add('bzm-on');
    if (tip) tip.style.opacity = '0';
    if (!started) { started = true; bannr.track('interaction_start'); }
    bannr.track('zoom');
  }
  function hide() { if (vis) { vis = false; root.classList.remove('bzm-on'); } }
  var lp = bannr.loop(function (dt) { idle -= dt; if (idle <= 0) { hide(); lp.stop(); } });
  function keep() { idle = 3000; lp.start(); }
  function hover(e) { if (e.pointerType === 'mouse') show(e); }
  function leave(e) { if (e.pointerType === 'mouse') hide(); }
  function down(e) { downE = e; }
  el.addEventListener('pointermove', hover);
  el.addEventListener('pointerleave', leave);
  el.addEventListener('pointerdown', down);
  var stopHint = p.hint ? bannr.hint(root, 1500) : function () {};
  var off = bannr.gesture(el, {
    start: function () { stopHint(); },
    move: function (g) { if (g.event.pointerType !== 'mouse') { show(g.event); keep(); } },
    tap: function () {
      if (downE && downE.pointerType !== 'mouse' && !vis) { show(downE); keep(); return true; }
      return false;
    }
  }, { tapToExit: p.tapToExit !== false });
  return { destroy: function () {
    lp.stop(); off(); stopHint();
    el.removeEventListener('pointermove', hover);
    el.removeEventListener('pointerleave', leave);
    el.removeEventListener('pointerdown', down);
  } };
});`;

export const zoom: ComponentDefinition = {
  type: 'zoom',
  version: 1,
  label: 'Zoom',
  category: 'reveal',
  description: 'A magnifier lens over a product image.',
  icon: '⌕',
  defaultSize: { width: 300, height: 250 },
  minSize: { width: 100, height: 80 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [{ name: 'image', label: 'Product image', kind: 'image', required: true, max: 1 }],
  capturesPointer: true,
  emits: ['interaction_start', 'zoom'],
  weightBudgetKB: 6,
  styles:
    '.bzm{position:relative;width:100%;height:100%;overflow:hidden;cursor:zoom-in}.bzm-base{position:absolute;inset:0}' +
    '.bzm img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none}' +
    '.bzm-lens{position:absolute;z-index:5;overflow:hidden;box-sizing:border-box;pointer-events:none;opacity:0;' +
    'transition:opacity .15s ease;background:#fff}.bzm-on .bzm-lens{opacity:1}' +
    '.bzm-in{position:absolute;left:0;top:0;transform-origin:0 0}' +
    '.bzm-tip{position:absolute;left:50%;bottom:8px;z-index:6;transform:translateX(-50%);padding:4px 10px;border-radius:999px;' +
    'background:rgba(0,0,0,.6);color:#fff;font:700 12px Arial,sans-serif;white-space:nowrap;pointer-events:none;transition:opacity .3s}' +
    THREE_CSS,
  render: (p, s, ctx) => output(p, s, ctx, false),
  runtime: RUNTIME,
  backupState: (p, s, ctx) => output(p, s, ctx, true),
};
