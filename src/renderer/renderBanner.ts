import { getComponent } from '@/components/registry';
import type { ComponentDefinition } from '@/components/types';
import type { ID, Project, Size } from '@/model/types';
import { MOUNT_JS, RUNTIME_CSS, RUNTIME_JS } from '@/runtime/runtime';
import type { AnimationEngine } from './animation/engine';
import { staticEngine } from './animation/static';
import { BANNER_ROOT_ID, BORDER_Z, CLICK_LAYER_ID, CLICK_LAYER_Z, INTERACTIVE_CLASS } from './constants';
import { cssUrl, paintCss, px, rule, safeColor } from './css';
import { escapeHtml, jsString } from './escape';
import { collectFontFamilies, fontFaceCss } from './fonts';
import { type ComponentMode, type RenderContext, renderElements } from './renderElement';

export interface RenderOptions {
  /** Preview: data/absolute URLs. Export: relative paths such as "images/logo.png". */
  resolveAsset: (assetId: ID) => string;
  animationEngine?: AnimationEngine;
  /** 'backup' renders each component's backupState (backup image). Default 'live'. */
  componentMode?: ComponentMode;
  /** Platform adapter output (export) or the preview shim. bodyEnd defines bannr.exit() / bannr.track(). */
  injection?: { head?: string; bodyEnd?: string };
  cssMode?: 'inline' | 'external';
  jsMode?: 'inline' | 'external';
}

export interface RenderFragment {
  size: Size;
  css: string;
  /** Full banner root, including the click layer and border overlay. */
  bodyHtml: string;
  js: string;
  /** Only assets this size actually uses. The export pipeline copies just these. */
  usedAssetIds: ID[];
  externalScripts: string[];
  /** Component types used in this size (their code is included once each). */
  componentTypes: string[];
}

export interface RenderedDocument extends RenderFragment {
  html: string;
  files: Record<string, string>;
}

const BASE_CSS = [
  '*{box-sizing:border-box;margin:0;padding:0}',
  'html,body{width:100%;height:100%;overflow:hidden;background:transparent}',
  'body{-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}',
  'img{border:0}',
  // Clicks fall through ordinary layers to the click layer underneath; interactive components opt back in.
  '.el{pointer-events:none}',
  `.el.${INTERACTIVE_CLASS}{pointer-events:auto}`,
].join('\n');

/**
 * BANNR core: every click-through goes through bannr.exit(). The platform adapter (export) or the
 * preview defines exit/track; these no-op defaults keep a bare render safe. When a size uses
 * components, the shared runtime (src/runtime) and only those components' code are added.
 */
const CORE_JS = [
  'var bannr = window.bannr = window.bannr || {};',
  'bannr.exit = bannr.exit || function () {};',
  'bannr.track = bannr.track || function () {};',
  `var clickArea = document.getElementById(${jsString(CLICK_LAYER_ID)});`,
  "clickArea.addEventListener('click', function () { bannr.exit(); });",
].join('\n');

export function getSize(project: Project, sizeId: ID): Size {
  const size = project.sizes.find((s) => s.id === sizeId);
  if (!size) throw new Error(`Size "${sizeId}" not found in project "${project.id}"`);
  return size;
}

/** Pure. Used by the editor canvas (Shadow DOM), the preview iframe, the backup image and the exporter. */
export function renderFragment(
  project: Project,
  sizeId: ID,
  options: Pick<RenderOptions, 'resolveAsset' | 'animationEngine' | 'componentMode'>,
): RenderFragment {
  const size = getSize(project, sizeId);
  const engine = options.animationEngine ?? staticEngine;
  const used = new Set<ID>();
  const resolveAsset = (id: ID): string => {
    used.add(id);
    return options.resolveAsset(id);
  };
  const elementCss: string[] = [];
  const components = new Set<string>();
  const ctx: RenderContext = {
    size, animation: engine, css: elementCss, components, componentMode: options.componentMode ?? 'live', resolveAsset,
  };

  const fontCss = fontFaceCss(project, collectFontFamilies(size.elements), resolveAsset);
  const bg = size.background;
  const bgLayers = [
    bg.image ? `url("${cssUrl(resolveAsset(bg.image.assetId))}") center/${bg.image.fit} no-repeat` : undefined,
    paintCss(bg.fill),
  ].filter((v): v is string => Boolean(v));

  const elementsHtml = renderElements(size.elements, ctx);
  const defs = [...components].sort().map((t) => getComponent(t)).filter((d): d is ComponentDefinition => d !== undefined);
  const hasBorder = size.border.enabled && size.border.width > 0;

  const css = [
    fontCss,
    BASE_CSS,
    rule(`#${BANNER_ROOT_ID}`, {
      position: 'relative',
      overflow: 'hidden',
      width: px(size.width),
      height: px(size.height),
      background: bgLayers.join(',') || undefined,
      isolation: 'isolate',
    }),
    hasBorder
      ? rule('.bannr-border', {
          position: 'absolute',
          inset: '0',
          border: `${px(size.border.width)} solid ${safeColor(size.border.color, '#000')}`,
          'pointer-events': 'none',
          'z-index': BORDER_Z,
        })
      : '',
    rule(`#${CLICK_LAYER_ID}`, {
      position: 'absolute', inset: '0', cursor: 'pointer', background: 'transparent', 'z-index': CLICK_LAYER_Z,
    }),
    engine.globalCss(size, project),
    defs.length > 0 ? RUNTIME_CSS : '',
    ...defs.map((d) => d.styles ?? ''),
    ...elementCss,
  ]
    .filter(Boolean)
    .join('\n');

  // Click layer first (bottom), then the layers, then the border on top.
  const bodyHtml = [
    `<div id="${BANNER_ROOT_ID}">`,
    `<div id="${CLICK_LAYER_ID}" aria-label="${escapeHtml(project.name)}"></div>`,
    elementsHtml,
    hasBorder ? '<div class="bannr-border"></div>' : '',
    '</div>',
  ].join('');

  const js = [
    CORE_JS,
    engine.runtime(size, project),
    ...(defs.length > 0 ? [RUNTIME_JS, ...defs.map((d) => d.runtime), MOUNT_JS] : []),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    size, css, bodyHtml, js, usedAssetIds: [...used], externalScripts: [...engine.externalScripts],
    componentTypes: defs.map((d) => d.type),
  };
}

/** Pure. Builds the full index.html (plus style.css/script.js in external mode). */
export function renderBanner(project: Project, sizeId: ID, options: RenderOptions): RenderedDocument {
  const frag = renderFragment(project, sizeId, options);
  const cssMode = options.cssMode ?? 'inline';
  const jsMode = options.jsMode ?? 'inline';

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    options.injection?.head,
    `<title>${escapeHtml(project.name)}</title>`,
    cssMode === 'inline' ? `<style>\n${frag.css}\n</style>` : '<link rel="stylesheet" href="style.css">',
    '</head>',
    '<body>',
    frag.bodyHtml,
    jsMode === 'inline' ? `<script>\n${frag.js}\n<\/script>` : '<script src="script.js"><\/script>',
    options.injection?.bodyEnd,
    '</body>',
    '</html>',
  ]
    .filter((l): l is string => Boolean(l))
    .join('\n');

  const files: Record<string, string> = { 'index.html': html };
  if (cssMode === 'external') files['style.css'] = frag.css;
  if (jsMode === 'external') files['script.js'] = frag.js;

  return { ...frag, html, files };
}
