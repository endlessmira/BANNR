import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Paint } from '@/model/types';
import { safeColor } from '@/renderer/css';
import { formatColor, parseColor, toHex } from '@/model/color';
import { ACCEPT_IMAGES } from '../assets';

export type Opt<T extends string> = ReadonlyArray<readonly [T, string]>;
const fmt = (n: number): string => String(Math.round(n * 100) / 100);

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="psec">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

interface NumberFieldProps {
  label: string;
  ariaLabel?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export function NumberField({ label, ariaLabel, value, onChange, min, max, step = 1, suffix }: NumberFieldProps) {
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(fmt(value)); }, [value, focused]);
  return (
    <label className="nf">
      <span>{label}</span>
      <input
        type="number"
        aria-label={ariaLabel ?? label}
        value={text}
        min={min}
        max={max}
        step={step}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setText(fmt(value)); }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const n = Number(raw);
          if (raw.trim() === '' || !Number.isFinite(n)) return;
          onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
        }}
      />
      {suffix && <em>{suffix}</em>}
    </label>
  );
}

/**
 * Colour picker + text box + opacity %. Used by every colour setting (layers, banner, components).
 * At 100% the value stays plain hex; below that it is saved as rgba().
 */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const parsed = parseColor(value);
  const base = parsed ?? { r: 0, g: 0, b: 0, a: 1 };
  return (
    <div className="cf-wrap">
      <label className="cf">
        <span>{label}</span>
        <input
          type="color"
          aria-label={`${label} picker`}
          value={toHex(base)}
          onChange={(e) => {
            const n = parseColor(e.target.value);
            // A fully transparent colour becomes visible again when a new colour is picked.
            if (n) onChange(formatColor({ ...n, a: base.a === 0 ? 1 : base.a }));
          }}
        />
        <input
          type="text"
          aria-label={label}
          spellCheck={false}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            if (safeColor(v, '') !== '') onChange(v.trim());
          }}
        />
      </label>
      <NumberField
        label="α"
        ariaLabel={`${label} opacity`}
        suffix="%"
        min={0}
        max={100}
        value={Math.round(base.a * 100)}
        onChange={(v) => { if (parsed) onChange(formatColor({ ...parsed, a: v / 100 })); }}
      />
    </div>
  );
}

export function SelectField<T extends string>(
  { label, value, options, onChange }: { label: string; value: T; options: Opt<T>; onChange: (v: T) => void },
) {
  return (
    <label className="sf">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

type PaintKind = 'none' | 'solid' | 'linear';
type Linear = Extract<Paint, { kind: 'linear' }>;
const WITH_NONE: Opt<PaintKind> = [['none', 'None'], ['solid', 'Solid'], ['linear', 'Gradient']];
const NO_NONE: Opt<PaintKind> = [['solid', 'Solid'], ['linear', 'Gradient']];

export function PaintField(
  { label, value, onChange, allowNone = true }:
  { label: string; value: Paint | undefined; onChange: (p: Paint | undefined) => void; allowNone?: boolean },
) {
  const solid = value?.kind === 'solid' ? value : null;
  const lin: Linear | null = value?.kind === 'linear' ? value : null;
  const kind: PaintKind = value?.kind ?? 'none';
  const base = solid?.color ?? lin?.stops[0]?.color ?? '#f2a902';
  const setStop = (p: Linear, i: number, c: string): Paint => ({
    ...p, stops: p.stops.map((s, j) => (j === i ? { ...s, color: c } : s)),
  });
  return (
    <div className="paint">
      <SelectField
        label={label}
        value={kind}
        options={allowNone ? WITH_NONE : NO_NONE}
        onChange={(k) => {
          if (k === 'none') onChange(undefined);
          else if (k === 'solid') onChange({ kind: 'solid', color: base });
          else onChange({ kind: 'linear', angle: 90, stops: [{ offset: 0, color: base }, { offset: 1, color: '#ffffff' }] });
        }}
      />
      {solid && <ColorField label={`${label} color`} value={solid.color} onChange={(c) => onChange({ kind: 'solid', color: c })} />}
      {lin && (
        <>
          <ColorField label="From" value={lin.stops[0]?.color ?? '#000000'} onChange={(c) => onChange(setStop(lin, 0, c))} />
          <ColorField
            label="To"
            value={lin.stops[lin.stops.length - 1]?.color ?? '#ffffff'}
            onChange={(c) => onChange(setStop(lin, lin.stops.length - 1, c))}
          />
          <NumberField label="Angle" ariaLabel={`${label} angle`} suffix="°" value={lin.angle} onChange={(a) => onChange({ ...lin, angle: a })} />
        </>
      )}
    </div>
  );
}

export function FileButton({ label, onFiles, multiple = false }: { label: string; onFiles: (files: File[]) => void; multiple?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="secondary small-btn" onClick={() => ref.current?.click()}>{label}</button>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT_IMAGES}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
    </>
  );
}
