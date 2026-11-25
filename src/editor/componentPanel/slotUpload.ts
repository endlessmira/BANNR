import { getComponent } from '@/components/registry';
import type { ID } from '@/model/types';
import { storeImage } from '../assets';
import { mutateSize } from '../mutate';
import { findElement } from '../ops';
import { useEditorStore } from '../store/editorStore';

/** Compresses and stores an image, then puts it into a component slot (one undo step). Returns messages to show. */
export async function uploadToSlot(id: ID, slot: string, file: File): Promise<string[]> {
  const { ref, notes, warnings } = await storeImage(file);
  const { activeSizeId, update } = useEditorStore.getState();
  if (activeSizeId) {
    update((d) => {
      d.assets[ref.id] = ref;
      mutateSize(d, activeSizeId, (s) => {
        const el = findElement(s.elements, id);
        if (el?.type !== 'component') return;
        const max = getComponent(el.componentType)?.slots.find((x) => x.name === slot)?.max ?? 1;
        el.slots[slot] = [...(el.slots[slot] ?? []), { kind: 'image' as const, assetId: ref.id }].slice(-max);
      });
    });
  }
  return [...notes, ...warnings];
}
