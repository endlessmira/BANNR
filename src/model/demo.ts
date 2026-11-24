import {
  type NewProjectOptions, createButton, createImage, createProject, createShape, createSize, createText,
} from './factories';
import type { BannerElement, Project } from './types';

export const DEMO_LOGO_ASSET_ID = 'a_demo_logo';
const LOGO_RATIO = 1739.51 / 479.05;

type Layout = {
  logo: [number, number, number];
  head: [number, number, number, number, number];
  cta: [number, number, number, number];
};
const LAYOUTS: Record<'rect' | 'wide' | 'tall', Layout> = {
  rect: { logo: [20, 20, 110], head: [20, 66, 260, 100, 30], cta: [20, 190, 140, 40] },
  wide: { logo: [20, 29, 115], head: [165, 10, 380, 70, 26], cta: [570, 25, 138, 40] },
  tall: { logo: [20, 30, 120], head: [15, 110, 130, 260, 30], cta: [15, 520, 130, 44] },
};

function demoElements(w: number, h: number): BannerElement[] {
  const l = LAYOUTS[w / h >= 3 ? 'wide' : h / w >= 2 ? 'tall' : 'rect'];
  const [lx, ly, lw] = l.logo;
  const [hx, hy, hw, hh, fs] = l.head;
  const [cx, cy, cw, ch] = l.cta;
  return [
    createShape({ name: 'Glow', shape: 'ellipse', x: w * 0.55, y: -h * 0.4, width: Math.max(w, h), height: Math.max(w, h),
      opacity: 0.12, box: { fill: { kind: 'solid', color: '#f7cd6c' } } }),
    createImage({ name: 'Logo', placeholder: 'logo', assetId: DEMO_LOGO_ASSET_ID, x: lx, y: ly, width: lw,
      height: Math.round(lw / LOGO_RATIO), zIndex: 2 }),
    createText({ name: 'Headline', placeholder: 'headline', text: 'Banners,\nbuilt in minutes.', x: hx, y: hy,
      width: hw, height: hh, zIndex: 3, textStyle: { color: '#ffffff', fontSize: fs, verticalAlign: 'middle' } }),
    createButton({ label: 'Start now', x: cx, y: cy, width: cw, height: ch, zIndex: 4,
      textStyle: { color: '#111111', fontSize: 15 }, box: { fill: { kind: 'solid', color: '#f2a902' }, radius: 4 } }),
  ];
}

export function createDemoProject(
  opts: Pick<NewProjectOptions, 'platform' | 'clock'> & { name?: string },
): Project {
  const sizes = ([[300, 250], [728, 90], [160, 600]] as const).map(([w, h]) =>
    createSize(w, h, {
      background: {
        fill: { kind: 'linear', angle: 135, stops: [{ offset: 0, color: '#18181b' }, { offset: 1, color: '#3a2a00' }] },
      },
      elements: demoElements(w, h),
    }),
  );
  const project = createProject(opts.name ?? 'BANNR demo', {
    platform: opts.platform,
    clock: opts.clock,
    sizes,
    landingUrl: 'https://www.example.com/?utm_source=bannr',
  });
  project.assets[DEMO_LOGO_ASSET_ID] = {
    id: DEMO_LOGO_ASSET_ID, kind: 'image', fileName: 'logo.svg', mimeType: 'image/svg+xml', bytes: 2400, hash: 'demo',
  };
  return project;
}
