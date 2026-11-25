import { type ReactNode, useState } from 'react';
import { getComponent } from '@/components/registry';
import { missingSlots, resolveProps } from '@/components/settings';
import type { PropValue, SettingField, SlotDefinition } from '@/components/types';
import type { ComponentElement, ID, SlotValue } from '@/model/types';
import { fontOptions } from '../fonts/fontOptions';
import { ColorField, FileButton, NumberField, type Opt, Section, SelectField } from '../panels/fields';
import { useEditorStore } from '../store/editorStore';
import { resetComponentProps, setComponentPreset, setComponentProp, setSlotValues } from './actions';
import { uploadToSlot } from './slotUpload';
import { componentWeightKB } from './weight';

interface FieldProps { id: ID; name: string; field: SettingField; value: PropValue }

/** One control per schema field: number, slider, color, toggle, select, text, font, date. */
function Field({ id, name, field, value }: FieldProps) {
  const projectFonts = useEditorStore((s) => s.project?.fonts);
  const set = (v: PropValue) => setComponentProp(id, name, v);

  const control = (): ReactNode => {
    switch (field.type) {
      case 'number':
        return (
          <NumberField label={field.label} ariaLabel={field.label} value={Number(value)} min={field.min} max={field.max}
            step={field.step} suffix={field.suffix} onChange={set} />
        );
      case 'slider':
        return (
          <label className="sf comp-slider">
            <span>{field.label}</span>
            <input type="range" aria-label={field.label} min={field.min} max={field.max} step={field.step ?? 1} value={Number(value)}
              onChange={(e) => set(Number(e.target.value))} />
            <em>{Number(value)}{field.suffix ?? ''}</em>
          </label>
        );
      case 'color':
        return <ColorField label={field.label} value={String(value)} onChange={set} />;
      case 'toggle':
        return (
          <label className="check">
            <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} />
            {field.label}
          </label>
        );
      case 'select':
        return <SelectField label={field.label} value={String(value)} options={field.options} onChange={set} />;
      case 'text':
        return field.multiline ? (
          <label className="sf">
            <span>{field.label}</span>
            <textarea className="ta" rows={3} aria-label={field.label} value={String(value)} onChange={(e) => set(e.target.value)} />
          </label>
        ) : (
          <label className="sf">
            <span>{field.label}</span>
            <input className="ti" aria-label={field.label} value={String(value)} maxLength={field.maxLength}
              onChange={(e) => set(e.target.value)} />
          </label>
        );
      case 'font':
        return (
          <SelectField label={field.label} value={String(value)} options={fontOptions(projectFonts ?? [], String(value))} onChange={set} />
        );
      case 'date':
        return (
          <label className="sf">
            <span>{field.label}</span>
            <input className="ti" type="datetime-local" aria-label={field.label} value={String(value).slice(0, 16)}
              onChange={(e) => set(e.target.value)} />
          </label>
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
      {field.help ? <p className="muted small">{field.help}</p> : null}
    </>
  );
}

interface SlotProps { el: ComponentElement; slot: SlotDefinition; onNotice: (m: string | null) => void }

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
        {def.notice ? <p className="anim-warn" role="note">{def.notice}</p> : null}
        {def.presets && def.presets.length > 0 ? (
          <SelectField label="Preset" value={el.preset ?? ''} options={presets} onChange={(v) => setComponentPreset(el.id, v || null)} />
        ) : null}
        {Object.entries(def.settingsSchema).map(([k, f]) => (
          <Field key={k} id={el.id} name={k} field={f} value={props[k] ?? f.default} />
        ))}
        <button type="button" className="secondary small-btn" disabled={Object.keys(el.props).length === 0}
          onClick={() => resetComponentProps(el.id)}>
          Reset to {el.preset ? 'preset' : 'defaults'}
        </button>
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
