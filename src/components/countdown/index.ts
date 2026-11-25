import { fontStack, px, rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import { TIME_ZONES, zonedToEpoch } from '../time';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, SettingsSchema } from '../types';

const SCHEMA: SettingsSchema = {
  endDate: { type: 'date', label: 'Ends at', default: '2026-12-31T23:59' },
  timeZone: {
    type: 'select', label: 'Time zone', default: 'Europe/Prague', options: TIME_ZONES,
    help: 'An explicit time zone makes the countdown end at the same moment everywhere.',
  },
  showDays: { type: 'toggle', label: 'Show days', default: true },
  showHours: { type: 'toggle', label: 'Show hours', default: true },
  showMinutes: { type: 'toggle', label: 'Show minutes', default: true },
  showSeconds: { type: 'toggle', label: 'Show seconds', default: true },
  labelDays: { type: 'text', label: 'Days label', default: 'Days', maxLength: 12 },
  labelHours: { type: 'text', label: 'Hours label', default: 'Hours', maxLength: 12 },
  labelMinutes: { type: 'text', label: 'Minutes label', default: 'Min', maxLength: 12 },
  labelSeconds: { type: 'text', label: 'Seconds label', default: 'Sec', maxLength: 12 },
  endText: { type: 'text', label: 'When finished', default: 'Sale is live!', maxLength: 60 },
  backupText: { type: 'text', label: 'Backup image text', default: 'Limited time offer', maxLength: 60 },
  fontFamily: { type: 'font', label: 'Font', default: 'Arial' },
  fontSize: { type: 'number', label: 'Number size', default: 40, min: 8, max: 200, suffix: 'px' },
  color: { type: 'color', label: 'Number colour', default: '#111111' },
  boxColor: { type: 'color', label: 'Box colour', default: '#ffffff' },
  labelColor: { type: 'color', label: 'Label colour', default: '#666666' },
};

const UNITS = [
  ['d', 'showDays', 'labelDays'], ['h', 'showHours', 'labelHours'],
  ['m', 'showMinutes', 'labelMinutes'], ['s', 'showSeconds', 'labelSeconds'],
] as const;

/** Edit mode shows "--"; the live banner fills in the real numbers; the backup shows backupText. */
function output(p: ResolvedProps, ctx: ComponentRenderCtx, backup: boolean) {
  let shown = UNITS.filter(([, k]) => p[k] === true);
  if (shown.length === 0) shown = UNITS.slice(3);
  const wall = String(p.endDate);
  const tz = String(p.timeZone);
  const local = tz === 'local';
  const end = local ? '' : String(zonedToEpoch(wall, tz));
  const units = shown
    .map(([u, , l]) => `<div class="bc-cd-u"><span class="bc-cd-n" data-u="${u}">--</span><span class="bc-cd-l">${escapeText(String(p[l]))}</span></div>`)
    .join('');
  const body = backup
    ? `<div class="bc-cd-end bc-cd-show">${escapeText(String(p.backupText))}</div>`
    : `<div class="bc-cd-units">${units}</div><div class="bc-cd-end">${escapeText(String(p.endText))}</div>`;
  const size = Number(p.fontSize);
  const css = [
    rule(`${ctx.sel} .bc-cd`, { 'font-family': fontStack(String(p.fontFamily)), color: safeColor(String(p.color), '#111') }),
    rule(`${ctx.sel} .bc-cd-n`, { 'font-size': px(size), 'font-weight': 700, background: safeColor(String(p.boxColor)) }),
    rule(`${ctx.sel} .bc-cd-l`, { 'font-size': px(Math.max(8, size * 0.3)), color: safeColor(String(p.labelColor), '#666') }),
    rule(`${ctx.sel} .bc-cd-end`, { 'font-size': px(Math.max(8, size * 0.6)), 'font-weight': 700 }),
  ].join('\n');
  return {
    html: `<div class="bc-cd" data-end="${escapeHtml(end)}" data-wall="${escapeHtml(wall)}" data-local="${local ? '1' : '0'}">${body}</div>`,
    css,
  };
}

const RUNTIME = String.raw`bannr.define('countdown', function (el) {
  var box = el.querySelector('.bc-cd');
  if (!box) return null;
  var end = box.getAttribute('data-local') === '1'
    ? new Date(box.getAttribute('data-wall') || '').getTime()
    : Number(box.getAttribute('data-end'));
  if (!isFinite(end)) return null;
  var SZ = { d: 86400, h: 3600, m: 60, s: 1 }, ns = box.querySelectorAll('[data-u]'), last = -1, lp = null, ended = false;
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tick() {
    var left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    if (left === last) return;
    last = left;
    if (left === 0) {
      if (!ended) { ended = true; box.classList.add('bc-cd-done'); bannr.track('countdown_end'); }
      if (lp) lp.stop();
      return;
    }
    var rem = left;
    for (var i = 0; i < ns.length; i++) {
      var sz = SZ[ns[i].getAttribute('data-u')] || 1, v = Math.floor(rem / sz);
      rem -= v * sz;
      ns[i].textContent = pad(v);
    }
  }
  tick();
  if (ended) return null;
  lp = bannr.loop(tick);
  lp.start();
  return { destroy: function () { lp.stop(); } };
});`;

export const countdown: ComponentDefinition = {
  type: 'countdown',
  version: 1,
  label: 'Countdown',
  category: 'widget',
  description: 'A timer to a set date and time, with an end message.',
  icon: '⏳',
  defaultSize: { width: 320, height: 100 },
  minSize: { width: 80, height: 30 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [],
  capturesPointer: false,
  emits: ['countdown_end'],
  weightBudgetKB: 4,
  styles:
    '.bc-cd{display:flex;align-items:center;justify-content:center;width:100%;height:100%;line-height:1}' +
    '.bc-cd-units{display:flex;gap:8px}.bc-cd-u{display:flex;flex-direction:column;align-items:center;gap:4px}' +
    '.bc-cd-n{min-width:1.6em;padding:.15em .2em;border-radius:6px;text-align:center;font-variant-numeric:tabular-nums}' +
    '.bc-cd-l{text-transform:uppercase;letter-spacing:.05em}.bc-cd-end{display:none;text-align:center}' +
    '.bc-cd-show,.bc-cd-done .bc-cd-end{display:block}.bc-cd-done .bc-cd-units{display:none}',
  render: (p, _s, ctx) => output(p, ctx, false),
  runtime: RUNTIME,
  backupState: (p, _s, ctx) => output(p, ctx, true),
};
