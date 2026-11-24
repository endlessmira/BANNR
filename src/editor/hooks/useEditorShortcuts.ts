import { useEffect } from 'react';
import { copySelection, cutSelection, duplicateSelection, nudge, paste, selectAll } from '../actions';
import { arrange, groupSelection, ungroupSelection } from '../layers';
import { useEditorStore } from '../store/editorStore';

const isTyping = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

const ARROWS: Record<string, readonly [number, number]> = {
  arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1],
};

export function useEditorShortcuts(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = useEditorStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod) {
        const run = (fn: () => void) => { e.preventDefault(); fn(); };
        if (key === 'z') run(() => (e.shiftKey ? s.redo() : s.undo()));
        else if (key === 'y') run(s.redo);
        else if (key === 'c' && s.selection.length > 0) run(() => { copySelection(); });
        else if (key === 'x' && s.selection.length > 0) run(cutSelection);
        else if (key === 'v') run(paste);
        else if (key === 'd') run(duplicateSelection);
        else if (key === 'a') run(selectAll);
        else if (key === 'g') run(() => (e.shiftKey ? ungroupSelection() : groupSelection()));
        else if (key === ']' || key === '}') run(() => arrange(e.shiftKey ? 'front' : 'forward'));
        else if (key === '[' || key === '{') run(() => arrange(e.shiftKey ? 'back' : 'backward'));
        return;
      }

      const arrow = ARROWS[key];
      if (arrow && s.selection.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudge(arrow[0] * step, arrow[1] * step);
      } else if ((key === 'delete' || key === 'backspace') && s.selection.length > 0) {
        e.preventDefault();
        s.deleteSelection();
      } else if (key === 'escape') {
        s.select([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
