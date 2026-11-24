import { type GoogleFace, fontMime, googleCssUrl, mergeFaces, parseGoogleCss } from '@/model/fonts';
import { newId } from '@/model/ids';
import type { AssetRef, FontFaceRef, FontRef, ID } from '@/model/types';
import { assetStore } from '@/persistence';
import { registerAssetUrl } from '../assets';
import { useEditorStore } from '../store/editorStore';

/** Fonts split into more files than this (usually CJK fonts) are too big for banners. */
export const MAX_GOOGLE_FILES = 24;

export interface GoogleRequest { family: string; weights: number[]; italic: boolean; extended: boolean }
export interface FontResult { family: string; files: number; bytes: number; missing: string[] }

/** Adds faces + asset refs to the project in one undo step, merging into an existing family. */
function commit(family: string, source: FontRef['source'], faces: FontFaceRef[], refs: AssetRef[]): string {
  let name = family;
  useEditorStore.getState().update((d) => {
    for (const r of refs) d.assets[r.id] = r;
    const existing = d.fonts.find((f) => f.family.toLowerCase() === family.toLowerCase());
    if (existing) {
      existing.faces = mergeFaces(existing.faces, faces);
      name = existing.family;
    } else {
      d.fonts.push({ id: newId('f'), family, source, faces: mergeFaces([], faces) });
    }
  });
  return name;
}

async function storeFont(data: Blob, fileName: string, mime: string): Promise<AssetRef> {
  const blob = data.type === mime ? data : new Blob([data], { type: mime });
  const ref = await assetStore.put(blob, fileName);
  await registerAssetUrl(ref.id, blob);
  return ref;
}

async function fetchCss(url: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Could not reach Google Fonts. Check your internet connection.');
  }
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Google Fonts returned an error (${res.status}).`);
  return res.text();
}

/** Downloads a Google Font once and stores it in the project. Needs internet only at this moment. */
export async function addGoogleFont(req: GoogleRequest): Promise<FontResult> {
  const family = req.family.trim();
  if (!family) throw new Error('Enter a font name.');
  if (req.weights.length === 0) throw new Error('Pick at least one weight.');
  const missing: string[] = [];

  let css = await fetchCss(googleCssUrl(family, req.weights, req.italic));
  if (css === null) {
    // Some weights don't exist for this family: request them one by one.
    const parts: string[] = [];
    for (const w of req.weights) {
      const n = await fetchCss(googleCssUrl(family, [w]));
      if (n) parts.push(n);
      else missing.push(String(w));
      if (req.italic) {
        const i = await fetchCss(googleCssUrl(family, [w], true, false));
        if (i) parts.push(i);
        else missing.push(`${w} italic`);
      }
    }
    if (parts.length === 0) {
      throw new Error(`"${family}" was not found on Google Fonts, or has none of the chosen weights. Check the spelling (e.g. "Open Sans").`);
    }
    css = parts.join('\n');
  }

  const all = parseGoogleCss(css);
  const wanted = new Set(['latin', 'all', ...(req.extended ? ['latin-ext'] : [])]);
  let faces: GoogleFace[] = all.filter((f) => wanted.has(f.subset));
  if (faces.length === 0) faces = all;
  const urls = [...new Set(faces.map((f) => f.url))];
  if (urls.length === 0) throw new Error(`Google Fonts sent no usable font files for "${family}".`);
  if (urls.length > MAX_GOOGLE_FILES) {
    throw new Error(`"${family}" is split into ${urls.length} files, which is too large for a banner (this is typical for Chinese, Japanese and Korean fonts).`);
  }

  const name = all[0]?.family || family;
  const refs = new Map<string, AssetRef>();
  for (const url of urls) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new Error('Could not download the font files. Check your internet connection.');
    }
    if (!res.ok) throw new Error(`Could not download a font file (${res.status}).`);
    const f = faces.find((x) => x.url === url)!;
    const fileName = `${name}-${f.weight}${f.style === 'italic' ? 'i' : ''}-${f.subset}.woff2`;
    refs.set(url, await storeFont(await res.blob(), fileName, fontMime(url) ?? 'font/woff2'));
  }

  const faceRefs: FontFaceRef[] = faces.map((f) => ({
    weight: f.weight,
    style: f.style,
    assetId: refs.get(f.url)!.id,
    ...(f.unicodeRange ? { unicodeRange: f.unicodeRange } : {}),
  }));
  const list = [...refs.values()];
  return {
    family: commit(name, 'google', faceRefs, list),
    files: list.length,
    bytes: list.reduce((s, r) => s + r.bytes, 0),
    missing,
  };
}

/** Stores an uploaded font file after checking that the browser can read it. */
export async function uploadFontFile(file: File, family: string, weight: number, style: 'normal' | 'italic'): Promise<FontResult> {
  const mime = fontMime(file.name);
  if (!mime) throw new Error(`${file.name}: unsupported font file. Use WOFF2, WOFF, TTF or OTF.`);
  const name = family.trim();
  if (!name) throw new Error('Enter a font family name.');
  const buffer = await file.arrayBuffer();
  try {
    await new FontFace('bannr-font-check', buffer.slice(0)).load();
  } catch {
    throw new Error(`${file.name} could not be read as a font. The file may be damaged.`);
  }
  const ref = await storeFont(new Blob([buffer], { type: mime }), file.name, mime);
  return { family: commit(name, 'upload', [{ weight, style, assetId: ref.id }], [ref]), files: 1, bytes: ref.bytes, missing: [] };
}

/** Removes a font family from the project (undoable). Text using it falls back to Arial. */
export function removeFont(fontId: ID): void {
  useEditorStore.getState().update((d) => {
    const font = d.fonts.find((f) => f.id === fontId);
    if (!font) return;
    d.fonts = d.fonts.filter((f) => f.id !== fontId);
    const stillUsed = new Set(d.fonts.flatMap((f) => f.faces.map((x) => x.assetId)));
    for (const face of font.faces) if (!stillUsed.has(face.assetId)) delete d.assets[face.assetId];
  });
}
