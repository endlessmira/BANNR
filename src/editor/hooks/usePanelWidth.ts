import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useState } from 'react';

const KEY = 'bannr:propsPanelWidth';
export const PANEL_MIN = 300;
export const PANEL_DEFAULT = 600;
const PANEL_MAX = 900;
const LEFT_PANEL = 240;

/**
 * Width of the properties panel: the user's choice (or 600 px), never leaving the canvas less than 480 px.
 * The default also leaves 760 px for the canvas, so the toolbar fits (300 px on a 1280 px screen).
 */
export function panelWidthFor(pref: number | null, viewport: number): number {
  const room = Math.max(PANEL_MIN, viewport - LEFT_PANEL - 480);
  const want = pref ?? Math.min(PANEL_DEFAULT, Math.max(PANEL_MIN, viewport - LEFT_PANEL - 760));
  return Math.round(Math.min(PANEL_MAX, room, Math.max(PANEL_MIN, want)));
}

function readPref(): number | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  const v = Number(raw);
  return raw !== null && Number.isFinite(v) ? v : null;
}

/** Panel width plus a drag handler (drag the left edge) and a reset (double-click). */
export function usePanelWidth() {
  const [pref, setPref] = useState<number | null>(readPref);
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const width = panelWidthFor(pref, vw);

  const save = (v: number | null) => {
    setPref(v);
    try {
      if (v === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(v));
    } catch {
      // storage blocked: the width just isn't remembered
    }
  };

  const start = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = width;
    let last = w0;
    const move = (ev: PointerEvent) => {
      last = panelWidthFor(w0 + (x0 - ev.clientX), window.innerWidth);
      setPref(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('rp-resizing');
      if (last !== w0) save(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.classList.add('rp-resizing');
  }, [width]);

  return { width, start, reset: () => save(null) };
}
