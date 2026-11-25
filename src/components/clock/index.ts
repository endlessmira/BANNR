import { fontStack, px, rule, safeColor } from '@/renderer/css';
import { escapeHtml } from '@/renderer/escape';
import { TIME_ZONES } from '../time';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, SettingsSchema } from '../types';

const SCHEMA: SettingsSchema = {
  style: { type: 'select', label: 'Style', default: 'digital', options: [['digital', 'Digital'], ['analog', 'Analog']] },
  timeZone: { type: 'select', label: 'Time zone', default: 'local', options: TIME_ZONES },
  format: { type: 'select', label: 'Format', default: '24', options: [['24', '24-hour'], ['12', '12-hour']] },
  showSeconds: { type: 'toggle', label: 'Show seconds', default: false },
  fontFamily: { type: 'font', label: 'Font', default: 'Arial' },
  fontSize: { type: 'number', label: 'Font size', default: 48, min: 8, max: 300, suffix: 'px' },
  color: { type: 'color', label: 'Colour', default: '#111111' },
  faceColor: { type: 'color', label: 'Face colour (analog)', default: '#ffffff' },
  handColor: { type: 'color', label: 'Hand colour (analog)', default: '#111111' },
  accentColor: { type: 'color', label: 'Seconds hand (analog)', default: '#e5484d' },
};

/** Edit mode and backup show 10:10:30, the classic display time; the live banner shows the real time. */
function output(p: ResolvedProps, ctx: ComponentRenderCtx) {
  const tz = escapeHtml(String(p.timeZone));
  const color = safeColor(String(p.color), '#111');
  if (p.style === 'analog') {
    const d = Math.max(10, Math.min(ctx.width, ctx.height));
    const sec = p.showSeconds === true ? '<i class="bc-s" style="transform:rotate(180deg)"></i>' : '';
    return {
      html: `<div class="bc-clk" data-tz="${tz}"><div class="bc-clk-a">` +
        '<i class="bc-h" style="transform:rotate(305deg)"></i><i class="bc-m" style="transform:rotate(60deg)"></i>' +
        `${sec}<b></b></div></div>`,
      css: [
        rule(`${ctx.sel} .bc-clk`, { color: safeColor(String(p.handColor), '#111') }),
        rule(`${ctx.sel} .bc-clk-a`, { width: px(d), height: px(d), background: safeColor(String(p.faceColor), '#fff') }),
        rule(`${ctx.sel} .bc-h,${ctx.sel} .bc-m`, { background: safeColor(String(p.handColor), '#111') }),
        rule(`${ctx.sel} .bc-s`, { background: safeColor(String(p.accentColor), '#e5484d') }),
      ].join('\n'),
    };
  }
  const text = p.format === '12' ? `10:10${p.showSeconds === true ? ':30' : ''} AM` : `10:10${p.showSeconds === true ? ':30' : ''}`;
  return {
    html: `<div class="bc-clk" data-tz="${tz}"><span class="bc-clk-t">${text}</span></div>`,
    css: rule(`${ctx.sel} .bc-clk-t`, {
      'font-family': fontStack(String(p.fontFamily)), 'font-size': px(Number(p.fontSize)), 'font-weight': 700, color,
    }),
  };
}

const RUNTIME = String.raw`bannr.define('clock', function (el, p) {
  var root = el.querySelector('.bc-clk');
  if (!root) return null;
  var fmt = null;
  if (p.timeZone && p.timeZone !== 'local' && window.Intl) {
    try { fmt = new Intl.DateTimeFormat('en-US', { timeZone: p.timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch (e) { fmt = null; }
  }
  function now() {
    var d = new Date();
    if (!fmt) return [d.getHours(), d.getMinutes(), d.getSeconds()];
    var ps = fmt.formatToParts(d), o = {};
    for (var i = 0; i < ps.length; i++) o[ps[i].type] = Number(ps[i].value);
    return [o.hour % 24, o.minute, o.second];
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  var t = root.querySelector('.bc-clk-t'), h = root.querySelector('.bc-h'), m = root.querySelector('.bc-m'), s = root.querySelector('.bc-s');
  var last = -1;
  function tick() {
    var n = now(), key = n[0] * 3600 + n[1] * 60 + n[2];
    if (key === last) return;
    last = key;
    if (t) {
      var hh = n[0], suf = '';
      if (p.format === '12') { suf = hh < 12 ? ' AM' : ' PM'; hh = hh % 12 || 12; }
      t.textContent = (p.format === '12' ? hh : pad(hh)) + ':' + pad(n[1]) + (p.showSeconds ? ':' + pad(n[2]) : '') + suf;
    }
    if (h) h.style.transform = 'rotate(' + ((n[0] % 12) * 30 + n[1] * 0.5) + 'deg)';
    if (m) m.style.transform = 'rotate(' + (n[1] * 6 + n[2] * 0.1) + 'deg)';
    if (s) s.style.transform = 'rotate(' + (n[2] * 6) + 'deg)';
  }
  tick();
  var lp = bannr.loop(tick);
  lp.start();
  return { destroy: lp.stop };
});`;

export const clock: ComponentDefinition = {
  type: 'clock',
  version: 1,
  label: 'Clock',
  category: 'widget',
  description: 'A real-time digital or analog clock in any time zone.',
  icon: '◷',
  defaultSize: { width: 200, height: 80 },
  minSize: { width: 40, height: 20 },
  recommendedSizes: ['480x480', '300x250', '300x600', '970x250'],
  settingsSchema: SCHEMA,
  slots: [],
  capturesPointer: false,
  emits: [],
  weightBudgetKB: 4,
  styles:
    '.bc-clk{display:flex;align-items:center;justify-content:center;width:100%;height:100%}' +
    '.bc-clk-t{font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1}' +
    '.bc-clk-a{position:relative;border-radius:50%;box-shadow:inset 0 0 0 3px currentColor}' +
    '.bc-clk-a i{position:absolute;left:50%;bottom:50%;transform-origin:50% 100%;border-radius:2px}' +
    '.bc-h{width:6%;height:26%;margin-left:-3%}.bc-m{width:4%;height:38%;margin-left:-2%}.bc-s{width:1.5%;height:42%;margin-left:-.75%}' +
    '.bc-clk-a b{position:absolute;left:50%;top:50%;width:8%;height:8%;margin:-4% 0 0 -4%;border-radius:50%;background:currentColor}',
  render: (p, _s, ctx) => output(p, ctx),
  runtime: RUNTIME,
  backupState: (p, _s, ctx) => output(p, ctx),
};
