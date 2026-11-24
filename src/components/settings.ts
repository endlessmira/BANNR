import type { ComponentElement } from '@/model/types';
import { safeColor } from '@/renderer/css';
import type { ComponentDefinition, PropValue, ResolvedProps, ResolvedSlot, ResolvedSlots, SettingField } from './types';

export function defaultProps(def: ComponentDefinition): ResolvedProps {
  const out: ResolvedProps = {};
  for (const [k, f] of Object.entries(def.settingsSchema)) out[k] = f.default;
  return out;
}

/** Turns any stored value into a valid value for this field, or the field's default. */
export function coerce(f: SettingField, v: unknown): PropValue {
  switch (f.type) {
    case 'number':
    case 'slider': {
      const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
      if (!Number.isFinite(n)) return f.default;
      return Math.min(f.max ?? Number.POSITIVE_INFINITY, Math.max(f.min ?? Number.NEGATIVE_INFINITY, n));
    }
    case 'toggle':
      return typeof v === 'boolean' ? v : f.default;
    case 'color':
      return typeof v === 'string' ? safeColor(v, f.default) : f.default;
    case 'select': {
      const s = typeof v === 'string' || typeof v === 'number' ? String(v) : null;
      return s !== null && f.options.some(([o]) => o === s) ? s : f.default;
    }
    case 'text':
      return typeof v === 'string' ? (f.maxLength ? v.slice(0, f.maxLength) : v) : f.default;
    case 'font':
      return typeof v === 'string' && v.trim() !== '' ? v : f.default;
    case 'date':
      return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : f.default;
    default: {
      const never: never = f;
      return never;
    }
  }
}

export function presetProps(def: ComponentDefinition, presetId?: string): Readonly<Record<string, PropValue>> {
  return def.presets?.find((p) => p.id === presetId)?.props ?? {};
}

/** Defaults, then the preset, then the layer's own props, each value validated against the schema. */
export function resolveProps(def: ComponentDefinition, raw: ComponentElement['props'], presetId?: string): ResolvedProps {
  const merged: Record<string, unknown> = { ...presetProps(def, presetId), ...raw };
  const out: ResolvedProps = {};
  for (const [k, f] of Object.entries(def.settingsSchema)) {
    out[k] = Object.prototype.hasOwnProperty.call(merged, k) ? coerce(f, merged[k]) : f.default;
  }
  return out;
}

/** Problems in a component's own definition (unit-tested for every registered component). */
export function schemaIssues(def: ComponentDefinition): string[] {
  const out: string[] = [];
  for (const [k, f] of Object.entries(def.settingsSchema)) {
    if (coerce(f, f.default) !== f.default) out.push(`${def.type}.${k}: the default is not a valid value`);
    if ((f.type === 'number' || f.type === 'slider') && f.min !== undefined && f.max !== undefined && f.min > f.max) {
      out.push(`${def.type}.${k}: min is greater than max`);
    }
  }
  for (const p of def.presets ?? []) {
    for (const [k, v] of Object.entries(p.props)) {
      const f = def.settingsSchema[k];
      if (!f) out.push(`${def.type} preset "${p.id}": unknown setting "${k}"`);
      else if (coerce(f, v) !== v) out.push(`${def.type} preset "${p.id}": invalid value for "${k}"`);
    }
  }
  const seen = new Set<string>();
  for (const s of def.slots) {
    if (seen.has(s.name)) out.push(`${def.type}: duplicate slot "${s.name}"`);
    seen.add(s.name);
  }
  if (def.minSize.width > def.defaultSize.width || def.minSize.height > def.defaultSize.height) {
    out.push(`${def.type}: the default size is smaller than the minimum size`);
  }
  return out;
}

export function resolveSlots(
  def: ComponentDefinition, slots: ComponentElement['slots'], resolveAsset: (id: string) => string,
): ResolvedSlots {
  const out: ResolvedSlots = {};
  for (const s of def.slots) {
    const values = (slots[s.name] ?? []).filter((v) => v.kind === s.kind).slice(0, s.max ?? Number.POSITIVE_INFINITY);
    out[s.name] = values.map((v): ResolvedSlot =>
      v.kind === 'image' ? { kind: 'image', assetId: v.assetId, src: resolveAsset(v.assetId) } : { kind: 'text', text: v.text });
  }
  return out;
}

/** Labels of required slots that are not filled. */
export function missingSlots(def: ComponentDefinition, slots: ComponentElement['slots']): string[] {
  return def.slots
    .filter((s) => s.required && (slots[s.name] ?? []).filter((v) => v.kind === s.kind).length < Math.max(1, s.min ?? 1))
    .map((s) => s.label);
}
