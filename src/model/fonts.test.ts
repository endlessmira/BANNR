import { describe, expect, it } from 'vitest';
import { fontFaceCss } from '@/renderer/fonts';
import { createProject } from './factories';
import { googleCssUrl, guessFromFileName, isSafeUnicodeRange, mergeFaces, parseGoogleCss } from './fonts';

const CSS = `/* latin-ext */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/opensans/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+1E00-1EFF;
}
/* latin */
@font-face {
  font-family: 'Open Sans';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/opensans/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
/* evil */
@font-face { font-family: 'X'; src: url(https://evil.example/x.woff2); }`;

describe('fonts', () => {
  it('builds Google Fonts URLs with sorted axes', () => {
    expect(googleCssUrl('Open Sans', [700, 400])).toBe('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');
    expect(googleCssUrl('Roboto', [700, 400], true)).toBe('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,700;1,400;1,700&display=swap');
    expect(googleCssUrl('Roboto', [700], true, false)).toBe('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@1,700&display=swap');
  });

  it('parses Google CSS and ignores files from other hosts', () => {
    const faces = parseGoogleCss(CSS);
    expect(faces).toHaveLength(2);
    expect(faces[0]).toEqual({
      family: 'Open Sans', subset: 'latin-ext', style: 'normal', weight: 700,
      url: 'https://fonts.gstatic.com/s/opensans/ext.woff2', unicodeRange: 'U+0100-02BA, U+1E00-1EFF',
    });
    expect(faces[1]).toMatchObject({ subset: 'latin', style: 'italic', weight: 400 });
  });

  it('accepts only safe unicode ranges', () => {
    expect(isSafeUnicodeRange('U+0000-00FF, U+0131')).toBe(true);
    expect(isSafeUnicodeRange('U+0000;}body{color:red')).toBe(false);
  });

  it('guesses family, weight and style from file names', () => {
    expect(guessFromFileName('OpenSans-SemiBoldItalic.woff2')).toEqual({ family: 'Open Sans', weight: 600, style: 'italic' });
    expect(guessFromFileName('brand_bold.ttf')).toEqual({ family: 'brand', weight: 700, style: 'normal' });
    expect(guessFromFileName('Logo.otf')).toEqual({ family: 'Logo', weight: 400, style: 'normal' });
    expect(guessFromFileName('Inter-ExtraLight.woff')).toMatchObject({ weight: 200 });
  });

  it('merges faces, replacing duplicates', () => {
    const merged = mergeFaces(
      [{ weight: 700, style: 'normal', assetId: 'b' }, { weight: 400, style: 'normal', assetId: 'a' }],
      [{ weight: 400, style: 'normal', assetId: 'c' }],
    );
    expect(merged.map((f) => [f.weight, f.assetId])).toEqual([[400, 'c'], [700, 'b']]);
  });

  it('renders @font-face with safe unicode ranges, only for used families', () => {
    const p = createProject('F', { platform: 'cm360' });
    p.fonts.push({
      id: 'f1', family: 'Open Sans', source: 'google',
      faces: [
        { weight: 400, style: 'normal', assetId: 'a1', unicodeRange: 'U+0000-00FF' },
        { weight: 700, style: 'normal', assetId: 'a2', unicodeRange: 'bad;}' },
      ],
    });
    p.assets.a1 = { id: 'a1', kind: 'font', fileName: 'a1.woff2', mimeType: 'font/woff2', bytes: 1, hash: 'h1' };
    p.assets.a2 = { id: 'a2', kind: 'font', fileName: 'a2.woff2', mimeType: 'font/woff2', bytes: 1, hash: 'h2' };
    const css = fontFaceCss(p, new Set(['Open Sans']), (id) => `fonts/${id}.woff2`);
    expect(css).toContain('src:url("fonts/a1.woff2") format("woff2")');
    expect(css).toContain('unicode-range:U+0000-00FF');
    expect(css).not.toContain('bad;}');
    expect(fontFaceCss(p, new Set(['Arial']), (id) => id)).toBe('');
  });
});
