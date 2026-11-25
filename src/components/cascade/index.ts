import { px, rule } from '@/renderer/css';
import { escapeHtml } from '@/renderer/escape';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, ResolvedSlots, SettingsSchema } from '../types';

const SCHEMA: SettingsSchema = {
  layout: { type: 'select', label: 'Layout', default: 'row', options: [['row', 'Row'], ['column', 'Column']] },
  direction: { type: 'select', label: 'Fly in from', default: 'top', options: [['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right']] },
  distance: { type: 'number', label: 'Distance', default: 80, min: 0, max: 600, suffix: 'px' },
  stagger: { type: 'slider', label: 'Stagger', default: 0.2, min: 0, max: 2, step: 0.05, suffix: 's' },
  duration: { type: 'slider', label: 'Duration', default: 0.6, min: 0.1, max: 3, step: 0.05, suffix: 's' },
  easing: { type: 'select', label: 'Easing', default: 'easeOut', options: [['easeOut', 'Ease out'], ['back', 'Back (overshoot)'], ['linear', 'Linear']] },
  plays: { type: 'number', label: 'Plays', default: 1, min: 1, max: 3, step: 1, help: 'How many times the sequence runs.' },
  gap: { type: 'number', label: 'Gap', default: 8, min: 0, max: 100, suffix: 'px' },
  fit: { type: 'select', label: 'Image fit', default: 'contain', options: [['contain', 'Contain'], ['cover', 'Cover']] },
};

const OFF: Record<string, (d: number) => string> = {
  top: (d) => `translateY(${-d}px)`, bottom: (d) => `translateY(${d}px)`,
  left: (d) => `translateX(${-d}px)`, right: (d) => `translateX(${d}px)`,
};

/** Edit mode and backup show every image in place; the live banner flies them in. */
function output(p: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx) {
  const imgs = (slots.images ?? []).filter((s) => s.kind === 'image');
  const items = imgs.length > 0
    ? imgs.map((s) => (s.kind === 'image' ? `<div class="bc-cas-item"><img src="${escapeHtml(s.src)}" alt=""></div>` : '')).join('')
    : '<div class="bc-cas-item bc-cas-ph"></div>'.repeat(3);
  const off = (OFF[String(p.direction)] ?? ((d: number) => `translateY(${-d}px)`))(Number(p.distance));
  const css = [
    rule(`${ctx.sel} .bc-cas`, { 'flex-direction': p.layout === 'column' ? 'column' : 'row', gap: px(Number(p.gap)), '--bc-off': off }),
    rule(`${ctx.sel} .bc-cas-item img`, { 'object-fit': p.fit === 'cover' ? 'cover' : 'contain' }),
  ].join('\n');
  return { html: `<div class="bc-cas">${items}</div>`, css };
}

const RUNTIME = String.raw`bannr.define('cascade', function (el, p) {
  var box = el.querySelector('.bc-cas');
  if (!box) return null;
  var items = box.querySelectorAll('.bc-cas-item');
  var E = { easeOut: 'cubic-bezier(.22,1,.36,1)', back: 'cubic-bezier(.34,1.56,.64,1)', linear: 'linear' };
  var ease = E[p.easing] || E.easeOut;
  var st = Math.max(0, Number(p.stagger) || 0), du = Math.max(0.05, Number(p.duration) || 0.6);
  var runs = Math.max(1, Math.round(Number(p.plays) || 1)), done = 0, t = 0;
  var total = ((items.length - 1) * st + du + 1.5) * 1000;
  if (bannr.reducedMotion || !items.length) { bannr.track('cascade_complete'); return null; }
  function set(on) {
    for (var i = 0; i < items.length; i++) {
      var d = (i * st) + 's';
      items[i].style.transition = on ? 'transform ' + du + 's ' + ease + ' ' + d + ',opacity ' + du + 's ' + ease + ' ' + d : 'none';
    }
  }
  function play() { set(false); box.classList.add('bc-off'); void box.offsetWidth; set(true); box.classList.remove('bc-off'); }
  play();
  var lp = bannr.loop(function (dt) {
    t += dt;
    if (t < total) return;
    t = 0; done++;
    if (done === 1) bannr.track('cascade_complete');
    if (done >= runs) { lp.stop(); return; }
    play();
  });
  lp.start();
  return { destroy: lp.stop };
});`;

export const cascade: ComponentDefinition = {
  type: 'cascade',
  version: 1,
  label: 'Cascade',
  category: 'motion',
  description: 'Images fly in one after another.',
  icon: '⇣',
  defaultSize: { width: 360, height: 140 },
  minSize: { width: 60, height: 40 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [{ name: 'images', label: 'Images', kind: 'image', required: true, min: 1, max: 6 }],
  capturesPointer: false,
  emits: ['cascade_complete'],
  weightBudgetKB: 3,
  styles:
    '.bc-cas{display:flex;width:100%;height:100%}.bc-cas-item{flex:1;min-width:0;min-height:0}' +
    '.bc-cas-item img{display:block;width:100%;height:100%}' +
    '.bc-cas-ph{border-radius:4px;background:repeating-linear-gradient(45deg,#ddd 0 8px,#eee 8px 16px)}' +
    '.bc-off .bc-cas-item{opacity:0;transform:var(--bc-off)}',
  render: (p, slots, ctx) => output(p, slots, ctx),
  runtime: RUNTIME,
  backupState: (p, slots, ctx) => output(p, slots, ctx),
};
