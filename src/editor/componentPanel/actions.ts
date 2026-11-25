import { getComponent } from '@/components/registry';
import { createComponent } from '@/model/factories';
import type { BannerElement, ComponentElement, ComponentPropValue, ID, SlotValue } from '@/model/types';
import { mutateSize } from '../mutate';
import { findElement, findSize } from '../ops';
import { useEditorStore } from '../store/editorStore';

/** 3D components handle depth themselves, so they can't be rotated. */
export function canRotate(el: BannerElement): boolean {
  return el.type !== 'component' || getComponent(el.componentType)?.category !== '3d';
}

/**
 * Adds a component that FILLS the banner it is added to (any size, including the 480×480 master).
 * Background components (addAsBackground) go to the bottom of the stack, all others on top.
 * The drop point is not used: components always fill. One undo step; the new layer is selected.
 */
export function addComponent(type: string, presetId?: string, _at?: { x: number; y: number }): ID | null {
  const st = useEditorStore.getState();
  const size = st.project ? findSize(st.project, st.activeSizeId) : undefined;
  const def = getComponent(type);
  if (!size || !def) return null;
  const preset = presetId ? def.presets?.find((p) => p.id === presetId) : undefined;
  const bg = def.addAsBackground === true;
  const z = bg
    ? Math.min(0, ...size.elements.map((e) => e.zIndex))
    : size.elements.reduce((m, e) => Math.max(m, e.zIndex), 0) + 1;
  const el = createComponent({
    componentType: def.type, componentVersion: def.version, preset: preset?.id,
    name: preset?.label ?? def.label, x: 0, y: 0, width: size.width, height: size.height, zIndex: z,
  });
  st.update((d) => mutateSize(d, size.id, (s) => {
    if (bg) s.elements.unshift(el);
    else s.elements.push(el);
  }));
  useEditorStore.getState().select([el.id]);
  return el.id;
}

/** Moves a layer to the top-left corner and makes it the size of the banner (one undo step). */
export function fitToBanner(id: ID): void {
  const { activeSizeId, update } = useEditorStore.getState();
  if (!activeSizeId) return;
  update((d) => mutateSize(d, activeSizeId, (s) => {
    const el = s.elements.find((e) => e.id === id);
    if (!el) return;
    el.x = 0;
    el.y = 0;
    el.width = s.width;
    el.height = s.height;
  }));
}

/** Each field has its own coalesce key, so typing or dragging a slider is one undo step. */
function editComponent(id: ID, key: string, fn: (el: ComponentElement) => void): void {
  const { activeSizeId, update } = useEditorStore.getState();
  if (!activeSizeId) return;
  update(
    (d) => mutateSize(d, activeSizeId, (s) => {
      const el = findElement(s.elements, id);
      if (el?.type === 'component') fn(el);
    }),
    { coalesceKey: `${id}:comp:${key}` },
  );
}

export function setComponentProp(id: ID, key: string, value: ComponentPropValue): void {
  editComponent(id, `prop:${key}`, (el) => { el.props[key] = value; });
}

/** Switches preset. Settings the new preset defines are reset so its values show; null = no preset. */
export function setComponentPreset(id: ID, presetId: string | null): void {
  editComponent(id, 'preset', (el) => {
    const p = presetId ? getComponent(el.componentType)?.presets?.find((x) => x.id === presetId) : undefined;
    if (p) {
      el.preset = p.id;
      for (const k of Object.keys(p.props)) delete el.props[k];
    } else {
      delete el.preset;
    }
  });
}

export function resetComponentProps(id: ID): void {
  editComponent(id, 'reset', (el) => { el.props = {}; });
}

export function setSlotValues(id: ID, slot: string, values: SlotValue[]): void {
  editComponent(id, `slot:${slot}`, (el) => {
    if (values.length > 0) el.slots[slot] = values;
    else delete el.slots[slot];
  });
}
