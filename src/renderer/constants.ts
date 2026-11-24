export const BANNER_ROOT_ID = 'banner';
export const CLICK_LAYER_ID = 'clickArea';
/** User z-indexes are clamped to 0..MAX_ELEMENT_Z. */
export const MAX_ELEMENT_Z = 100_000;
/** The optional border overlay sits above everything and ignores the pointer. */
export const BORDER_Z = 2_147_482_000;
/**
 * The click layer sits at the BOTTOM (first in the DOM, z-index 0). Ordinary layers ignore the
 * pointer (pointer-events:none), so clicks fall through to it. Interactive components
 * (capturesPointer) opt back in with INTERACTIVE_CLASS, so swipes and drags reach them.
 */
export const CLICK_LAYER_Z = 0;
export const INTERACTIVE_CLASS = 'bannr-interactive';
