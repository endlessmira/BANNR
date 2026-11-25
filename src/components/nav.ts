import { type Decls, px, round, rule, safeColor } from '@/renderer/css';
import type { ResolvedProps, SettingsSchema } from './types';

/**
 * Shared arrows and dots for the Carousel and the Carousel Set. The markup (buttons with data-nav,
 * dots with data-i) comes from each carousel; this file adds the settings and the per-layer CSS.
 * The CSS is scoped to the layer (#id), so it overrides the carousels' base styles.
 */
export interface NavNames { pre: string; on: string }
export const NAV_BCC: NavNames = { pre: 'bcc', on: 'bcc-on' };
export const NAV_BCS: NavNames = { pre: 'bcs', on: 'bcs-cur' };

const ARROWS = { key: 'arrows', is: ['true'] } as const;
const DOTS = { key: 'dots', is: ['true'] } as const;

export const NAV_FIELDS: SettingsSchema = {
  arrows: { type: 'toggle', label: 'Arrows', default: true },
  arrowIcon: {
    type: 'select', label: 'Arrow icon', default: 'chevron', when: ARROWS,
    options: [['chevron', 'Chevron'], ['bold', 'Bold chevron'], ['triangle', 'Triangle'], ['arrow', 'Arrow ←→']],
  },
  arrowStyle: {
    type: 'select', label: 'Arrow style', default: 'circle', when: ARROWS,
    options: [['circle', 'Circle'], ['square', 'Rounded square'], ['outline', 'Outline circle'], ['plain', 'Icon only']],
  },
  arrowSize: { type: 'number', label: 'Arrow size', default: 28, min: 16, max: 72, suffix: 'px', when: ARROWS },
  arrowPosition: {
    type: 'select', label: 'Arrow position', default: 'middle', when: ARROWS,
    options: [['middle', 'Left and right, middle'], ['bottom', 'Bottom corners'], ['bottom-center', 'Bottom, centred pair'], ['top-right', 'Top right pair']],
  },
  arrowInset: { type: 'number', label: 'Distance from edge', default: 6, min: 0, max: 60, suffix: 'px', when: ARROWS },
  navColor: { type: 'color', label: 'Arrow colour', default: '#111111', when: ARROWS },
  arrowBg: { type: 'color', label: 'Arrow background', default: 'rgba(255,255,255,0.8)', when: ARROWS },
  arrowsOnHover: {
    type: 'toggle', label: 'Show arrows only on mouse hover', default: false, when: ARROWS,
    help: 'Phones and tablets always show them.',
  },
  dots: { type: 'toggle', label: 'Dots', default: true },
  dotStyle: {
    type: 'select', label: 'Dot style', default: 'dot', when: DOTS,
    options: [['dot', 'Dots'], ['ring', 'Rings'], ['bar', 'Bars'], ['square', 'Squares']],
  },
  dotSize: { type: 'number', label: 'Dot size', default: 7, min: 3, max: 24, suffix: 'px', when: DOTS },
  dotPosition: {
    type: 'select', label: 'Dot position', default: 'bottom', when: DOTS,
    options: [['bottom', 'Bottom centre'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right'], ['top', 'Top centre']],
  },
  dotColor: { type: 'color', label: 'Dot colour', default: 'rgba(17,17,17,0.35)', when: DOTS },
  dotActiveColor: { type: 'color', label: 'Active dot colour', default: '#111111', when: DOTS },
};

const A = 'auto';

function arrowPos(pos: string, s: number, i: number): [Decls, Decls] {
  switch (pos) {
    case 'bottom':
      return [{ left: px(i), right: A, top: A, bottom: px(i) }, { left: A, right: px(i), top: A, bottom: px(i) }];
    case 'bottom-center':
      return [
        { left: '50%', right: A, top: A, bottom: px(i), 'margin-left': px(-s - 4) },
        { left: '50%', right: A, top: A, bottom: px(i), 'margin-left': '4px' },
      ];
    case 'top-right':
      return [{ left: A, right: px(i + s + 8), top: px(i), bottom: A }, { left: A, right: px(i), top: px(i), bottom: A }];
    default:
      return [
        { left: px(i), right: A, top: '50%', bottom: A, 'margin-top': px(-s / 2) },
        { left: A, right: px(i), top: '50%', bottom: A, 'margin-top': px(-s / 2) },
      ];
  }
}

function iconRules(icon: string, b: string, s: number): string[] {
  const base: Decls = { content: "''", display: 'block', 'box-sizing': 'border-box' };
  if (icon === 'arrow') {
    const font = `700 ${px(round(s * 0.6, 1))}/1 Arial,sans-serif`;
    return [
      rule(`${b}-prev::before`, { content: "'\\2190'", font }),
      rule(`${b}-next::before`, { content: "'\\2192'", font }),
    ];
  }
  if (icon === 'triangle') {
    const t = round(s * 0.22, 1);
    const edge = `${px(t)} solid transparent`;
    const fill = `${px(round(t * 1.4, 1))} solid currentColor`;
    return [
      rule(`${b}-prev::before`, { ...base, width: '0', height: '0', border: edge, 'border-left': '0', 'border-right': fill, 'margin-left': px(-round(t * 0.4, 1)) }),
      rule(`${b}-next::before`, { ...base, width: '0', height: '0', border: edge, 'border-right': '0', 'border-left': fill, 'margin-left': px(round(t * 0.4, 1)) }),
    ];
  }
  const k = px(round(s * 0.3, 1));
  const bw = px(icon === 'bold' ? Math.max(3, round(s / 8, 1)) : Math.max(2, round(s / 14, 1)));
  const line = `${bw} solid currentColor`;
  return [
    rule(`${b}-prev::before`, { ...base, width: k, height: k, 'border-top': line, 'border-right': line, transform: 'translateX(18%) rotate(-135deg)' }),
    rule(`${b}-next::before`, { ...base, width: k, height: k, 'border-top': line, 'border-right': line, transform: 'translateX(-18%) rotate(45deg)' }),
  ];
}

/** Per-layer CSS for the arrows and dots. Empty if both are switched off. */
export function navCss(p: ResolvedProps, sel: string, n: NavNames): string {
  const out: string[] = [];
  const b = `${sel} .${n.pre}`;
  const arrowsOn = p.arrows === true;

  if (arrowsOn) {
    const s = Number(p.arrowSize);
    const i = Number(p.arrowInset);
    const c = safeColor(String(p.navColor), '#111');
    const st = String(p.arrowStyle);
    out.push(rule(`${b}-nav`, {
      width: px(s), height: px(s), margin: '0', padding: '0', 'font-size': '0', 'line-height': '0',
      display: 'grid', 'place-items': 'center', 'box-sizing': 'border-box', color: c, opacity: 1,
      background: st === 'circle' || st === 'square' ? safeColor(String(p.arrowBg)) : 'transparent',
      border: st === 'outline' ? `${px(Math.max(1.5, round(s / 16, 1)))} solid ${c}` : '0',
      'border-radius': st === 'square' ? px(round(s * 0.22, 1)) : st === 'plain' ? '0' : '50%',
    }));
    const [prev, next] = arrowPos(String(p.arrowPosition), s, i);
    out.push(rule(`${b}-prev`, prev), rule(`${b}-next`, next), ...iconRules(String(p.arrowIcon), b, s));
    if (p.arrowsOnHover === true) {
      out.push(`@media (hover:hover){${b}-nav{opacity:0;transition:opacity .2s}${sel}:hover .${n.pre}-nav{opacity:1}}`);
    }
  }

  if (p.dots === true) {
    const d = Number(p.dotSize);
    const col = safeColor(String(p.dotColor), 'rgba(17,17,17,0.35)');
    const act = safeColor(String(p.dotActiveColor), '#111');
    const ds = String(p.dotStyle);
    const pos = String(p.dotPosition);
    // Bottom centred arrows: the dots move up above them.
    const raise = arrowsOn && String(p.arrowPosition) === 'bottom-center' && pos === 'bottom';
    const off = px(raise ? Number(p.arrowInset) + Number(p.arrowSize) + 6 : 6);
    const side = px(Math.max(6, Number(p.arrowInset)));
    out.push(rule(`${b}-dots`, {
      left: pos === 'bottom-right' ? A : pos === 'bottom-left' ? side : '0',
      right: pos === 'bottom-left' ? A : pos === 'bottom-right' ? side : '0',
      top: pos === 'top' ? off : A,
      bottom: pos === 'top' ? A : off,
      'justify-content': pos === 'bottom-left' ? 'flex-start' : pos === 'bottom-right' ? 'flex-end' : 'center',
      'align-items': 'center',
      gap: px(Math.max(4, round(d * 0.8, 1))),
    }));
    const ring = px(Math.max(1.5, round(d / 5, 1)));
    out.push(rule(`${b}-dot`, {
      width: ds === 'bar' ? px(round(d * 2.5, 1)) : px(d),
      height: ds === 'bar' ? px(Math.max(2, round(d * 0.45, 1))) : px(d),
      opacity: 1,
      'border-radius': ds === 'square' ? px(Math.max(1, round(d * 0.2, 1))) : px(d),
      background: ds === 'ring' ? 'transparent' : col,
      'box-shadow': ds === 'ring' ? `inset 0 0 0 ${ring} ${col}` : 'none',
      transition: 'background-color .2s,box-shadow .2s',
    }));
    out.push(rule(`${b}-dot.${n.on}`, ds === 'ring' ? { background: act, 'box-shadow': `inset 0 0 0 ${ring} ${act}` } : { background: act }));
  }
  return out.join('\n');
}
