import { type ReactNode, useEffect, useRef, useState, useLayoutEffect, useSyncExternalStore } from 'react';
import type { Paint } from '@/model/types';
import { safeColor } from '@/renderer/css';
import { formatColor, parseColor, toHex } from '@/model/color';
import { ACCEPT_IMAGES } from '../assets';

export type Opt<T extends string> = ReadonlyArray<readonly [T, string]>;
const fmt = (n: number): string => String(Math.round(n * 100) / 100);

/* Collapsible sections and the settings search. Shared by every Section; closed sections are remembered by title. */
const SECTIONS_KEY = 'bannr:closedSections';
const hasStorage = (): boolean => typeof localStorage !== 'undefined';
const closedSections: Set<string> = (() => {
  try {
    const v: unknown = hasStorage() ? JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '[]') : [];
    return new Set<string>(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set<string>();
  }
})();
let sectionQuery = '';
/** Sections that start closed until the user opens them. */
const DEFAULT_CLOSED: ReadonlySet<string> = new Set(['Fill', 'Stroke', 'Shadow']);
const OPENED_KEY = 'bannr:openedSections';
const openedSections: Set<string> = (() => {
  try {
    const v: unknown = hasStorage() ? JSON.parse(localStorage.getItem(OPENED_KEY) ?? '[]') : [];
    return new Set<string>(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set<string>();
  }
})();
const isOpen = (t: string): boolean => (DEFAULT_CLOSED.has(t) ? openedSections.has(t) : !closedSections.has(t));
const sectionSubs = new Set<() => void>();
function sectionsChanged(): void {
  if (hasStorage()) {
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify([...closedSections]));
      localStorage.setItem(OPENED_KEY, JSON.stringify([...openedSections]));
    } catch { /* storage blocked */ }
  }
  sectionSubs.forEach((f) => f());
}
const subscribeSections = (f: () => void): (() => void) => {
  sectionSubs.add(f);
  return () => { sectionSubs.delete(f); };
};
export function expandAllSections(): void {
  closedSections.clear();
  for (const t of DEFAULT_CLOSED) openedSections.add(t);
  sectionsChanged();
}
export function collapseSections(titles: readonly string[]): void {
  for (const t of titles) if (t) { closedSections.add(t); openedSections.delete(t); }
  sectionsChanged();
}
export function setSectionQuery(q: string): void { sectionQuery = q.trim().toLowerCase(); sectionsChanged(); }

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const open = useSyncExternalStore(subscribeSections, () => isOpen(title));
  const q = useSyncExternalStore(subscribeSections, () => sectionQuery);
  const ref = useRef<HTMLElement>(null);
  const show = open || q !== '';
  // While searching: show only the settings (and sections) that match.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const titleHit = q === '' || title.toLowerCase().includes(q);
    let any = titleHit;
    const body = root.querySelector(':scope > .psec-body');
    const kids: Element[] = body ? Array.from(body.children) : [];
    for (const c of kids) {
      const labels = Array.from(c.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label') ?? '').join(' ');
      const hit = titleHit || `${c.textContent ?? ''} ${labels}`.toLowerCase().includes(q);
      c.toggleAttribute('data-sq-hide', !hit);
      if (hit) any = true;
    }
    root.toggleAttribute('data-sq-hide', !any);
  });
  const toggle = () => {
    if (DEFAULT_CLOSED.has(title)) {
      if (open) openedSections.delete(title);
      else openedSections.add(title);
    } else if (open) closedSections.add(title);
    else closedSections.delete(title);
    sectionsChanged();
  };
  return (
    <section ref={ref} className="psec" data-title={title}>
      <h3>
        <button type="button" className="psec-toggle" aria-expanded={show} onClick={toggle}>
          <span className="psec-caret" aria-hidden="true">▾</span>
          {title}
        </button>
      </h3>
      {show ? <div className="psec-body">{children}</div> : null}
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
