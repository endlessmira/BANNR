import { PLATFORM_LABELS } from '@/model/platforms';
import { jsString } from '@/renderer/escape';
import { BASE_EXTENSIONS, adSizeMeta, clickTagVarChecks } from './common';
import type { PlatformAdapter } from './types';

/**
 * GOOGLE CAMPAIGN MANAGER 360
 * Spec: https://support.google.com/campaignmanager/  (TODO: link the exact HTML5 creative requirements article)
 * From search summaries of Google's docs (not verified on the official page): zip up to 10 MB (9.5 MB is the
 * safe working limit), up to 100 files, the types in BASE_EXTENSIONS, clickTag declared UNMINIFIED in the head,
 * ad.size meta tag in the head, backup image uploaded separately (never inside the zip).
 * Interaction tracking: no-op (custom counters need Studio Enabler, a different creative type).
 */
const SPEC_URL = 'https://support.google.com/campaignmanager/';

export const cm360: PlatformAdapter = {
  id: 'cm360',
  label: PLATFORM_LABELS.cm360,
  specUrl: SPEC_URL,
  injectHead: (size, project) =>
    [adSizeMeta(size), `<script type="text/javascript">var clickTag = ${jsString(project.landingUrl)};<\/script>`].join('\n'),
  injectClickScript: () =>
    `<script type="text/javascript">bannr.exit = function(){ window.open(window.clickTag, '_blank'); };<\/script>`,
  extraFiles: () => ({}),
  validate: (zip) => clickTagVarChecks(zip),
  constraints: { maxZipKB: 10240, maxFiles: 100, allowedExtensions: BASE_EXTENSIONS, allowedExternalHosts: [] },
};
