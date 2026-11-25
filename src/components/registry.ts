import { cascade } from './cascade';
import { clock } from './clock';
import { countdown } from './countdown';
import { counter } from './counter';
import { gradient_ } from './gradient';
import type { ComponentDefinition } from './types';

/** Every component, keyed by type. Adding a component = adding its folder and one line here. */
export const COMPONENTS: Readonly<Record<string, ComponentDefinition>> = Object.fromEntries(
  [cascade, gradient_, counter, countdown, clock].map((d) => [d.type, d]),
);

export const getComponent = (type: string): ComponentDefinition | undefined =>
  Object.prototype.hasOwnProperty.call(COMPONENTS, type) ? COMPONENTS[type] : undefined;

export const listComponents = (): ComponentDefinition[] => Object.values(COMPONENTS);
