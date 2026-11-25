import { getComponent } from '@/components/registry';
import { sizeFit } from '@/components/fit';
import { missingSlots, resolveProps } from '@/components/settings';
import type { ValidationResult } from '@/export/adapters/types';
import type { BannerElement, ComponentElement, Size } from '@/model/types';

interface Found { el: ComponentElement; top: boolean }

function collect(els: readonly BannerElement[], top: boolean, out: Found[]): Found[] {
  for (const el of els) {
    if (el.hidden) continue;
    if (el.type === 'component') out.push({ el, top });
    else if (el.type === 'group') collect(el.children, false, out);
  }
  return out;
}

const dims = (w: number, h: number): string => `${Math.round(w)}×${Math.round(h)}`;

/** Component checks: known type, minimum size, required slots (errors) and fitting the banner (warning). */
export function componentChecks(size: Size): ValidationResult[] {
  const found = collect(size.elements, true, []);
  if (found.length === 0) return [];
  const out: ValidationResult[] = [];
  for (const { el, top } of found) {
    const name = `"${el.name}"`;
    const def = getComponent(el.componentType);
    if (!def) {
      out.push({ ruleId: 'component-unknown', level: 'error', message: `${name} uses an unknown component type "${el.componentType}"` });
      continue;
    }
    const min = def.minSize;
    if (size.width < min.width || size.height < min.height) {
      out.push({ ruleId: 'component-banner-size', level: 'error',
        message: `${def.label} needs a banner of at least ${dims(min.width, min.height)}` });
    }
    if (el.width < min.width - 0.5 || el.height < min.height - 0.5) {
      out.push({ ruleId: 'component-min-size', level: 'error',
        message: `${name} is ${dims(el.width, el.height)}, smaller than the ${def.label} minimum of ${dims(min.width, min.height)}` });
    }
    const missing = missingSlots(def, el.slots);
    if (missing.length > 0) {
      out.push({ ruleId: 'component-slots', level: 'error', message: `${name} has empty required slots`, detail: missing.join(', ') });
    }
    if (top) {
      const f = sizeFit(def, size.width, size.height);
      if (f.level === 'tight') out.push({ ruleId: 'component-size-fit', level: 'warning', message: `${name}: ${f.reason}`, detail: f.suggestion });
    }
    if (def.validate) out.push(...def.validate(resolveProps(def, el.props, el.preset), el.slots));
    const fits = el.x >= -0.5 && el.y >= -0.5 && el.x + el.width <= size.width + 0.5 && el.y + el.height <= size.height + 0.5;
    if (top && !fits) {
      out.push({ ruleId: 'component-fit', level: 'warning', message: `${name} does not fit inside the banner, so part of it is cut off` });
    }
  }
  if (!out.some((r) => r.level === 'error')) {
    out.push({ ruleId: 'components', level: 'pass', message: `${found.length} component layer${found.length === 1 ? '' : 's'} ready` });
  }
  return out;
}

/** Hosts that components in this size may reference (e.g. the Lead Form's privacy policy link). */
export function componentAllowedHosts(size: Size): string[] {
  const out: string[] = [];
  for (const { el } of collect(size.elements, true, [])) {
    const def = getComponent(el.componentType);
    if (def?.allowedHosts) out.push(...def.allowedHosts(resolveProps(def, el.props, el.preset)));
  }
  return out;
}
