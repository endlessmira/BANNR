import { DEFAULT_TARGET_KB } from '@/export/adapters/registry';
import type { PlatformAdapter, ValidationLevel, ValidationResult, ZipManifest } from '@/export/adapters/types';
import { animationEnd, totalSeconds } from '@/model/animation';
import type { Project, Size } from '@/model/types';
import { componentAllowedHosts, componentChecks } from './components';
import { jsString } from '@/renderer/escape';

/**
 * Shared pre-export checks. Platform-specific checks come from adapter.validate().
 * Errors block the export; warnings are shown but allow it.
 */
export interface CheckInput {
  project: Project;
  size: Size;
  adapter: PlatformAdapter;
  manifest: ZipManifest;
  missingAssets?: readonly string[];
  convertedWebp?: readonly string[];
}

const kbOf = (b: number): number => Math.round((b / 1024) * 10) / 10;
const fmtS = (n: number): string => `${Math.round(n * 100) / 100} s`;
const extOf = (p: string): string => {
  const i = p.lastIndexOf('.');
  return i < 0 ? '' : p.slice(i + 1).toLowerCase();
};
const res = (ruleId: string, level: ValidationLevel, message: string, detail?: string): ValidationResult =>
  detail === undefined ? { ruleId, level, message } : { ruleId, level, message, detail };

/** Text files that can make requests or open URLs. manifest.json is not scanned (it only lists the click tag). */
const SCANNED = new Set(['html', 'htm', 'js', 'css', 'svg']);
const RESOURCE = 'js|mjs|css|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|mp4|webm|json';
const URL_PATTERNS: readonly RegExp[] = [
  /\b(?:src|href|poster)\s*=\s*["']?(https?:\/\/[^"'\s>]+)/gi,
  /url\(\s*["']?(https?:\/\/[^"')\s]+)/gi,
  /@import\s+(?:url\(\s*)?["']?(https?:\/\/[^"')\s;]+)/gi,
  /\bfetch\(\s*["'](https?:\/\/[^"']+)/gi,
  new RegExp(`["'](https?:\\/\\/[^"'\\s]+?\\.(?:${RESOURCE}))(?=[?#"'])`, 'gi'),
];

/** URLs of files the banner would load from the network (plain links such as the landing URL are ignored). */
export function externalUrls(text: string): string[] {
  const out = new Set<string>();
  for (const re of URL_PATTERNS) for (const m of text.matchAll(re)) if (m[1]) out.add(m[1]);
  return [...out];
}

const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const EXIT_DEF = /bannr\.exit\s*=\s*function\s*\([^)]*\)\s*\{([^}]*)\}/g;
const WINDOW_OPEN = /\bwindow\.open\s*\(/g;
const LOCATION_WRITE = /\b(?:(?:window|top|parent|self|document)\.)?location(?:\.href)?\s*=(?!=)|\blocation\.(?:assign|replace)\s*\(/;
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

// Component checks live in ./components.ts

export function runChecks(input: CheckInput): ValidationResult[] {
  const { project, size, adapter, manifest } = input;
  const c = adapter.constraints;
  const label = adapter.label;
  const out: ValidationResult[] = [];
  const paths = manifest.entries.map((e) => e.path);
  const kb = kbOf(manifest.totalBytes);
  const target = project.settings.targetZipKB ?? DEFAULT_TARGET_KB;

  // ── Zip structure ──
  out.push(paths.includes('index.html')
    ? res('index-html', 'pass', 'index.html is at the zip root')
    : res('index-html', 'error', 'index.html is missing from the zip root'));

  out.push(kb > c.maxZipKB
    ? { ...res('zip-size', 'error', `The zip is ${kb} KB, over the ${label} limit of ${c.maxZipKB} KB. You can still export, but ${label} may reject the upload.`), blocks: false }
    : res('zip-size', 'pass', `The zip is ${kb} KB (${label} limit ${c.maxZipKB} KB)`));
  if (kb <= c.maxZipKB && kb > target) out.push(res('zip-target', 'warning', `The zip is ${kb} KB, over your ${target} KB target`));
  if (c.recommendedZipKB !== undefined && kb <= c.maxZipKB && kb > c.recommendedZipKB) {
    out.push(res('zip-recommended', 'warning', `The zip is ${kb} KB, over ${label}'s recommended ${c.recommendedZipKB} KB`));
  }

  out.push(paths.length > c.maxFiles
    ? res('file-count', 'error', `${paths.length} files, over the ${label} limit of ${c.maxFiles}`)
    : res('file-count', 'pass', `${paths.length} of ${c.maxFiles} files`));

  const warnExt = c.warnExtensions ?? [];
  const bad = paths.filter((p) => !c.allowedExtensions.includes(extOf(p)) && !warnExt.includes(extOf(p)));
  const unsure = paths.filter((p) => warnExt.includes(extOf(p)));
  if (bad.length > 0) out.push(res('file-types', 'error', `${label} does not accept these file types`, bad.join(', ')));
  else if (unsure.length === 0) out.push(res('file-types', 'pass', 'All file types are allowed'));
  if (unsure.length > 0) {
    out.push(res('file-types', 'warning', `${label} may not accept these files (not confirmed in its specs)`, unsure.join(', ')));
  }

  const missing = input.missingAssets ?? [];
  out.push(missing.length > 0
    ? res('missing-assets', 'error', `${missing.length} image or font file(s) could not be found. Upload them again.`)
    : res('missing-assets', 'pass', 'All images and fonts are included'));

  // ── Landing URL ──
  let url: URL | null = null;
  try {
    url = new URL(project.landingUrl);
  } catch {
    url = null;
  }
  if (project.landingUrl.trim() === '') {
    out.push(res('landing-url', 'warning', 'No landing URL yet. Set the click-through URL in the ad server or DSP before the campaign goes live.'));
  } else if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    out.push(res('landing-url', 'error', 'Enter a valid landing URL, starting with https://'));
  } else if (url.protocol === 'http:') {
    out.push(res('landing-url', 'warning', 'The landing URL uses http://. Most platforms expect https://.'));
  } else {
    out.push(res('landing-url', 'pass', 'The landing URL is valid'));
  }

  // ── Clicks: everything through bannr.exit() ──
  const texts = manifest.entries.filter((e) => e.text !== undefined && SCANNED.has(extOf(e.path)));
  const code = texts.map((e) => e.text ?? '').join('\n');
  const bodies = [...code.matchAll(EXIT_DEF)].map((m) => m[1] ?? '');
  out.push(bodies.length > 0
    ? res('exit-defined', 'pass', `bannr.exit() is defined by the ${label} click code`)
    : res('exit-defined', 'error', 'bannr.exit() is not defined, so clicks do nothing'));

  const opensInExit = bodies.reduce((n, b) => n + count(b, WINDOW_OPEN), 0);
  out.push(count(code, WINDOW_OPEN) > opensInExit || LOCATION_WRITE.test(code)
    ? res('exit-only', 'error', 'URLs are opened outside bannr.exit() (window.open or a location change)')
    : res('exit-only', 'pass', 'Only bannr.exit() opens URLs'));

  const landing = project.landingUrl.trim();
  const hardcoded = landing !== '' && bodies.some((b) => b.includes(jsString(landing)) || b.includes(landing));
  out.push(hardcoded
    ? res('exit-hardcoded', 'error', 'The click handler hardcodes the landing URL instead of using the platform click tag')
    : res('exit-hardcoded', 'pass', 'The click handler uses the platform click tag'));

  const external = [...new Set(texts.flatMap((e) => externalUrls(e.text ?? '')))]
    .filter((u) => !c.allowedExternalHosts.includes(hostOf(u)) && !componentAllowedHosts(size).includes(hostOf(u)));
  out.push(external.length > 0
    ? res('external-requests', 'error', 'The banner loads files from outside the zip', external.join(', '))
    : res('external-requests', 'pass',
      `No external requests${c.allowedExternalHosts.length > 0 ? ` (except ${c.allowedExternalHosts.join(', ')})` : ''}`));

  // ── Platform-specific rules ──
  out.push(...adapter.validate(manifest));

  // ── Animation ──
  const a = size.animationSettings;
  const s = project.settings;
  const total = totalSeconds(a);
  out.push(total > s.maxAnimationSeconds + 1e-9
    ? res('animation-length', 'error', `Total animation time ${fmtS(total)} is over the ${s.maxAnimationSeconds} s limit`)
    : res('animation-length', 'pass', `Animation time ${fmtS(total)} (limit ${s.maxAnimationSeconds} s)`));
  out.push(a.loops > s.maxLoops
    ? res('animation-loops', 'error', `${a.loops} plays, over the limit of ${s.maxLoops}`)
    : res('animation-loops', 'pass', `${a.loops} of ${s.maxLoops} plays`));
  const end = animationEnd(size.elements);
  if (end > a.duration + 1e-9) {
    out.push(res('animation-cutoff', 'warning', `Some animations end at ${fmtS(end)}, after the ${fmtS(a.duration)} loop, so they get cut off`));
  }

  // ── Notes ──
  const webp = input.convertedWebp ?? [];
  if (webp.length > 0) out.push(res('webp', 'pass', 'WebP images were converted to PNG', webp.join(', ')));
  out.push(...componentChecks(size));
  return out;
}
