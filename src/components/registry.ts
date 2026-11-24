import { counter } from './counter';
import type { ComponentDefinition } from './types';

/** Every component, keyed by type. Adding a component = adding its folder and one line here. */
export const COMPONENTS: Readonly<Record<string, ComponentDefinition>> = {
  [counter.type]: counter,
};

export const getComponent = (type: string): ComponentDefinition | undefined =>
  Object.prototype.hasOwnProperty.call(COMPONENTS, type) ? COMPONENTS[type] : undefined;

export const listComponents = (): ComponentDefinition[] => Object.values(COMPONENTS);
