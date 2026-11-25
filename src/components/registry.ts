import { cardswipe } from './cardswipe';
import { carousel } from './carousel';
import { carouselset } from './carouselset';
import { cascade } from './cascade';
import { catchGame } from './catch';
import { clock } from './clock';
import { countdown } from './countdown';
import { counter } from './counter';
import { cube } from './cube';
import { dragdrop } from './dragdrop';
import { flip } from './flip';
import { gradient_ } from './gradient';
import { hoverreveal } from './hoverreveal';
import { leadform } from './leadform';
import { memory } from './memory';
import { orbit } from './orbit';
import { panorama } from './panorama';
import { peel } from './peel';
import { scratch } from './scratch';
import { slice } from './slice';
import { tilt } from './tilt';
import { wipe } from './wipe';
import { zoom } from './zoom';
import type { ComponentDefinition } from './types';

/** Every component, keyed by type. Adding a component = adding its folder and one line here. */
export const COMPONENTS: Readonly<Record<string, ComponentDefinition>> = Object.fromEntries(
  [
    cascade, gradient_, cube, flip, tilt, orbit, carousel, carouselset, cardswipe, panorama,
    scratch, peel, wipe, hoverreveal, zoom, counter, countdown, clock, leadform, memory, catchGame, slice, dragdrop,
  ].map((d) => [d.type, d]),
);

export const getComponent = (type: string): ComponentDefinition | undefined =>
  Object.prototype.hasOwnProperty.call(COMPONENTS, type) ? COMPONENTS[type] : undefined;

export const listComponents = (): ComponentDefinition[] => Object.values(COMPONENTS);
