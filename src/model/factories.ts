import { newId } from './ids';
import {
  SCHEMA_VERSION,
  type BannerElement, type BorderSetting, type BoxStyle, type ButtonElement, type ElementBase,
  type GroupElement, type ID, type ISODateString, type ImageElement, type PlatformId, type Project,
  type ProjectSettings, type ShapeElement, type Size, type TextElement, type TextStyle,
} from './types';

export type Clock = () => ISODateString;
export const systemClock: Clock = () => new Date().toISOString();

export const DEFAULT_SETTINGS: ProjectSettings = { maxAnimationSeconds: 30, maxLoops: 3 };

/** Off by default. Color and width are preset so turning it on gives a standard 1px line. */
export const DEFAULT_BORDER: BorderSetting = { enabled: false, color: '#000000', width: 1 };

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Arial',
  fontSize: 24,
  fontWeight: 700,
  fontStyle: 'normal',
  lineHeight: 1.15,
  letterSpacing: 0,
  color: '#111111',
  align: 'left',
  verticalAlign: 'top',
  textTransform: 'none',
};

type BaseInput = Partial<ElementBase>;

function base(defaultName: string, input: BaseInput): ElementBase {
  return {
    id: newId('e'),
    name: defaultName,
    x: 0, y: 0, width: 100, height: 40,
    rotation: 0, opacity: 1, zIndex: 0,
    locked: false, hidden: false,
    animation: { in: null, out: null },
    ...input,
  };
}

export function createText(
  input: BaseInput & { text?: string; textStyle?: Partial<TextStyle>; box?: BoxStyle } = {},
): TextElement {
  const { text = 'Headline', textStyle, box, ...rest } = input;
  return {
    ...base('Text', { width: 200, height: 60, ...rest }),
    type: 'text',
    text,
    textStyle: { ...DEFAULT_TEXT_STYLE, ...textStyle },
    ...(box ? { box } : {}),
  };
}

export function createImage(
  input: BaseInput & { assetId: ID; fit?: ImageElement['fit']; alt?: string; box?: BoxStyle },
): ImageElement {
  const { assetId, fit = 'contain', alt, box, ...rest } = input;
  return {
    ...base('Image', rest),
    type: 'image',
    assetId,
    fit,
    ...(alt !== undefined ? { alt } : {}),
    ...(box ? { box } : {}),
  };
}

export function createShape(
  input: BaseInput & { shape?: ShapeElement['shape']; box?: BoxStyle } = {},
): ShapeElement {
  const { shape = 'rect', box = { fill: { kind: 'solid', color: '#f2a902' } }, ...rest } = input;
  return { ...base(shape === 'ellipse' ? 'Ellipse' : 'Rectangle', rest), type: 'shape', shape, box };
}

export function createButton(
  input: BaseInput & {
    label?: string; textStyle?: Partial<TextStyle>; box?: BoxStyle; padding?: ButtonElement['padding'];
  } = {},
): ButtonElement {
  const {
    label = 'Learn more',
    textStyle,
    box = { fill: { kind: 'solid', color: '#f2a902' }, radius: 4 },
    padding = { x: 16, y: 8 },
    ...rest
  } = input;
  return {
    ...base('CTA', { width: 140, height: 40, placeholder: 'cta', ...rest }),
    type: 'button',
    label,
    textStyle: { ...DEFAULT_TEXT_STYLE, fontSize: 16, align: 'center', verticalAlign: 'middle', ...textStyle },
    box,
    padding,
  };
}

export function createGroup(children: BannerElement[], input: BaseInput = {}): GroupElement {
  return { ...base('Group', input), type: 'group', children };
}

export function createSize(
  width: number,
  height: number,
  input: Partial<Omit<Size, 'id' | 'width' | 'height'>> = {},
): Size {
  return {
    id: newId('s'),
    width,
    height,
    background: { fill: { kind: 'solid', color: '#ffffff' } },
    border: { ...DEFAULT_BORDER },
    elements: [],
    animationSettings: { duration: 15, loops: 1 },
    ...input,
  };
}

export interface NewProjectOptions {
  /** Required: the user always picks the platform explicitly. There is no default. */
  platform: PlatformId;
  landingUrl?: string;
  sizes?: Size[];
  settings?: Partial<ProjectSettings>;
  clock?: Clock;
}

export function createProject(name: string, opts: NewProjectOptions): Project {
  // Runtime check too, for JS callers and imported data.
  if (!opts?.platform) throw new Error('A platform must be chosen when creating a project');
  const now = (opts.clock ?? systemClock)();
  const sizes = opts.sizes ?? [createSize(300, 250)];
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId('p'),
    name,
    createdAt: now,
    updatedAt: now,
    selectedPlatform: opts.platform,
    landingUrl: opts.landingUrl ?? 'https://www.example.com',
    masterSizeId: sizes[0]?.id ?? null,
    sizes,
    assets: {},
    fonts: [],
    settings: { ...DEFAULT_SETTINGS, ...opts.settings },
  };
}

/** Deep copy with fresh IDs. Assets are content-addressed, so they're shared, not copied. */
export function cloneElement(el: BannerElement): BannerElement {
  const copy = structuredClone(el);
  copy.id = newId('e');
  if (copy.type === 'group') copy.children = copy.children.map((c) => cloneElement(c));
  return copy;
}

/** Duplicate keeps the original platform (it's a copy, not a new project). */
export function cloneProject(src: Project, opts: { name?: string; clock?: Clock } = {}): Project {
  const now = (opts.clock ?? systemClock)();
  const idMap = new Map<ID, ID>();
  const sizes: Size[] = src.sizes.map((s) => {
    const id = newId('s');
    idMap.set(s.id, id);
    return { ...structuredClone(s), id, elements: s.elements.map((e) => cloneElement(e)) };
  });
  for (const s of sizes) if (s.derivedFrom) s.derivedFrom = idMap.get(s.derivedFrom);
  return {
    ...structuredClone(src),
    id: newId('p'),
    name: opts.name ?? `${src.name} copy`,
    createdAt: now,
    updatedAt: now,
    sizes,
    masterSizeId: src.masterSizeId ? (idMap.get(src.masterSizeId) ?? null) : null,
  };
}
