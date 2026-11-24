import { PLATFORM_LABELS } from '@/model/platforms';
import { jsString } from '@/renderer/escape';
import { BASE_EXTENSIONS, adSizeMeta, clickTagVarChecks } from './common';
import type { PlatformAdapter } from './types';

/**
 * GOOGLE DISPLAY & VIDEO 360
 * Spec: https://support.google.com/displayvideo/  (TODO: link the exact HTML5 creative requirements article)
 * Same code as CM360 today, kept as its own adapter so the two can diverge.
 * From search summaries (not verified on the official page): no upload size limit, but 5 MB max served,
 * up to 100 files, clickTag in the head and not minified, landing page opens in a new tab,
 * backup image uploaded separately. Allowed file types not found: CM360 list assumed.
 * Interaction tracking: no-op.
 */
const SPEC_URL = 'https://support.google.com/displayvideo/';

export const dv360: PlatformAdapter = {
  id: 'dv360',
  label: PLATFORM_LABELS.dv360,
  specUrl: SPEC_URL,
  injectHead: (size, project) =>
    [adSizeMeta(size), `<script type="text/javascript">var clickTag = ${jsString(project.landingUrl)};<\/script>`].join('\n'),
  injectClickScript: () =>
    `<script type="text/javascript">bannr.exit = function(){ window.open(window.clickTag, '_blank'); };<\/script>`,
  extraFiles: () => ({}),
  validate: (zip) => clickTagVarChecks(zip),
  constraints: { maxZipKB: 5120, maxFiles: 100, allowedExtensions: BASE_EXTENSIONS, allowedExternalHosts: [] },
};
