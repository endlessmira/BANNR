import logoUrl from '@/assets/bannr-logo.svg';
import { DEMO_LOGO_ASSET_ID } from '@/model/demo';
import type { ID } from '@/model/types';

// Absolute URLs, so they also load inside the sandboxed preview iframe.
// Phase 2c adds blob URLs for uploaded images.
export const DEMO_ASSET_URLS: Record<ID, string> = {
  [DEMO_LOGO_ASSET_ID]: new URL(logoUrl, window.location.href).href,
};
