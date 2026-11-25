import { EMPHASIS_PRESETS, defaultEmphasis, emphasisAmount } from '@/model/animation';
import type { BannerElement, Easing, EmphasisStep, ID } from '@/model/types';
import { mutateSize } from '../mutate';
import { findElement } from '../ops';
import { useEditorStore } from '../store/editorStore';
import { NumberField, type Opt, SelectField } from './fields';

const EASINGS: Opt<string> = [
  ['ease-in-out', 'Ease in-out'], ['ease-out', 'Ease out'], ['ease-in', 'Ease in'], ['ease', 'Ease'], ['linear', 'Linear'],
  ['cubic-bezier(0.34,1.56,0.64,1)', 'Back (overshoot)'],
];
const fmt = (n: number): string => String(Math.round(n * 100) / 100);

/** Each field has its own coalesce key, so typing a value is one undo step. */
function editEmph(id: ID, field: string, fn: (el: BannerElement) => void): void {
  const { activeSizeId, update } = useEditorStore.getState();
  if (!activeSizeId) return;
  update(
    (d) => mutateSize(d, activeSizeId, (s) => {
      const el = findElement(s.elements, id);
      if (el) fn(el);
    }),
    { coalesceKey: `${id}:anim:emph:${field}` },
  );
}

/** Emphasis (pulse, bounce, wiggle, flash): Repeat cycles played within Length, between the entrance and the exit. */
export function EmphasisEditor({ el }: { el: BannerElement }) {
  const step = el.animation.emphasis ?? null;
  const set = (field: string, fn: (s: EmphasisStep) => void) =>
    editEmph(el.id, field, (e) => { const s = e.animation.emphasis; if (s) fn(s); });
  const amount = step ? emphasisAmount(step.preset) : undefined;
  const easing = step?.easing ?? 'ease-in-out';
  const easings: Opt<string> = EASINGS.some(([v]) => v === easing) ? EASINGS : [[easing, easing], ...EASINGS];

  return (
    <div className="anim-step">
      <SelectField
        label="Emphasis"
        value={step?.preset ?? 'none'}
        options={EMPHASIS_PRESETS}
        onChange={(p) => editEmph(el.id, 'preset', (e) => {
          if (p === 'none') { e.animation.emphasis = null; return; }
          const cur = e.animation.emphasis;
          if (cur) {
            cur.preset = p;
            const a = emphasisAmount(p);
            if (a) cur.amount = a.default;
            else delete cur.amount;
          } else {
            e.animation.emphasis = defaultEmphasis(p, e);
          }
        })}
      />
      {step && (
        <>
          <div className="grid2">
            <NumberField label="Delay" ariaLabel="Emphasis delay" suffix="s" min={0} step={0.1} value={step.delay}
              onChange={(v) => set('delay', (s) => { s.delay = v; })} />
            <NumberField label="Length" ariaLabel="Emphasis duration" suffix="s" min={0.1} step={0.1} value={step.duration}
              onChange={(v) => set('duration', (s) => { s.duration = v; })} />
            <NumberField label="Repeat" ariaLabel="Emphasis repeat" suffix="×" min={1} max={10} value={step.repeat}
              onChange={(v) => set('repeat', (s) => { s.repeat = Math.max(1, Math.min(10, Math.round(v))); })} />
            {amount && (
              <NumberField label={amount.label} ariaLabel={`Emphasis ${amount.label.toLowerCase()}`} suffix={amount.suffix}
                min={amount.min} max={amount.max} value={step.amount ?? amount.default}
                onChange={(v) => set('amount', (s) => { s.amount = v; })} />
            )}
          </div>
          <SelectField<string> label="Emphasis easing" value={easing} options={easings}
            onChange={(v) => set('easing', (s) => { s.easing = v as Easing; })} />
          <p className="muted small">
            {step.repeat} × in {fmt(step.duration)} s ({fmt(step.duration / Math.max(1, step.repeat))} s each)
          </p>
        </>
      )}
    </div>
  );
}
