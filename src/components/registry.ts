import { carousel } from './carousel';
import { cascade } from './cascade';
import { clock } from './clock';
import { countdown } from './countdown';
import { counter } from './counter';
import { cube } from './cube';
import { flip } from './flip';
import { gradient_ } from './gradient';
import { leadform } from './leadform';
import { orbit } from './orbit';
import { tilt } from './tilt';
import type { ComponentDefinition } from './types';

/** Every component, keyed by type. Adding a component = adding its folder and one line here. */
export const COMPONENTS: Readonly<Record<string, ComponentDefinition>> = Object.fromEntries(
  [cascade, gradient_, cube, flip, tilt, orbit, carousel, counter, countdown, clock, leadform].map((d) => [d.type, d]),
);

export const getComponent = (type: string): ComponentDefinition | undefined =>
  Object.prototype.hasOwnProperty.call(COMPONENTS, type) ? COMPONENTS[type] : undefined;

export const listComponents = (): ComponentDefinition[] => Object.values(COMPONENTS);
