import type { PlatformId } from './types';

// UI labels only. In Phase 5 these move to the adapter registry,
// which becomes the single source of truth for everything platform-specific.
export const PLATFORM_LABELS: Record<PlatformId, string> = {
  adform: 'Adform',
  cm360: 'Campaign Manager 360',
  dv360: 'Display & Video 360',
  ttd: 'The Trade Desk',
};
