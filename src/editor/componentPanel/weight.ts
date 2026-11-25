import type { ComponentDefinition } from '@/components/types';

/** Size of a component's code (JS + CSS), in KB with one decimal. */
export const componentWeightKB = (def: ComponentDefinition): number =>
  Math.round((new TextEncoder().encode(def.runtime + (def.styles ?? '')).length / 1024) * 10) / 10;
