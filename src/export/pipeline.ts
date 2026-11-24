import JSZip from 'jszip';
import type { ID, Project, Size } from '@/model/types';
import { sanitizeFileName } from '@/persistence/hash';
import { getSize, renderBanner } from '@/renderer';
import { cssKeyframesEngine } from '@/renderer/animation/cssKeyframes';
import { getAdapter } from './adapters/registry';
import type { ZipEntry, ZipManifest } from './adapters/types';

/** Browser-only work (reading stored files, converting WebP) is injected, so the pipeline runs in unit tests. */
export interface ExportDeps {
  loadAsset(id: ID): Promise<Blob | undefined>;
  webpToPng(blob: Blob): Promise<Blob>;
}

export interface PlannedAsset { path: string; convertWebp: boolean }

export interface SizeExport {
  size: Size;
  fileName: string;
  zip: ArrayBuffer;
  manifest: ZipManifest;
  /** Assets referenced by the banner whose file could not be found (left out of the zip). */
  missingAssets: ID[];
  /** Original names of WebP files converted to PNG. */
  convertedWebp: string[];
}

export interface BackupFile { name: string; blob: Blob }

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp',
  'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'font/otf': 'otf',
};

/** "Jarní výprodej!" → "Jarni-vyprodej". Safe for every ad server and operating system. */
export function safeName(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'banner';
}

/** {{PROJECT_NAME}}_{{PLATFORM}}_{{WIDTH}}x{{HEIGHT}} */
export const exportBaseName = (p: Project, s: Size): string =>
  `${safeName(p.name)}_${p.selectedPlatform}_${Math.round(s.width)}x${Math.round(s.height)}`;

export const allSizesName = (p: Project): string => `${safeName(p.name)}_${p.selectedPlatform}_all-sizes.zip`;

/** A unique, relative path for every asset: images/… or fonts/…. WebP files become PNG. */
export function planAssetPaths(project: Project): Map<ID, PlannedAsset> {
  const out = new Map<ID, PlannedAsset>();
  const taken = new Set<string>();
  for (const ref of Object.values(project.assets)) {
    const folder = ref.kind === 'font' ? 'fonts' : 'images';
    const convertWebp = ref.mimeType === 'image/webp';
    const clean = sanitizeFileName(ref.fileName);
    const dot = clean.lastIndexOf('.');
    const stem = (dot > 0 ? clean.slice(0, dot) : clean) || ref.id;
    const ext = convertWebp ? 'png' : (EXT_BY_MIME[ref.mimeType] ?? (dot > 0 ? clean.slice(dot + 1) : 'bin'));
    let path = `${folder}/${stem}.${ext}`;
    for (let n = 2; taken.has(path); n++) path = `${folder}/${stem}-${n}.${ext}`;
    taken.add(path);
    out.set(ref.id, { path, convertWebp });
  }
  return out;
}

/** One ad-server-ready zip for one size: index.html at the root, platform files, only the assets this size uses. */
export async function buildSizeZip(project: Project, sizeId: ID, deps: ExportDeps): Promise<SizeExport> {
  const size = getSize(project, sizeId);
  const adapter = getAdapter(project.selectedPlatform);
  const plan = planAssetPaths(project);
  const doc = renderBanner(project, sizeId, {
    resolveAsset: (id) => plan.get(id)?.path ?? `images/${id}`,
    animationEngine: cssKeyframesEngine,
    injection: { head: adapter.injectHead(size, project), bodyEnd: adapter.injectClickScript(project) },
  });

  const zip = new JSZip();
  const entries: ZipEntry[] = [];
  const enc = new TextEncoder();
  const addText = (path: string, text: string) => {
    zip.file(path, text, { createFolders: false });
    entries.push({ path, text, bytes: enc.encode(text).length });
  };

  for (const [path, text] of Object.entries(doc.files)) addText(path, text);
  for (const [path, v] of Object.entries(adapter.extraFiles(size, project))) {
    if (typeof v === 'string') {
      addText(path, v);
    } else {
      const buf = await v.arrayBuffer();
      zip.file(path, buf, { createFolders: false, binary: true });
      entries.push({ path, bytes: buf.byteLength });
    }
  }

  const missingAssets: ID[] = [];
  const convertedWebp: string[] = [];
  for (const id of doc.usedAssetIds) {
    const planned = plan.get(id);
    let blob = await deps.loadAsset(id);
    if (!planned || !blob) {
      missingAssets.push(id);
      continue;
    }
    if (planned.convertWebp) {
      blob = await deps.webpToPng(blob);
      convertedWebp.push(project.assets[id]?.fileName ?? id);
    }
    const buf = await blob.arrayBuffer();
    zip.file(planned.path, buf, { createFolders: false, binary: true });
    entries.push({
      path: planned.path,
      bytes: buf.byteLength,
      ...(planned.path.endsWith('.svg') ? { text: new TextDecoder().decode(buf) } : {}),
    });
  }

  const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  return {
    size,
    fileName: `${exportBaseName(project, size)}.zip`,
    zip: out,
    manifest: { entries, totalBytes: out.byteLength },
    missingAssets,
    convertedWebp,
  };
}

/** "All sizes" download: every size zip plus the backup images, in one zip. */
export async function buildMasterZip(sizes: readonly SizeExport[], backups: readonly BackupFile[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const s of sizes) zip.file(s.fileName, s.zip, { binary: true });
  for (const b of backups) zip.file(b.name, await b.blob.arrayBuffer(), { binary: true });
  return zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' });
}
