import { isSafeUnicodeRange } from '@/model/fonts';
import type { BannerElement, ID, Project } from '@/model/types';
import { cssUrl, rule, safeFontFamily } from './css';

export function collectFontFamilies(elements: readonly BannerElement[], out = new Set<string>()): Set<string> {
  for (const el of elements) {
    if (el.hidden) continue;
    if (el.type === 'text' || el.type === 'button') out.add(el.textStyle.fontFamily);
    else if (el.type === 'component' && typeof el.props.fontFamily === 'string') out.add(el.props.fontFamily);
    else if (el.type === 'group') collectFontFamilies(el.children, out);
  }
  return out;
}

const FONT_FORMAT: Record<string, string> = {
  'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'truetype', 'font/otf': 'opentype',
};

/** Writes @font-face rules for embedded families this size uses. Other families fall back to system fonts. */
export function fontFaceCss(project: Project, families: Set<string>, resolveAsset: (id: ID) => string): string {
  const rules: string[] = [];
  for (const font of project.fonts) {
    if (!families.has(font.family)) continue;
    for (const face of font.faces) {
      const asset = project.assets[face.assetId];
      if (!asset) continue;
      const fmt = FONT_FORMAT[asset.mimeType];
      rules.push(
        rule('@font-face', {
          'font-family': `"${safeFontFamily(font.family)}"`,
          src: `url("${cssUrl(resolveAsset(face.assetId))}")${fmt ? ` format("${fmt}")` : ''}`,
          'font-weight': face.weight,
          'font-style': face.style,
          'font-display': 'block',
          'unicode-range': face.unicodeRange && isSafeUnicodeRange(face.unicodeRange) ? face.unicodeRange : undefined,
        }),
      );
    }
  }
  return rules.join('\n');
}
