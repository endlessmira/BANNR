import { fontStack, px, round, rule, safeColor } from '@/renderer/css';
import { escapeText } from '@/renderer/escape';
import { HINT_FIELD } from './three';
import type { ComponentRenderCtx, ResolvedProps, SettingsSchema } from './types';

/**
 * Shared parts of the GAMES: start, win and lose screens, a HUD (score, time), and a Skip button that is
 * always visible during the game, so the landing page can always be reached.
 * GAME_JS defines bannr.game() once per banner; each game passes its own start/step/tap hooks.
 */
export interface GameFieldOptions {
  time: number;
  minTime: number;
  timeHelp: string;
  start: string;
  howTo: string;
  win: string;
  lose: string;
}

export function gameFields(o: GameFieldOptions): SettingsSchema {
  return {
    timeLimit: { type: 'number', label: 'Time limit', default: o.time, min: o.minTime, max: 60, suffix: 's', help: o.timeHelp },
    startTitle: { type: 'text', label: 'Start screen title', default: o.start, maxLength: 60 },
    startText: { type: 'text', label: 'How to play', default: o.howTo, maxLength: 120 },
    playLabel: { type: 'text', label: 'Play button', default: 'Play', maxLength: 20 },
    skipLabel: {
      type: 'text', label: 'Skip button', default: 'Skip · Shop now', maxLength: 30,
      help: 'Always visible during the game. Opens the landing page.',
    },
    winTitle: { type: 'text', label: 'Win screen title', default: o.win, maxLength: 80 },
    loseTitle: { type: 'text', label: 'Lose screen title', default: o.lose, maxLength: 80 },
    ctaLabel: { type: 'text', label: 'End screen button', default: 'Shop now', maxLength: 30, help: 'Always opens the landing page.' },
    replay: { type: 'toggle', label: '"Play again" link on the end screens', default: true },
    fontFamily: { type: 'font', label: 'Font', default: 'Arial' },
    textColor: { type: 'color', label: 'Text colour', default: '#111111' },
    bgColor: { type: 'color', label: 'Game background', default: '#ffffff' },
    overlayBg: { type: 'color', label: 'Screen background', default: 'rgba(255,255,255,0.92)' },
    accentColor: { type: 'color', label: 'Button colour', default: '#f2a902' },
    buttonTextColor: { type: 'color', label: 'Button text colour', default: '#111111' },
    backupShows: {
      type: 'select', label: 'Backup image shows', default: 'start',
      options: [['start', 'The start screen'], ['win', 'The win screen']],
    },
    ...HINT_FIELD,
  };
}

const str = (v: unknown): string => String(v ?? '');

/** Wraps a game's stage in the shared screens, HUD and Skip button. */
export function gameShell(p: ResolvedProps, ctx: ComponentRenderCtx, stage: string, backup: boolean): { html: string; css: string } {
  const shown = backup && p.backupShows === 'win' ? 'win' : 'start';
  const scr = (k: string, inner: string): string =>
    `<div class="bgm-scr${k === shown ? ' bgm-show' : ''}" data-scr="${k}">${inner}</div>`;
  const title = (t: string): string => (t.trim() ? `<p class="bgm-t">${escapeText(t)}</p>` : '');
  const how = str(p.startText).trim() ? `<p class="bgm-sub">${escapeText(str(p.startText))}</p>` : '';
  const cta = `<button type="button" class="bgm-btn bgm-cta" data-cta="1">${escapeText(str(p.ctaLabel).trim() || 'Shop now')}</button>`;
  const again = p.replay === true ? '<button type="button" class="bgm-link" data-replay="1">Play again</button>' : '';
  const play = `<button type="button" class="bgm-btn" data-play="1">${escapeText(str(p.playLabel).trim() || 'Play')}</button>`;
  const html =
    `<div class="bgm"><div class="bgm-stage">${stage}</div>` +
    '<div class="bgm-hud"><span data-hud="score"></span><span data-hud="time"></span></div>' +
    `<button type="button" class="bgm-skip" data-skip="1">${escapeText(str(p.skipLabel).trim() || 'Shop now')}</button>` +
    scr('start', title(str(p.startTitle)) + how + play) +
    scr('win', title(str(p.winTitle)) + cta + again) +
    scr('lose', title(str(p.loseTitle)) + cta + again) +
    '</div>';
  const m = Math.min(ctx.width, ctx.height);
  const sel = ctx.sel;
  const css = [
    rule(`${sel} .bgm`, {
      'font-family': fontStack(str(p.fontFamily)), color: safeColor(str(p.textColor), '#111'), background: safeColor(str(p.bgColor)),
    }),
    rule(`${sel} .bgm-scr`, { background: safeColor(str(p.overlayBg)) }),
    rule(`${sel} .bgm-t`, { 'font-size': px(round(m * 0.075, 1)) }),
    rule(`${sel} .bgm-sub`, { 'font-size': px(round(m * 0.045, 1)) }),
    rule(`${sel} .bgm-hud`, { 'font-size': px(Math.max(11, round(m * 0.045, 1))) }),
    rule(`${sel} .bgm-btn,${sel} .bgm-skip`, {
      background: safeColor(str(p.accentColor), '#f2a902'), color: safeColor(str(p.buttonTextColor), '#111'),
    }),
  ].join('\n');
  return { html, css };
}

export const GAME_CSS =
  '.bgm{position:relative;width:100%;height:100%;overflow:hidden;line-height:1.2}.bgm-stage{position:absolute;inset:0}' +
  '.bgm-hud{position:absolute;left:10px;right:10px;top:6px;z-index:50;display:flex;justify-content:space-between;' +
  'font-weight:800;pointer-events:none;opacity:0;transition:opacity .2s}.bgm-on .bgm-hud{opacity:1}.bgm-end .bgm-hud{opacity:0}' +
  '.bgm-skip{position:absolute;right:6px;bottom:6px;z-index:80;padding:5px 10px;border:0;border-radius:999px;font-family:inherit;' +
  'font-weight:700;font-size:11px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.2)}.bgm-end .bgm-skip{display:none}' +
  '.bgm-scr{position:absolute;inset:0;z-index:70;display:none;flex-direction:column;align-items:center;justify-content:center;' +
  'gap:10px;padding:8%;box-sizing:border-box;text-align:center}.bgm-scr.bgm-show{display:flex}' +
  '.bgm-t{margin:0;font-weight:800}.bgm-sub{margin:0;opacity:.85}' +
  '.bgm-btn{padding:10px 22px;border:0;border-radius:6px;font-family:inherit;font-weight:700;font-size:15px;cursor:pointer}' +
  '.bgm-cta{animation:bgm-pulse 1.2s ease-in-out 4}@keyframes bgm-pulse{50%{transform:scale(1.08)}}' +
  '.bgm-link{padding:2px;border:0;background:none;color:inherit;font-family:inherit;font-size:12px;text-decoration:underline;' +
  'cursor:pointer;opacity:.8}@media (prefers-reduced-motion:reduce){.bgm-cta{animation:none}}';

export const GAME_JS = String.raw`if (!bannr.game) bannr.game = function (el, p, h) {
  var root = el.querySelector('.bgm');
  if (!root) return null;
  var scr = {}, all = root.querySelectorAll('[data-scr]');
  for (var i = 0; i < all.length; i++) scr[all[i].getAttribute('data-scr')] = all[i];
  var sc = root.querySelector('[data-hud="score"]'), tm = root.querySelector('[data-hud="time"]');
  var limit = Math.max(0, Number(p.timeLimit) || 0) * 1000, left = 0, on = false, started = false, downT = null;
  el.style.touchAction = 'pan-y';
  function show(k) { for (var s in scr) { if (s === k) scr[s].classList.add('bgm-show'); else scr[s].classList.remove('bgm-show'); } }
  function sec(ms) { return String(Math.ceil(Math.max(0, ms) / 1000)); }
  function finish(k, ev) { if (!on) return; on = false; lp.stop(); el.style.touchAction = 'pan-y'; root.classList.add('bgm-end'); show(k); bannr.track(ev); }
  var api = {
    playing: function () { return on; },
    score: function (v) { if (sc) sc.textContent = String(v); },
    win: function () { finish('win', 'game_won'); },
    lose: function () { finish('lose', 'game_lost'); }
  };
  var lp = bannr.loop(function (dt) {
    if (!on) return;
    if (limit > 0) {
      left -= dt;
      if (tm) tm.textContent = sec(left);
      if (left <= 0) { if (h.timeUp) h.timeUp(); else api.lose(); return; }
    }
    if (h.step) h.step(dt);
  });
  var stopHint = p.hint ? bannr.hint(root.querySelector('[data-play]') || root, 1500) : function () {};
  function play() {
    stopHint();
    show('');
    root.classList.remove('bgm-end');
    root.classList.add('bgm-on');
    if (h.touch) el.style.touchAction = h.touch;
    on = true; left = limit;
    if (tm) tm.textContent = limit > 0 ? sec(limit) : '';
    if (!started) { started = true; bannr.track('interaction_start'); }
    bannr.track('game_start');
    h.start(api);
    lp.start();
  }
  function down(e) { downT = e.target || null; }
  el.addEventListener('pointerdown', down);
  var off = bannr.gesture(el, {
    move: function (g) { if (on && h.move) h.move(g); },
    end: function (g) { if (on && h.end) h.end(g); },
    tap: function () {
      var b = downT && downT.closest ? downT.closest('[data-play],[data-replay],[data-skip],[data-cta]') : null;
      if (b) {
        if (b.getAttribute('data-skip')) { on = false; lp.stop(); el.style.touchAction = 'pan-y'; bannr.track('game_skip'); bannr.exit(); }
        else if (b.getAttribute('data-cta')) bannr.exit();
        else { if (b.getAttribute('data-replay')) bannr.track('game_replay'); play(); }
      } else if (on && h.tap) h.tap(downT);
      return true;
    }
  }, { tapToExit: false });
  api.destroy = function () {
    on = false; lp.stop(); off(); stopHint();
    el.removeEventListener('pointerdown', down);
    if (h.destroy) h.destroy();
  };
  return api;
};`;
