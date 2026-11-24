/**
 * BANNR document schema. Everything here must stay JSON-serialisable.
 * Bump SCHEMA_VERSION and add a migration in migrations.ts for any breaking change.
 */
export const SCHEMA_VERSION = 2;

export type ID = string;
export type ISODateString = string;
export type PlatformId = 'adform' | 'cm360' | 'dv360' | 'ttd';

/* ───────────── Project ───────────── */

export interface Project {
  schemaVersion: number;
  id: ID;
  name: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  /** Always chosen explicitly by the user when the project is created. */
  selectedPlatform: PlatformId;
  /** Default/test landing URL. Used as the clickTag fallback at export. */
  landingUrl: string;
  /** The size other sizes are generated from (multi-size workflow). */
  masterSizeId: ID | null;
  sizes: Size[];
  /** Metadata for every referenced asset. Binaries live in AssetStore under the same ID. */
  assets: Record<ID, AssetRef>;
  fonts: FontRef[];
  settings: ProjectSettings;
}

export interface ProjectSettings {
  maxAnimationSeconds: number; // default 30
  maxLoops: number;            // default 3
}

/* ───────────── Size / Artboard ───────────── */

export interface Size {
  id: ID;
  width: number;
  height: number;
  label?: string;
  background: Background;
  border: BorderSetting;
  elements: BannerElement[];
  animationSettings: AnimationSettings;
  /** Set when generated from the master size. */
  derivedFrom?: ID;
}

export interface Background {
  fill: Paint;
  image?: { assetId: ID; fit: 'cover' | 'contain' };
}

/** Optional border drawn on top of all elements. Off by default; the user turns it on per size. */
export interface BorderSetting { enabled: boolean; color: string; width: number }

export interface AnimationSettings {
  /** Length of one loop, in seconds. */
  duration: number;
  /** Total number of plays (1 = play once). Infinite is deliberately not allowed. */
  loops: number;
}

/* ───────────── Styles ───────────── */

export interface GradientStop { offset: number /* 0..1 */; color: string }
export type Paint =
  | { kind: 'solid'; color: string }
  | { kind: 'linear'; angle: number; stops: GradientStop[] };

export interface Shadow { x: number; y: number; blur: number; spread: number; color: string; inset?: boolean }
export interface TextShadow { x: number; y: number; blur: number; color: string }
export interface Stroke { width: number; color: string; style: 'solid' | 'dashed' | 'dotted' }
export type Radius = number | [number, number, number, number];

export interface BoxStyle {
  fill?: Paint;
  stroke?: Stroke;
  radius?: Radius;
  shadows?: Shadow[];
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  lineHeight: number;     // multiplier
  letterSpacing: number;  // px
  color: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textShadow?: TextShadow;
}

/* ───────────── Animation ───────────── */

export type AnimationPreset =
  | 'none' | 'fade'
  | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down'
  | 'scale-up' | 'scale-down' | 'zoom' | 'rotate' | 'blur';

export type Easing =
  | 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'
  | `cubic-bezier(${number},${number},${number},${number})`;

/** All times are in seconds, measured from the start of the loop. */
export interface AnimationStep {
  preset: AnimationPreset;
  delay: number;
  duration: number;
  easing: Easing;
  /** Travel distance for slide presets, in px. */
  distance?: number;
}

export interface ElementAnimation { in: AnimationStep | null; out: AnimationStep | null }

/* ───────────── Elements ───────────── */

export type PlaceholderRole =
  | 'logo' | 'headline' | 'subheadline' | 'cta' | 'image' | 'background' | 'legal';

export interface ElementBase {
  id: ID;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number;  // 0..1
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  placeholder?: PlaceholderRole;
  animation: ElementAnimation;
}

export interface TextElement extends ElementBase {
  type: 'text';
  text: string;
  textStyle: TextStyle;
  box?: BoxStyle;
}

export interface ImageElement extends ElementBase {
  type: 'image';
  assetId: ID;
  fit: 'cover' | 'contain' | 'fill';
  alt?: string;
  box?: BoxStyle;
}

export interface ShapeElement extends ElementBase {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  box: BoxStyle;
}

/** Visual only. Clicks are always handled by the full-banner click layer. */
export interface ButtonElement extends ElementBase {
  type: 'button';
  label: string;
  textStyle: TextStyle;
  box: BoxStyle;
  padding: { x: number; y: number };
}

/** Children are positioned relative to the group's top-left corner. */
export interface GroupElement extends ElementBase {
  type: 'group';
  children: BannerElement[];
}

export type BannerElement = TextElement | ImageElement | ShapeElement | ButtonElement | GroupElement;
export type ElementType = BannerElement['type'];

/* ───────────── Assets & fonts ───────────── */

export interface AssetRef {
  /** Content-addressed (derived from the SHA-256), so identical uploads are stored once. */
  id: ID;
  kind: 'image' | 'font';
  fileName: string; // sanitised; used for the export path
  mimeType: string;
  bytes: number;
  hash: string;
  width?: number;
  height?: number;
  originalBytes?: number; // size before compression
}

export interface FontFaceRef {
  weight: number;
  style: 'normal' | 'italic';
  assetId: ID;
  /** Character range of this file, e.g. "U+0000-00FF" (Google Fonts subsets). */
  unicodeRange?: string;
}

/**
 * Google Fonts are downloaded as woff2 when they're added, so exports
 * never make external font requests.
 */
export interface FontRef { id: ID; family: string; source: 'google' | 'upload'; faces: FontFaceRef[] }

/* ───────────── Templates ───────────── */

export type TemplateCategory =
  | 'retail-sale' | 'product-launch' | 'app-install' | 'automotive' | 'travel'
  | 'finance' | 'food-drink' | 'event' | 'brand-awareness' | 'real-estate';

export interface Template extends Project {
  thumbnail: string; // data URL or bundled asset path
  category: TemplateCategory;
  /** Swappable roles shown in the "quick swap" UI. */
  placeholderFlags: PlaceholderRole[];
  description?: string;
}
