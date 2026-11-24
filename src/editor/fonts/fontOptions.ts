import type { FontRef } from '@/model/types';
import type { Opt } from '../panels/fields';

/** System fonts available on most desktops. Not embedded, so they may differ on phones. */
export const WEB_SAFE_FONTS: readonly string[] = [
  'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New', 'Impact',
];

/** Font menu: embedded project fonts first, then web-safe fonts. */
export function fontOptions(projectFonts: readonly FontRef[], current: string): Opt<string> {
  const embedded = projectFonts.map((f) => f.family);
  const all = [...embedded, ...WEB_SAFE_FONTS.filter((f) => !embedded.includes(f))];
  const list: Array<readonly [string, string]> = all.map((f) => [f, embedded.includes(f) ? `${f} · embedded` : f] as const);
  if (!all.includes(current)) list.unshift([current, `${current} · not embedded`]);
  return list;
}
