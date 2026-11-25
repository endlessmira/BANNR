import { type ReactNode, useState } from 'react';
import { getComponent } from '@/components/registry';
import { defaultItem, missingSlots, resolveProps } from '@/components/settings';
import type { PropValue, ResolvedItem, SettingField, SlotDefinition } from '@/components/types';
import type { ComponentElement, ComponentPropValue, SlotValue } from '@/model/types';
import { storeImage } from '../assets';
import { fontOptions } from '../fonts/fontOptions';
import { ColorField, FileButton, NumberField, type Opt, Section, SelectField } from '../panels/fields';
import { useEditorStore } from '../store/editorStore';
import { fitToBanner, resetComponentProps, setComponentPreset, setComponentProp, setSlotValues } from './actions';
import { uploadToSlot } from './slotUpload';
import { componentWeightKB } from './weight';

type Notice = (m: string | null) => void;
type GroupField = Extract<SettingField, { type: 'group' }>;

/** Hidden fields and fields whose "when" condition does not match are not shown. */
export function visibleField(f: SettingField, item: Readonly<Record<string, PropValue>>): boolean {
  return !f.hidden && (!f.when || f.when.is.includes(String(item[f.when.key])));
}

function ImageControl({ label, value, onChange, onNotice }: { label: string; value: string; onChange: (id: string) => void; onNotice: Notice }) {
  const assets = useEditorStore((s) => s.project?.assets);
  const images = Object.values(assets ?? {}).filter((a) => a.kind === 'image');
  const upload = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    storeImage(file).then(
      ({ ref, notes, warnings }) => {
        useEditorStore.getState().update((d) => { d.assets[ref.id] = ref; });
        onChange(ref.id);
        const m = [...notes, ...warnings];
        onNotice(m.length > 0 ? m.join(' ') : null);
      },
      (e: unknown) => onNotice(e instanceof Error ? e.message : String(e)),
    );
  };
  return (
    <div className="slot">
      <div className="slot-head"><b>{label}</b><small>{value ? (assets?.[value]?.fileName ?? 'image') : 'none'}</small></div>
      <div className="btn-row">
        <FileButton label="Upload…" onFiles={upload} />
        {images.length > 0 && (
          <select aria-label={`Pick an image for ${label}`} value="" onChange={(e) => { if (e.target.value) onChange(e.target.value); }}>
            <option value="">Use an uploaded image…</option>
            {images.map((a) => <option key={a.id} value={a.id}>{a.fileName}</option>)}
          </select>
        )}
        {value ? <button type="button" className="mini" aria-label={`Remove ${label}`} onClick={() => onChange('')}>×</button> : null}
      </div>
    </div>
  );
}

interface ControlProps {
  field: SettingField;
  value: PropValue;
  onChange: (v: PropValue) => void;
  /** Accessible name; nested fields are prefixed, e.g. "Slide 2 · Layer 1 · Text". */
  aria: string;
  /** Item name for nested groups ('' at the top level). */
  prefix: string;
  onNotice: Notice;
  onSelect?: (i: number) => void;
  initial?: number;
}

/** One control per field type: number, slider, color, toggle, select, text, font, date, image, group. */
function FieldControl({ field, value, onChange, aria, prefix, onNotice, onSelect, initial }: ControlProps) {
  const projectFonts = useEditorStore((s) => s.project?.fonts);
  const control = (): ReactNode => {
    switch (field.type) {
      case 'number':
        return (
          <NumberField label={field.label} ariaLabel={aria} value={Number(value)} min={field.min} max={field.max}
            step={field.step} suffix={field.suffix} onChange={onChange} />
        );
      case 'slider':
        return (
          <label className="sf comp-slider">
            <span>{field.label}</span>
            <input type="range" aria-label={aria} min={field.min} max={field.max} step={field.step ?? 1} value={Number(value)}
              onChange={(e) => onChange(Number(e.target.value))} />
            <em>{Number(value)}{field.suffix ?? ''}</em>
          </label>
        );
      case 'color':
        return <ColorField label={aria} value={String(value)} onChange={onChange} />;
      case 'toggle':
        return (
          <label className="check">
            <input type="checkbox" aria-label={aria} checked={value === true} onChange={(e) => onChange(e.target.checked)} />
            {field.label}
          </label>
        );
      case 'select':
        return <SelectField label={aria} value={String(value)} options={field.options} onChange={onChange} />;
      case 'text':
        return (
          <label className="sf">
            <span>{field.label}</span>
            {field.multiline ? (
              <textarea className="ta" rows={3} aria-label={aria} value={String(value)} maxLength={field.maxLength}
                onChange={(e) => onChange(e.target.value)} />
            ) : (
              <input className="ti" aria-label={aria} value={String(value)} maxLength={field.maxLength}
                onChange={(e) => onChange(e.target.value)} />
            )}
          </label>
        );
      case 'font':
        return <SelectField label={aria} value={String(value)} options={fontOptions(projectFonts ?? [], String(value))} onChange={onChange} />;
      case 'date':
        return (
          <label className="sf">
            <span>{field.label}</span>
            <input className="ti" type="datetime-local" aria-label={aria} value={String(value).slice(0, 16)}
              onChange={(e) => onChange(e.target.value)} />
          </label>
        );
      case 'image':
        return <ImageControl label={aria} value={typeof value === 'string' ? value : ''} onChange={onChange} onNotice={onNotice} />;
      case 'group':
        return (
          <GroupEditor field={field} items={Array.isArray(value) ? value : []} onChange={onChange} prefix={prefix}
            onNotice={onNotice} onSelect={onSelect} initial={initial} />
        );
      default: {
        const never: never = field;
        return never;
      }
    }
  };
  return (
    <>
      {control()}
      {field.help && field.type !== 'group' ? <p className="muted small">{field.help}</p> : null}
    </>
  );
}

interface GroupProps {
  field: GroupField;
  items: ResolvedItem[];
  onChange: (items: ResolvedItem[]) => void;
  prefix: string;
  onNotice: Notice;
  onSelect?: (i: number) => void;
  initial?: number;
}

/** A repeatable group: tabs (e.g. slides) or a list (e.g. layers), with add, remove and reorder. */
function GroupEditor({ field, items, onChange, prefix, onNotice, onSelect, initial }: GroupProps) {
  const [sel, setSel] = useState(initial !== undefined && Number.isFinite(initial) ? Math.max(0, initial) : 0);
  const cur = Math.min(sel, Math.max(0, items.length - 1));
  const label = field.itemLabel;
  const name = (i: number): string => (prefix ? `${prefix} · ${label} ${i + 1}` : `${label} ${i + 1}`);
  const pick = (i: number) => { setSel(i); onSelect?.(i); };
  const add = () => {
    if (items.length >= field.max) return;
    onChange([...items, defaultItem(field.fields)]);
    pick(items.length);
  };
  const remove = (i: number) => {
    if (items.length <= field.min) return;
    onChange(items.filter((_, j) => j !== i));
    pick(Math.max(0, i - 1));
  };
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    const [x] = next.splice(i, 1);
    if (x) next.splice(j, 0, x);
    onChange(next);
    pick(j);
  };
  const edit = (i: number, key: string, v: PropValue) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  const body = (it: ResolvedItem, i: number) =>
    Object.entries(field.fields).filter(([, f]) => visibleField(f, it)).map(([k, f]) => (
      <FieldControl key={k} field={f} value={it[k] ?? false} aria={`${name(i)} · ${f.label}`} prefix={name(i)}
        onNotice={onNotice} onChange={(v) => edit(i, k, v)} />
    ));
  const lower = label.toLowerCase();

  if (field.layout === 'tabs') {
    const it = items[cur];
    return (
      <div className="grp">
        <div className="grp-tabs" role="tablist" aria-label={field.label}>
          {items.map((_, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === cur} className="grp-tab" onClick={() => pick(i)}>
              {label} {i + 1}
            </button>
          ))}
          {items.length < field.max && (
            <button type="button" className="mini" aria-label={`Add ${lower}`} title={`Add ${lower}`} onClick={add}>+</button>
          )}
        </div>
        {it && (
          <div className="grp-body">
            <div className="grp-actions">
              <button type="button" className="mini" aria-label={`Move ${name(cur)} left`} disabled={cur === 0} onClick={() => move(cur, -1)}>←</button>
              <button type="button" className="mini" aria-label={`Move ${name(cur)} right`} disabled={cur >= items.length - 1}
                onClick={() => move(cur, 1)}>→</button>
              <button type="button" className="mini" aria-label={`Remove ${name(cur)}`} disabled={items.length <= field.min}
                onClick={() => remove(cur)}>Remove</button>
            </div>
            {body(it, cur)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grp">
      <span className="grp-label">{field.label}</span>
      {items.length === 0 && <p className="muted small">No {field.label.toLowerCase()} yet.</p>}
      {items.map((it, i) => (
        <details key={i} className="grp-item" open>
          <summary>
            {label} {i + 1}
            {it.kind === 'text' ? ` · Text "${String(it.text ?? '').slice(0, 18)}"` : it.kind === 'image' ? ' · Image' : ''}
          </summary>
          <div className="grp-item-body">
            <div className="grp-actions">
              <button type="button" className="mini" aria-label={`Move ${name(i)} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="mini" aria-label={`Move ${name(i)} down`} disabled={i >= items.length - 1}
                onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="mini" aria-label={`Remove ${name(i)}`} disabled={items.length <= field.min}
                onClick={() => remove(i)}>×</button>
            </div>
            {body(it, i)}
          </div>
        </details>
      ))}
      {items.length < field.max && (
        <button type="button" className="secondary small-btn" onClick={add}>+ Add {lower}</button>
      )}
    </div>
  );
}

interface SlotProps { el: ComponentElement; slot: SlotDefinition; onNotice: Notice }

function SlotEditor({ el, slot, onNotice }: SlotProps) {
  const assets = useEditorStore((s) => s.project?.assets);
  const values = (el.slots[slot.name] ?? []).filter((v) => v.kind === slot.kind);
  const max = slot.max ?? 1;
  const set = (vs: SlotValue[]) => setSlotValues(el.id, slot.name, vs);
  const images = Object.values(assets ?? {}).filter((a) => a.kind === 'image');
  const canAdd = values.length < max;

  return (
    <div className="slot">
      <div className="slot-head">
        <b>{slot.label}</b>
        {slot.required ? <em>required</em> : null}
        <small>{values.length}/{max}</small>
      </div>
      {values.map((v, i) => (
        <div key={i} className="asset-row">
          {v.kind === 'image' ? (
            <span>{assets?.[v.assetId]?.fileName ?? 'image'}</span>
          ) : (
            <input className="ti" aria-label={`${slot.label} ${i + 1}`} value={v.text}
              onChange={(e) => set(values.map((x, j): SlotValue => (j === i ? { kind: 'text', text: e.target.value } : x)))} />
          )}
          <button type="button" className="mini" aria-label={`Remove ${slot.label} ${i + 1}`}
            onClick={() => set(values.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      {canAdd && slot.kind === 'image' && (
        <div className="btn-row">
          <FileButton
            label="Upload…"
            onFiles={(files) => {
              const file = files[0];
              if (!file) return;
              uploadToSlot(el.id, slot.name, file).then(
                (msgs) => onNotice(msgs.length > 0 ? msgs.join(' ') : null),
                (e: unknown) => onNotice(e instanceof Error ? e.message : String(e)),
              );
            }}
          />
          {images.length > 0 && (
            <select aria-label={`Pick an image for ${slot.label}`} value=""
              onChange={(e) => { if (e.target.value) set([...values, { kind: 'image', assetId: e.target.value }]); }}>
              <option value="">Use an uploaded image…</option>
              {images.map((a) => <option key={a.id} value={a.id}>{a.fileName}</option>)}
            </select>
          )}
        </div>
      )}
      {canAdd && slot.kind === 'text' && (
        <button type="button" className="secondary small-btn" onClick={() => set([...values, { kind: 'text', text: '' }])}>Add text</button>
      )}
    </div>
  );
}

/** "Component settings" and "Slots" sections, generated from the component's definition. */
export function ComponentSettings({ el }: { el: ComponentElement }) {
  const [notice, setNotice] = useState<string | null>(null);
  const def = getComponent(el.componentType);
  if (!def) {
    return <p className="notice">Unknown component "{el.componentType}". It may come from a newer version of BANNR.</p>;
  }
  const props = resolveProps(def, el.props, el.preset);
  const missing = missingSlots(def, el.slots);
  const presets: Opt<string> = [['', 'None'], ...(def.presets ?? []).map((p) => [p.id, p.label] as const)];

  return (
    <>
      <Section title="Component settings">
        <p className="muted small">
          {def.icon} {def.label} · {componentWeightKB(def)} KB code · min {def.minSize.width}×{def.minSize.height}
          {def.capturesPointer ? ' · interactive' : ''}
        </p>
        <button type="button" className="secondary small-btn" title="Make this layer exactly the size of the banner" onClick={() => fitToBanner(el.id)}>Fit to banner</button>
        {def.notice ? <p className="anim-warn" role="note">{def.notice}</p> : null}
        {def.presets && def.presets.length > 0 ? (
          <SelectField label="Preset" value={el.preset ?? ''} options={presets} onChange={(v) => setComponentPreset(el.id, v || null)} />
        ) : null}
        {Object.entries(def.settingsSchema).filter(([, f]) => visibleField(f, props)).map(([k, f]) => {
          const sp = f.type === 'group' ? f.selectProp : undefined;
          return (
            <FieldControl
              key={k}
              field={f}
              value={props[k] ?? false}
              aria={f.label}
              prefix=""
              onNotice={setNotice}
              onChange={(v) => setComponentProp(el.id, k, v as ComponentPropValue)}
              onSelect={sp ? (i) => setComponentProp(el.id, sp, i + 1) : undefined}
              initial={sp ? Number(props[sp]) - 1 : undefined}
            />
          );
        })}
        <button type="button" className="secondary small-btn" disabled={Object.keys(el.props).length === 0}
          onClick={() => resetComponentProps(el.id)}>
          Reset to {el.preset ? 'preset' : 'defaults'}
        </button>
        {notice && def.slots.length === 0 && <p className="notice">{notice}</p>}
      </Section>
      {def.slots.length > 0 && (
        <Section title="Slots">
          {missing.length > 0 && <p className="anim-warn">Fill the required slots: {missing.join(', ')}</p>}
          {def.slots.map((s) => <SlotEditor key={s.name} el={el} slot={s} onNotice={setNotice} />)}
          {notice && <p className="notice">{notice}</p>}
        </Section>
      )}
    </>
  );
}
