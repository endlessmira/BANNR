import {
  ANIMATION_PRESETS, DEFAULT_DISTANCE, animationEnd, defaultStep, elementIssues, fitLoop, isSlide, loopIssues, totalSeconds,
} from '@/model/animation';
import type { AnimationStep, BannerElement, Easing, ElementAnimation, ID, Size } from '@/model/types';
import { mutateSize } from '../mutate';
import { findElement, findSize } from '../ops';
import { useEditorStore } from '../store/editorStore';
import { NumberField, type Opt, Section, SelectField } from './fields';
import { EmphasisEditor } from './EmphasisEditor';

const EASINGS: Opt<string> = [
  ['ease-out', 'Ease out'], ['ease-in', 'Ease in'], ['ease-in-out', 'Ease in-out'], ['ease', 'Ease'], ['linear', 'Linear'],
  ['cubic-bezier(0.34,1.56,0.64,1)', 'Back (overshoot)'],
];
const fmtS = (n: number): string => `${Math.round(n * 100) / 100} s`;

/** Each field has its own coalesce key, so typing a value is one undo step. */
function editAnim(id: ID, field: string, fn: (a: ElementAnimation) => void): void {
  const { activeSizeId, update } = useEditorStore.getState();
  if (!activeSizeId) return;
  update(
    (d) => mutateSize(d, activeSizeId, (s) => {
      const el = findElement(s.elements, id);
      if (el) fn(el.animation);
    }),
    { coalesceKey: `${id}:anim:${field}` },
  );
}

interface StepProps { id: ID; phase: 'in' | 'out'; step: AnimationStep | null; loop: number }

function StepEditor({ id, phase, step, loop }: StepProps) {
  const label = phase === 'in' ? 'Entrance' : 'Exit';
  const set = (field: string, fn: (s: AnimationStep) => void) =>
    editAnim(id, `${phase}:${field}`, (a) => { const s = a[phase]; if (s) fn(s); });
  const easings: Opt<string> = step && !EASINGS.some(([v]) => v === step.easing) ? [[step.easing, step.easing], ...EASINGS] : EASINGS;

  return (
    <div className="anim-step">
      <SelectField
        label={label}
        value={step?.preset ?? 'none'}
        options={ANIMATION_PRESETS}
        onChange={(p) => editAnim(id, `${phase}:preset`, (a) => {
          if (p === 'none') { a[phase] = null; return; }
          const cur = a[phase];
          if (cur) {
            cur.preset = p;
            if (isSlide(p) && cur.distance === undefined) cur.distance = DEFAULT_DISTANCE;
          } else {
            a[phase] = defaultStep(phase, p, loop);
          }
        })}
      />
      {step && (
        <>
          <div className="grid2">
            <NumberField label="Delay" ariaLabel={`${label} delay`} suffix="s" min={0} step={0.1} value={step.delay}
              onChange={(v) => set('delay', (s) => { s.delay = v; })} />
            <NumberField label="Length" ariaLabel={`${label} duration`} suffix="s" min={0.05} step={0.1} value={step.duration}
              onChange={(v) => set('duration', (s) => { s.duration = v; })} />
          </div>
          <SelectField<string> label="Easing" value={step.easing} options={easings}
            onChange={(v) => set('easing', (s) => { s.easing = v as Easing; })} />
          {isSlide(step.preset) && (
            <NumberField label="Distance" ariaLabel={`${label} distance`} suffix="px" min={0} value={step.distance ?? DEFAULT_DISTANCE}
              onChange={(v) => set('distance', (s) => { s.distance = v; })} />
          )}
        </>
      )}
    </div>
  );
}

/** Entrance and exit animation for one element. */
export function AnimationSection({ el }: { el: BannerElement }) {
  const loop = useEditorStore((s) => (s.project ? findSize(s.project, s.activeSizeId)?.animationSettings.duration : undefined) ?? 15);
  const issues = elementIssues(el, loop);
  return (
    <Section title="Animation">
      <StepEditor id={el.id} phase="in" step={el.animation.in} loop={loop} />
      <EmphasisEditor el={el} />
      <StepEditor id={el.id} phase="out" step={el.animation.out} loop={loop} />
      {issues.map((t) => <p key={t} className="anim-warn">{t}</p>)}
      <p className="muted small">Times are from the start of the animation. Play it in Preview; the canvas shows the resting state.</p>
    </Section>
  );
}

/** Animation length and play count for a banner size (shown when nothing is selected). */
export function LoopSettings({ size }: { size: Size }) {
  const settings = useEditorStore((s) => s.project?.settings);
  const a = size.animationSettings;
  const edit = (field: string, fn: (s: Size) => void) =>
    useEditorStore.getState().update((d) => mutateSize(d, size.id, fn), { coalesceKey: `${size.id}:${field}` });
  const applyAll = () => {
    const copy = { ...a };
    useEditorStore.getState().update((d) => { for (const s of d.sizes) s.animationSettings = { ...copy }; });
  };
  const end = animationEnd(size.elements);
  const issues = settings ? loopIssues(a, settings, size.elements) : [];

  return (
    <Section title="Animation timing">
      <div className="grid2">
        <NumberField label="Length" ariaLabel="Animation length" suffix="s" min={0.5} max={120} step={0.5} value={a.duration}
          onChange={(v) => edit('loop', (s) => { s.animationSettings.duration = v; })} />
        {a.loops > 1 && (
          <NumberField label="Plays" min={2} max={10} value={a.loops}
            onChange={(v) => edit('plays', (s) => { s.animationSettings.loops = Math.max(2, Math.round(v)); })} />
        )}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={a.loops > 1}
          onChange={(e) => {
            const on = e.target.checked;
            edit('repeat', (s) => { s.animationSettings.loops = on ? 2 : 1; });
          }}
        />
        Repeat animation
      </label>
      <p className="muted small">
        Total {fmtS(totalSeconds(a))} · animations end at {fmtS(end)}
        {settings ? ` · limit ${settings.maxAnimationSeconds} s, ${settings.maxLoops} plays` : ''}
      </p>
      {issues.map((t) => <p key={t} className="anim-warn">{t}</p>)}
      <div className="btn-row">
        <button type="button" className="secondary small-btn" disabled={end === 0}
          onClick={() => edit('fit', (s) => { s.animationSettings.duration = fitLoop(s.elements); })}>
          Fit to animations
        </button>
        <button type="button" className="secondary small-btn" onClick={applyAll}>Apply to all sizes</button>
      </div>
    </Section>
  );
}
