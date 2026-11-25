import { useState } from 'react';
import type { BannerElement, BoxStyle, ComponentElement, GroupElement, ID, ImageElement, Size, TextStyle } from '@/model/types';
import type { UploadTarget } from '../assets';
import { FontsDialog } from '../fonts/FontsDialog';
import { fontOptions } from '../fonts/fontOptions';
import { AnimationSection, LoopSettings } from './AnimationSection';
import { ComponentSettings } from '../componentPanel/ComponentSettings';
import { canRotate } from '../componentPanel/actions';
import { normalizeAngle } from '../geometry';
import { mutateSize } from '../mutate';
import { findElement, setFrame } from '../ops';
import { useEditorStore } from '../store/editorStore';
import { ColorField, FileButton, NumberField, type Opt, PaintField, Section, SelectField } from './fields';

type OnUpload = (files: File[], target: UploadTarget) => void;

const WEIGHTS: Opt<string> = [
  ['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black'],
];
const STYLES: Opt<TextStyle['fontStyle']> = [['normal', 'Normal'], ['italic', 'Italic']];
const ALIGNS: Opt<TextStyle['align']> = [['left', 'Left'], ['center', 'Center'], ['right', 'Right']];
const VALIGNS: Opt<TextStyle['verticalAlign']> = [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']];
const CASES: Opt<TextStyle['textTransform']> = [
  ['none', 'As typed'], ['uppercase', 'UPPERCASE'], ['lowercase', 'lowercase'], ['capitalize', 'Capitalize'],
];
const FITS: Opt<ImageElement['fit']> = [['contain', 'Contain'], ['cover', 'Cover'], ['fill', 'Stretch']];
const BG_FITS: Opt<'cover' | 'contain'> = [['cover', 'Cover'], ['contain', 'Contain']];
const STROKES: Opt<'solid' | 'dashed' | 'dotted'> = [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']];
const TYPE_LABEL: Record<BannerElement['type'], string> = {
  text: 'Text', image: 'Image', shape: 'Shape', button: 'CTA button', group: 'Group', component: 'Component',
};
const SHADOW_KEYS = [['x', 'X'], ['y', 'Y'], ['blur', 'Blur'], ['spread', 'Spread']] as const;

/** Each field gets its own coalesce key, so typing or dragging a colour picker is one undo step. */
function editEl(id: ID, field: string, fn: (el: BannerElement) => void): void {
  const { activeSizeId, update } = useEditorStore.getState();
  if (!activeSizeId) return;
  update(
    (d) => mutateSize(d, activeSizeId, (s) => {
      const el = findElement(s.elements, id);
      if (el) fn(el);
    }),
    { coalesceKey: `${id}:${field}` },
  );
}

function editText(id: ID, field: string, fn: (t: TextStyle) => void): void {
  editEl(id, field, (el) => { if (el.type === 'text' || el.type === 'button') fn(el.textStyle); });
}

function editBox(id: ID, field: string, fn: (b: BoxStyle) => void): void {
  editEl(id, field, (el) => {
    if (el.type === 'group' || el.type === 'component') return;
    if (el.type === 'text' || el.type === 'image') fn(el.box ?? (el.box = {}));
    else fn(el.box);
  });
}

interface Props { size: Size; selected: BannerElement[]; onUpload: OnUpload }

export function PropertiesPanel({ size, selected, onUpload }: Props) {
  if (selected.length === 0) return <SizeProperties size={size} onUpload={onUpload} />;
  if (selected.length > 1) {
    return (
      <div className="props">
        <h2 className="props-title">{selected.length} layers selected</h2>
        <p className="muted small">
          Drag to move them together, use the toolbar to align or distribute, or press Ctrl/Cmd+G to group them.
        </p>
      </div>
    );
  }
  const el = selected[0];
  return el ? <ElementProperties key={el.id} el={el} onUpload={onUpload} /> : null;
}

function ElementProperties({ el, onUpload }: { el: BannerElement; onUpload: OnUpload }) {
  const id = el.id;
  const set = (field: string, fn: (e: BannerElement) => void) => editEl(id, field, fn);
  return (
    <div className="props">
      <h2 className="props-title">{el.name}</h2>
      <p className="muted small">{TYPE_LABEL[el.type]}{el.locked ? ' · locked' : ''}</p>
      {el.locked && <p className="notice">This layer is locked. Unlock it in the Layers panel to edit it.</p>}
      <fieldset className="props-body" disabled={el.locked}>
        <Section title="Layout">
          <div className="grid2">
            <NumberField label="X" value={el.x} onChange={(v) => set('x', (e) => setFrame(e, { x: v }))} />
            <NumberField label="Y" value={el.y} onChange={(v) => set('y', (e) => setFrame(e, { y: v }))} />
            <NumberField label="W" ariaLabel="Width" min={1} value={el.width} onChange={(v) => set('w', (e) => setFrame(e, { width: v }))} />
            <NumberField label="H" ariaLabel="Height" min={1} value={el.height} onChange={(v) => set('h', (e) => setFrame(e, { height: v }))} />
            <NumberField label="Rotate" ariaLabel="Rotation" suffix="°" value={el.rotation}
              onChange={(v) => set('rot', (e) => { if (canRotate(e)) e.rotation = normalizeAngle(v); })} />
            <NumberField label="Opacity" suffix="%" min={0} max={100} value={Math.round(el.opacity * 100)}
              onChange={(v) => set('op', (e) => { e.opacity = Math.min(1, Math.max(0, v / 100)); })} />
          </div>
        </Section>

        {el.type === 'text' && (
          <Section title="Text">
            <textarea
              className="ta"
              aria-label="Text content"
              rows={3}
              value={el.text}
              onChange={(ev) => { const v = ev.target.value; set('text', (e) => { if (e.type === 'text') e.text = v; }); }}
            />
          </Section>
        )}

        {el.type === 'button' && (
          <Section title="Label">
            <input
              className="ti"
              aria-label="Button label"
              value={el.label}
              onChange={(ev) => { const v = ev.target.value; set('label', (e) => { if (e.type === 'button') e.label = v; }); }}
            />
            <div className="grid2">
              <NumberField label="Pad X" ariaLabel="Padding X" min={0} value={el.padding.x}
                onChange={(v) => set('padx', (e) => { if (e.type === 'button') e.padding.x = v; })} />
              <NumberField label="Pad Y" ariaLabel="Padding Y" min={0} value={el.padding.y}
                onChange={(v) => set('pady', (e) => { if (e.type === 'button') e.padding.y = v; })} />
            </div>
          </Section>
        )}

        {(el.type === 'text' || el.type === 'button') && <Typography id={id} t={el.textStyle} isText={el.type === 'text'} />}
        {el.type === 'image' && <ImageSection el={el} onUpload={onUpload} />}
        {el.type !== 'group' && el.type !== 'component' && <BoxSections el={el} />}
        <AnimationSection el={el} />
        {el.type === 'component' && (
          <ComponentSettings el={el} />
        )}
        {el.type === 'group' && (
          <p className="muted small">Resizing a group scales its layers (not font sizes). Ungroup to edit layers individually.</p>
        )}
      </fieldset>
    </div>
  );
}

function Typography({ id, t, isText }: { id: ID; t: TextStyle; isText: boolean }) {
  const projectFonts = useEditorStore((s) => s.project?.fonts);
  const [fontsOpen, setFontsOpen] = useState(false);
  const fonts: Opt<string> = fontOptions(projectFonts ?? [], t.fontFamily);
  const ts = t.textShadow;
  return (
    <Section title="Typography">
      <SelectField label="Font" value={t.fontFamily} options={fonts} onChange={(v) => editText(id, 'font', (x) => { x.fontFamily = v; })} />
      <button type="button" className="secondary small-btn" onClick={() => setFontsOpen(true)}>Manage fonts…</button>
      {fontsOpen && <FontsDialog onClose={() => setFontsOpen(false)} />}
      <div className="grid2">
        <NumberField label="Size" ariaLabel="Font size" min={1} value={t.fontSize}
          onChange={(v) => editText(id, 'fs', (x) => { x.fontSize = Math.max(1, v); })} />
        <NumberField label="Line" ariaLabel="Line height" min={0.5} step={0.05} value={t.lineHeight}
          onChange={(v) => editText(id, 'lh', (x) => { x.lineHeight = v; })} />
        <NumberField label="Spacing" ariaLabel="Letter spacing" step={0.5} value={t.letterSpacing}
          onChange={(v) => editText(id, 'ls', (x) => { x.letterSpacing = v; })} />
      </div>
      <SelectField label="Weight" value={String(t.fontWeight)} options={WEIGHTS}
        onChange={(v) => editText(id, 'fw', (x) => { x.fontWeight = Number(v); })} />
      <SelectField label="Style" value={t.fontStyle} options={STYLES} onChange={(v) => editText(id, 'fst', (x) => { x.fontStyle = v; })} />
      <ColorField label="Text color" value={t.color} onChange={(c) => editText(id, 'color', (x) => { x.color = c; })} />
      <SelectField label="Align" value={t.align} options={ALIGNS} onChange={(v) => editText(id, 'align', (x) => { x.align = v; })} />
      {isText && (
        <SelectField label="Vertical" value={t.verticalAlign} options={VALIGNS}
          onChange={(v) => editText(id, 'valign', (x) => { x.verticalAlign = v; })} />
      )}
      <SelectField label="Case" value={t.textTransform} options={CASES} onChange={(v) => editText(id, 'case', (x) => { x.textTransform = v; })} />
      <label className="check">
        <input
          type="checkbox"
          checked={!!ts}
          onChange={(e) => {
            const on = e.target.checked;
            editText(id, 'ts-on', (x) => {
              if (on) x.textShadow = { x: 0, y: 2, blur: 4, color: 'rgba(0,0,0,0.5)' };
              else delete x.textShadow;
            });
          }}
        />
        Text shadow
      </label>
      {ts && (
        <>
          <div className="grid2">
            <NumberField label="X" ariaLabel="Text shadow X" value={ts.x} onChange={(v) => editText(id, 'tsx', (x) => { if (x.textShadow) x.textShadow.x = v; })} />
            <NumberField label="Y" ariaLabel="Text shadow Y" value={ts.y} onChange={(v) => editText(id, 'tsy', (x) => { if (x.textShadow) x.textShadow.y = v; })} />
            <NumberField label="Blur" ariaLabel="Text shadow blur" min={0} value={ts.blur}
              onChange={(v) => editText(id, 'tsb', (x) => { if (x.textShadow) x.textShadow.blur = v; })} />
          </div>
          <ColorField label="Text shadow color" value={ts.color} onChange={(c) => editText(id, 'tsc', (x) => { if (x.textShadow) x.textShadow.color = c; })} />
        </>
      )}
    </Section>
  );
}

function ImageSection({ el, onUpload }: { el: ImageElement; onUpload: OnUpload }) {
  const id = el.id;
  return (
    <Section title="Image">
      <SelectField label="Fit" value={el.fit} options={FITS} onChange={(v) => editEl(id, 'fit', (e) => { if (e.type === 'image') e.fit = v; })} />
      <label className="sf">
        <span>Alt</span>
        <input
          className="ti"
          aria-label="Alt text"
          value={el.alt ?? ''}
          onChange={(ev) => { const v = ev.target.value; editEl(id, 'alt', (e) => { if (e.type === 'image') e.alt = v; }); }}
        />
      </label>
      <FileButton label="Replace image…" onFiles={(f) => onUpload(f.slice(0, 1), { kind: 'replace', elementId: id })} />
    </Section>
  );
}

function BoxSections({ el }: { el: Exclude<BannerElement, GroupElement | ComponentElement> }) {
  const id = el.id;
  const box = el.box;
  const stroke = box?.stroke;
  const shadow = box?.shadows?.[0];
  const r = box?.radius;
  const radius = typeof r === 'number' ? r : r ? Math.max(...r) : 0;
  const canRound = !(el.type === 'shape' && el.shape === 'ellipse');
  return (
    <>
      <Section title="Fill">
        <PaintField label="Fill" value={box?.fill} onChange={(p) => editBox(id, 'fill', (b) => { if (p) b.fill = p; else delete b.fill; })} />
      </Section>

      <Section title="Stroke">
        <label className="check">
          <input
            type="checkbox"
            checked={!!stroke}
            onChange={(e) => {
              const on = e.target.checked;
              editBox(id, 'st-on', (b) => {
                if (on) b.stroke = { width: 1, color: '#000000', style: 'solid' };
                else delete b.stroke;
              });
            }}
          />
          Stroke
        </label>
        {stroke && (
          <>
            <div className="grid2">
              <NumberField label="Width" ariaLabel="Stroke width" min={0} value={stroke.width}
                onChange={(v) => editBox(id, 'stw', (b) => { if (b.stroke) b.stroke.width = v; })} />
              <SelectField label="Style" value={stroke.style} options={STROKES}
                onChange={(v) => editBox(id, 'sts', (b) => { if (b.stroke) b.stroke.style = v; })} />
            </div>
            <ColorField label="Stroke color" value={stroke.color} onChange={(c) => editBox(id, 'stc', (b) => { if (b.stroke) b.stroke.color = c; })} />
          </>
        )}
        {canRound && (
          <NumberField label="Radius" ariaLabel="Corner radius" min={0} value={radius}
            onChange={(v) => editBox(id, 'rad', (b) => { b.radius = v; })} />
        )}
      </Section>

      <Section title="Shadow">
        <label className="check">
          <input
            type="checkbox"
            checked={!!shadow}
            onChange={(e) => {
              const on = e.target.checked;
              editBox(id, 'sh-on', (b) => {
                if (on) b.shadows = [{ x: 0, y: 4, blur: 12, spread: 0, color: 'rgba(0,0,0,0.35)' }];
                else delete b.shadows;
              });
            }}
          />
          Drop shadow
        </label>
        {shadow && (
          <>
            <div className="grid2">
              {SHADOW_KEYS.map(([k, label]) => (
                <NumberField
                  key={k}
                  label={label}
                  ariaLabel={`Shadow ${k}`}
                  min={k === 'blur' ? 0 : undefined}
                  value={shadow[k]}
                  onChange={(v) => editBox(id, `sh-${k}`, (b) => { const s0 = b.shadows?.[0]; if (s0) s0[k] = v; })}
                />
              ))}
            </div>
            <ColorField label="Shadow color" value={shadow.color}
              onChange={(c) => editBox(id, 'sh-c', (b) => { const s0 = b.shadows?.[0]; if (s0) s0.color = c; })} />
          </>
        )}
      </Section>
    </>
  );
}

function SizeProperties({ size, onUpload }: { size: Size; onUpload: OnUpload }) {
  const sid = size.id;
  const assets = useEditorStore((s) => s.project?.assets);
  const edit = (field: string, fn: (s: Size) => void) =>
    useEditorStore.getState().update((d) => mutateSize(d, sid, fn), { coalesceKey: `${sid}:${field}` });
  const applyBorderToAll = () => {
    const border = { ...size.border };
    useEditorStore.getState().update((d) => { for (const s of d.sizes) s.border = { ...border }; });
  };
  const bgImg = size.background.image;
  const bgName = bgImg ? (assets?.[bgImg.assetId]?.fileName ?? 'image') : null;

  return (
    <div className="props">
      <h2 className="props-title">Banner {size.width}×{size.height}</h2>
      <p className="muted small">Nothing selected. These settings apply to this banner size.</p>
      <div className="props-body">
        <Section title="Background">
          <PaintField label="Background" allowNone={false} value={size.background.fill}
            onChange={(p) => { if (p) edit('bg', (s) => { s.background.fill = p; }); }} />
          {bgImg ? (
            <>
              <div className="asset-row">
                <span title={bgName ?? ''}>{bgName}</span>
                <button type="button" className="secondary small-btn" onClick={() => edit('bg-rm', (s) => { delete s.background.image; })}>
                  Remove
                </button>
              </div>
              <SelectField label="Image fit" value={bgImg.fit} options={BG_FITS}
                onChange={(v) => edit('bg-fit', (s) => { if (s.background.image) s.background.image.fit = v; })} />
            </>
          ) : (
            <FileButton label="Add background image…" onFiles={(f) => onUpload(f.slice(0, 1), { kind: 'background' })} />
          )}
        </Section>

        <LoopSettings size={size} />
        <Section title="Border">
          <label className="check">
            <input
              type="checkbox"
              checked={size.border.enabled}
              onChange={(e) => { const on = e.target.checked; edit('border-on', (s) => { s.border.enabled = on; }); }}
            />
            Add border
          </label>
          {size.border.enabled && (
            <>
              <ColorField label="Border color" value={size.border.color} onChange={(c) => edit('border-c', (s) => { s.border.color = c; })} />
              <NumberField label="Width" ariaLabel="Border width" min={1} max={10} suffix="px" value={size.border.width}
                onChange={(v) => edit('border-w', (s) => { s.border.width = Math.min(10, Math.max(1, Math.round(v))); })} />
              <button type="button" className="secondary small-btn" onClick={applyBorderToAll}>Apply to all sizes</button>
            </>
          )}
          <p className="muted small">Optional. Only needed if a publisher asks for a visible border.</p>
        </Section>
      </div>
    </div>
  );
}
