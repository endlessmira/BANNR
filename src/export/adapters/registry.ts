import type { PlatformId } from '@/model/types';
import { adform } from './adform';
import { cm360 } from './cm360';
import { dv360 } from './dv360';
import { ttd } from './ttd';
import type { PlatformAdapter } from './types';

/** Banner weight target: over this is a warning, not an error. Becomes a project setting in Phase 5c. */
export const DEFAULT_TARGET_KB = 300;

export const ADAPTERS: Readonly<Record<PlatformId, PlatformAdapter>> = { adform, cm360, dv360, ttd };

export const getAdapter = (id: PlatformId): PlatformAdapter => ADAPTERS[id];
