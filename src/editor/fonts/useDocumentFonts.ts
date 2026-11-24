import { useEffect } from 'react';
import type { ID, Project } from '@/model/types';
import { safeFontFamily } from '@/renderer/css';

const registered = new Map<string, FontFace>();

/**
 * The editor canvas draws the banner inside a Shadow DOM, where browsers don't reliably load
 * @font-face rules. So embedded fonts are also registered on the page itself. (The preview
 * iframe and the export use the @font-face rules from the renderer.)
 */
export function useDocumentFonts(project: Project | null, assetUrls: Record<ID, string>): void {
  const fonts = project?.fonts;
  useEffect(() => {
    const wanted = new Set<string>();
    for (const font of fonts ?? []) {
      for (const face of font.faces) {
        const url = assetUrls[face.assetId];
        if (!url) continue;
        const key = `${font.family}|${face.weight}|${face.style}|${face.unicodeRange ?? ''}|${face.assetId}`;
        wanted.add(key);
        if (registered.has(key)) continue;
        const ff = new FontFace(safeFontFamily(font.family), `url("${url}")`, {
          weight: String(face.weight),
          style: face.style,
          ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}),
        });
        registered.set(key, ff);
        document.fonts.add(ff);
        ff.load().catch(() => {
          document.fonts.delete(ff);
          registered.delete(key);
        });
      }
    }
    for (const [key, ff] of registered) {
      if (!wanted.has(key)) {
        document.fonts.delete(ff);
        registered.delete(key);
      }
    }
  }, [fonts, assetUrls]);
}
