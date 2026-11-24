/**
 * Shared BANNR runtime, included ONCE per banner and only when the size uses a component.
 * Vanilla JS, no libraries, no network. It builds on the core from renderBanner.ts
 * (bannr.exit / bannr.track / the click layer) and never opens URLs itself except via bannr.exit().
 *
 *  bannr.gesture(el, handlers, { tapToExit })  Pointer Events (mouse + touch + pen). Tap = moved under 10px and
 *                                              released within 300 ms. A drag NEVER exits. A tap exits unless a
 *                                              handler returns true or tapToExit is false.
 *  bannr.loop(step)                            requestAnimationFrame loop, paused while the page is hidden
 *  bannr.hint(el, delayMs)                     wiggle hint until the first interaction (off with reduced motion)
 *  bannr.reducedMotion, bannr.isVisible(), bannr.onVisibility(fn)
 *  bannr.define(type, factory), bannr.start(), bannr.destroy()
 */
export const RUNTIME_JS = String.raw`(function () {
  var b = window.bannr;
  if (!b || b.define) return;
  var TAP_PX = 10, TAP_MS = 300;
  b.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var visible = !document.hidden, subs = [];
  document.addEventListener('visibilitychange', function () {
    var v = !document.hidden;
    if (v === visible) return;
    visible = v;
    for (var i = 0; i < subs.length; i++) subs[i](v);
  });
  b.isVisible = function () { return visible; };
  b.onVisibility = function (f) {
    subs.push(f);
    return function () { var i = subs.indexOf(f); if (i >= 0) subs.splice(i, 1); };
  };

  b.loop = function (step) {
    var id = 0, last = 0, on = false;
    function frame(t) {
      if (!on) return;
      var dt = last ? Math.min(64, t - last) : 16;
      last = t;
      if (visible) step(dt, t);
      if (on) id = window.requestAnimationFrame(frame);
    }
    return {
      start: function () { if (on) return; on = true; last = 0; id = window.requestAnimationFrame(frame); },
      stop: function () { on = false; window.cancelAnimationFrame(id); }
    };
  };

  b.gesture = function (el, h, opts) {
    h = h || {};
    var tapToExit = !opts || opts.tapToExit !== false, s = null;
    function info(e) { return { dx: e.clientX - s.x, dy: e.clientY - s.y, vx: s.vx, vy: s.vy, event: e }; }
    function down(e) {
      if (s) return;
      var now = Date.now();
      s = { id: e.pointerId, x: e.clientX, y: e.clientY, t: now, lx: e.clientX, ly: e.clientY, lt: now, vx: 0, vy: 0, drag: false };
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (_) {} }
      if (h.start) h.start(e);
    }
    function move(e) {
      if (!s || e.pointerId !== s.id) return;
      var now = Date.now(), dt = Math.max(1, now - s.lt);
      s.vx = (e.clientX - s.lx) / dt; s.vy = (e.clientY - s.ly) / dt;
      s.lx = e.clientX; s.ly = e.clientY; s.lt = now;
      var dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.drag && dx * dx + dy * dy >= TAP_PX * TAP_PX) s.drag = true;
      if (s.drag) { if (e.cancelable && e.preventDefault) e.preventDefault(); if (h.move) h.move(info(e)); }
    }
    function up(e) {
      if (!s || e.pointerId !== s.id) return;
      var i = info(e), drag = s.drag, tap = !drag && Date.now() - s.t < TAP_MS;
      s = null;
      if (tap) { if (!(h.tap && h.tap(i) === true) && tapToExit) b.exit(); }
      else if (drag && h.end) h.end(i);
    }
    function cancel(e) {
      if (!s || e.pointerId !== s.id) return;
      var drag = s.drag;
      s = null;
      if (drag && h.end) h.end({ dx: 0, dy: 0, vx: 0, vy: 0, event: e, cancelled: true });
    }
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return function () {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  };

  b.hint = function (el, delay) {
    if (b.reducedMotion) return function () {};
    var tm = setTimeout(function () { el.classList.add('bannr-hint'); }, delay == null ? 1500 : delay);
    function stop() { clearTimeout(tm); el.classList.remove('bannr-hint'); el.removeEventListener('pointerdown', stop); }
    el.addEventListener('pointerdown', stop);
    return stop;
  };

  var defs = {}, live = [];
  b.define = function (type, factory) { defs[type] = factory; };
  function mount() {
    var nodes = document.querySelectorAll('[data-component]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], t = n.getAttribute('data-component');
      var f = Object.prototype.hasOwnProperty.call(defs, t) ? defs[t] : null;
      if (!f) continue;
      var p = {};
      try { p = JSON.parse(n.getAttribute('data-props') || '{}'); } catch (_) {}
      try { var inst = f(n, p); if (inst) live.push(inst); } catch (err) { if (window.console) console.error(err); }
    }
  }
  b.destroy = function () { while (live.length) { var x = live.pop(); if (x && x.destroy) x.destroy(); } };
  window.addEventListener('pagehide', function () { b.destroy(); });
  b.start = function () {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else setTimeout(mount, 0);
  };
})();`;

export const RUNTIME_CSS = [
  '@keyframes bannr-wiggle{0%,100%{transform:none}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}',
  '.bannr-hint{animation:bannr-wiggle .6s ease-in-out 3}',
  '@media (prefers-reduced-motion:reduce){.bannr-hint{animation:none}}',
].join('\n');

/** Runs after the component code. Mounting waits for DOMContentLoaded, so the platform's bannr.exit() exists. */
export const MOUNT_JS = 'bannr.start();';
