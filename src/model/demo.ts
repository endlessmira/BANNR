import {
  type NewProjectOptions, createButton, createImage, createProject, createShape, createSize, createText,
} from './factories';
import { MASTER_SIZE, STANDARD_SIZES } from './sizes';
import type { BannerElement, Project } from './types';

export const DEMO_LOGO_ASSET_ID = 'a_demo_logo';
const LOGO_RATIO = 1739.51 / 479.05;

/** logo: [x, y, width] · head and cta: [x, y, width, height, fontSize] */
interface Layout {
  logo: readonly [number, number, number];
  head: readonly [number, number, number, number, number];
  cta: readonly [number, number, number, number, number];
}
interface DemoSize { width: number; height: number; layout: Layout }

/** Hand-made layouts. The 480×480 master comes first; 300×250 keeps the original layout. */
const DEMO_SIZES: readonly DemoSize[] = [
  { width: 480, height: 480, layout: { logo: [40, 40, 180], head: [40, 150, 400, 150, 46], cta: [40, 370, 180, 56, 20] } },
  { width: 300, height: 250, layout: { logo: [20, 20, 110], head: [20, 66, 260, 100, 30], cta: [20, 190, 140, 40, 15] } },
  { width: 300, height: 600, layout: { logo: [30, 40, 140], head: [30, 150, 240, 200, 30], cta: [30, 500, 180, 50, 17] } },
  { width: 970, height: 250, layout: { logo: [40, 97, 200], head: [290, 40, 440, 170, 40], cta: [770, 97, 160, 56, 18] } },
];

function demoElements(w: number, h: number, l: Layout): BannerElement[] {
  const [lx, ly, lw] = l.logo;
  const [hx, hy, hw, hh, hfs] = l.head;
  const [cx, cy, cw, ch, cfs] = l.cta;
  return [
    createShape({ name: 'Glow', shape: 'ellipse', x: w * 0.55, y: -h * 0.4, width: Math.max(w, h), height: Math.max(w, h),
      opacity: 0.12, box: { fill: { kind: 'solid', color: '#f7cd6c' } } }),
    createImage({ name: 'Logo', placeholder: 'logo', assetId: DEMO_LOGO_ASSET_ID, x: lx, y: ly, width: lw,
      height: Math.round(lw / LOGO_RATIO), zIndex: 2 }),
    createText({ name: 'Headline', placeholder: 'headline', text: 'Banners,\nbuilt in minutes.', x: hx, y: hy,
      width: hw, height: hh, zIndex: 3, textStyle: { color: '#ffffff', fontSize: hfs, verticalAlign: 'middle' } }),
    createButton({ label: 'Start now', x: cx, y: cy, width: cw, height: ch, zIndex: 4,
      textStyle: { color: '#111111', fontSize: cfs }, box: { fill: { kind: 'solid', color: '#f2a902' }, radius: 4 } }),
  ];
}

const labelFor = (w: number, h: number): string | undefined =>
  w === MASTER_SIZE.width && h === MASTER_SIZE.height
    ? MASTER_SIZE.label
    : STANDARD_SIZES.find((s) => s.width === w && s.height === h)?.label;

export function createDemoProject(
  opts: Pick<NewProjectOptions, 'platform' | 'clock'> & { name?: string },
): Project {
  const sizes = DEMO_SIZES.map(({ width, height, layout }) =>
    createSize(width, height, {
      label: labelFor(width, height),
      background: {
        fill: { kind: 'linear', angle: 135, stops: [{ offset: 0, color: '#18181b' }, { offset: 1, color: '#3a2a00' }] },
      },
      elements: demoElements(width, height, layout),
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
