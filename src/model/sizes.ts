export interface StandardSize { width: number; height: number; label: string }

/** Every project has exactly one master, always 480×480. Other sizes are generated from it. */
export const MASTER_SIZE: StandardSize = { width: 480, height: 480, label: 'Master' };

/** Sizes offered in the "Add sizes" dialog. Anything else can be added as a custom size. */
export const STANDARD_SIZES: readonly StandardSize[] = [
  { width: 300, height: 250, label: 'Medium Rectangle' },
  { width: 300, height: 300, label: 'Square' },
  { width: 300, height: 600, label: 'Half Page' },
  { width: 480, height: 300, label: 'Landscape' },
  { width: 320, height: 480, label: 'Mobile Interstitial' },
  { width: 970, height: 250, label: 'Billboard' },
];

export const sizeKey = (w: number, h: number): string => `${w}x${h}`;

export const isMasterSize = (s: { width: number; height: number }): boolean =>
  s.width === MASTER_SIZE.width && s.height === MASTER_SIZE.height;
