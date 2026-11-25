import type { ID } from '@/model/types';

/**
 * COMPONENTS: interactive rich media layers. Each component is one folder in src/components/
 * exporting a ComponentDefinition, registered in registry.ts. The document stores only
 * componentType, preset, props and slots (see ComponentElement in model/types.ts).
 */
export type ComponentCategory = 'motion' | '3d' | 'carousel' | 'reveal' | 'widget' | 'game';

interface FieldBase { label: string; help?: string }
/** One setting. The settings panel is generated from these (Phase 7a-2). */
export type SettingField =
  | (FieldBase & { type: 'number' | 'slider'; default: number; min?: number; max?: number; step?: number; suffix?: string })
  | (FieldBase & { type: 'color'; default: string })
  | (FieldBase & { type: 'toggle'; default: boolean })
  | (FieldBase & { type: 'select'; default: string; options: ReadonlyArray<readonly [string, string]> })
  | (FieldBase & { type: 'text'; default: string; multiline?: boolean; maxLength?: number })
  | (FieldBase & { type: 'font'; default: string })
  | (FieldBase & { type: 'date'; default: string });

export type SettingsSchema = Readonly<Record<string, SettingField>>;
export type PropValue = string | number | boolean;
/** Props after defaults, preset and validation: every schema key is present and valid. */
export type ResolvedProps = Record<string, PropValue>;

export interface SlotDefinition {
  name: string;
  label: string;
  kind: 'image' | 'text';
  required?: boolean;
  /** For repeatable slots. */
  min?: number;
  max?: number;
}
export type ResolvedSlot = { kind: 'image'; assetId: ID; src: string } | { kind: 'text'; text: string };
export type ResolvedSlots = Record<string, ResolvedSlot[]>;

export interface ComponentPreset { id: string; label: string; description?: string; props: Readonly<Record<string, PropValue>> }

/** sel is the instance's CSS selector: scope all instance CSS with it. */
export interface ComponentRenderCtx { id: string; sel: string; width: number; height: number }
export interface ComponentOutput { html: string; css: string }

export interface ComponentDefinition {
  type: string;
  version: number;
  label: string;
  category: ComponentCategory;
  description: string;
  icon: string;
  presets?: readonly ComponentPreset[];
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  recommendedSizes: readonly string[];
  settingsSchema: SettingsSchema;
  slots: readonly SlotDefinition[];
  /** true = needs swipe/drag/touch input: the layer then catches the pointer instead of the click layer. */
  capturesPointer: boolean;
  /** Added full-banner at the bottom of the layer stack (e.g. animated backgrounds). */
  addAsBackground?: boolean;
  emits: readonly string[];
  /** Max JS + CSS for this component (excluding images), checked by unit tests. */
  weightBudgetKB: number;
  /** Type-level CSS, included once per banner when the component is used. */
  styles?: string;
  /** Static markup: the editor's Edit mode, and the starting state of the live banner. */
  render(props: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx): ComponentOutput;
  /**
   * Vanilla JS (no libraries, no network), included once per banner when used. Must call
   * bannr.define(type, function (el, props) { ...; return { destroy: function () {} }; }).
   * URLs open only via bannr.exit(); events go via bannr.track().
   */
  runtime: string;
  /** Static frame for the backup image. */
  backupState(props: ResolvedProps, slots: ResolvedSlots, ctx: ComponentRenderCtx): ComponentOutput;
}
