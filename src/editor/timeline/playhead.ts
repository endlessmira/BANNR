import { useSyncExternalStore } from 'react';

/**
 * Current preview time in ms, reported by the preview iframe. Kept outside React state,
 * so only the timeline re-renders while the animation plays.
 */
let current = 0;
const listeners = new Set<() => void>();

export const playhead = {
  get: (): number => current,
  set(ms: number): void {
    if (ms === current) return;
    current = ms;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

export const usePlayhead = (): number => useSyncExternalStore(playhead.subscribe, playhead.get);
