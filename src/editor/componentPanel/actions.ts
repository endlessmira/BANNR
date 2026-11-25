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
 * Adds a component at its default size (never below its minimum, never larger than the banner),
 * centred on `center` (banner pixels) or on the banner. Background components (addAsBackground)
 * fill the banner and go to the bottom of the stack. One undo step; the new layer is selected.
 */
export function addComponent(type: string, presetId?: string, center?: { x: number; y: number }): ID | null {
  const st = useEditorStore.getState();
  const size = st.project ? findSize(st.project, st.activeSizeId) : undefined;
  const def = getComponent(type);
  if (!size || !def) return null;
  const preset = presetId ? def.presets?.find((p) => p.id === presetId) : undefined;
  const bg = def.addAsBackground === true;
  const w = bg ? size.width : Math.max(def.minSize.width, Math.min(def.defaultSize.width, size.width));
  const h = bg ? size.height : Math.max(def.minSize.height, Math.min(def.defaultSize.height, size.height));
  const cx = center?.x ?? size.width / 2;
  const cy = center?.y ?? size.height / 2;
  const x = bg ? 0 : Math.round(Math.min(Math.max(0, cx - w / 2), Math.max(0, size.width - w)));
  const y = bg ? 0 : Math.round(Math.min(Math.max(0, cy - h / 2), Math.max(0, size.height - h)));
  const z = bg
    ? Math.min(0, ...size.elements.map((e) => e.zIndex))
    : size.elements.reduce((m, e) => Math.max(m, e.zIndex), 0) + 1;
  const el = createComponent({
    componentType: def.type, componentVersion: def.version, preset: preset?.id,
    name: preset?.label ?? def.label, x, y, width: w, height: h, zIndex: z,
  });
  st.update((d) => mutateSize(d, size.id, (s) => {
    if (bg) s.elements.unshift(el);
    else s.elements.push(el);
  }));
  useEditorStore.getState().select([el.id]);
  return el.id;
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
