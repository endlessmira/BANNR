import { useEffect, useState } from 'react';
import { projectRepo } from '@/persistence';
import { useEditorStore } from '../store/editorStore';

export type SaveStatus = 'saved' | 'saving' | 'error';
const DEBOUNCE_MS = 600;

/** The latest save in flight. The dashboard waits for it so it never lists stale data. */
export const saveQueue: { current: Promise<void> } = { current: Promise.resolve() };

export function useAutosave(): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('saved');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = async () => {
      const { project, revision, savedRevision } = useEditorStore.getState();
      if (!project || revision === savedRevision) return;
      setStatus('saving');
      try {
        const pending = projectRepo.save(project);
        saveQueue.current = pending;
        await pending;
        useEditorStore.getState().markSaved(revision);
        setStatus(useEditorStore.getState().revision === revision ? 'saved' : 'saving');
      } catch (err) {
        console.error('Autosave failed', err);
        setStatus('error');
      }
    };

    const unsubscribe = useEditorStore.subscribe((s, prev) => {
      if (s.revision === prev.revision || !s.project) return;
      setStatus('saving');
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), DEBOUNCE_MS);
    });
    const onUnload = () => void flush();
    window.addEventListener('beforeunload', onUnload);

    return () => {
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener('beforeunload', onUnload);
      void flush(); // save immediately when leaving the editor
    };
  }, []);

  return status;
}
