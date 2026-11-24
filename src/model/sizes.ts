export interface StandardSize { width: number; height: number; label: string }

export const STANDARD_SIZES: readonly StandardSize[] = [
  { width: 300, height: 250, label: 'Medium Rectangle' },
  { width: 728, height: 90, label: 'Leaderboard' },
  { width: 160, height: 600, label: 'Wide Skyscraper' },
  { width: 300, height: 600, label: 'Half Page' },
  { width: 320, height: 50, label: 'Mobile Leaderboard' },
  { width: 320, height: 480, label: 'Mobile Interstitial' },
  { width: 970, height: 250, label: 'Billboard' },
  { width: 336, height: 280, label: 'Large Rectangle' },
  { width: 468, height: 60, label: 'Full Banner' },
];

export const sizeKey = (w: number, h: number): string => `${w}x${h}`;
