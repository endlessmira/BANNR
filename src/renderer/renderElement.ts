import type { BannerElement, BoxStyle, ID, Size, TextStyle } from '@/model/types';
import type { AnimationEngine } from './animation/engine';
import { MAX_ELEMENT_Z } from './constants';
import {
  type Decls, clamp, cssId, fontStack, paintCss, px, radiusCss, round, rule,
  safeColor, shadowCss, textShadowCss,
} from './css';
import { escapeHtml, escapeText } from './escape';

export interface RenderContext {
  readonly size: Size;
  readonly animation: AnimationEngine;
  readonly css: string[]; // collected rules
  resolveAsset(id: ID): string;
}

const VALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;
const HALIGN = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

/** Leaves out hidden elements and sorts by zIndex (ties keep document order). */
export function renderElements(elements: readonly BannerElement[], ctx: RenderContext): string {
  return elements
    .map((el, index) => ({ el, index }))
    .filter(({ el }) => !el.hidden)
    .sort((a, b) => a.el.zIndex - b.el.zIndex || a.index - b.index)
    .map(({ el }) => renderElement(el, ctx))
    .join('');
}

function frameDecls(el: BannerElement): Decls {
  return {
    position: 'absolute',
    left: px(el.x),
    top: px(el.y),
    width: px(el.width),
    height: px(el.height),
    'z-index': clamp(Math.round(el.zIndex), 0, MAX_ELEMENT_Z),
    opacity: el.opacity < 1 ? round(Math.max(0, el.opacity), 3) : undefined,
    rotate: el.rotation ? `${round(el.rotation)}deg` : undefined,
  };
}

function boxDecls(box: BoxStyle | undefined): Decls {
  if (!box) return {};
  const stroke = box.stroke && box.stroke.width > 0 ? box.stroke : undefined;
  return {
    background: paintCss(box.fill),
    border: stroke ? `${px(stroke.width)} ${stroke.style} ${safeColor(stroke.color, '#000')}` : undefined,
    'border-radius': radiusCss(box.radius),
    'box-shadow': box.shadows?.length ? box.shadows.map(shadowCss).join(',') : undefined,
  };
}

function textDecls(t: TextStyle): Decls {
  return {
    display: 'flex',
    'flex-direction': 'column',
    'justify-content': VALIGN[t.verticalAlign],
    'font-family': fontStack(t.fontFamily),
    'font-size': px(t.fontSize),
    'font-weight': Math.round(t.fontWeight),
    'font-style': t.fontStyle === 'italic' ? 'italic' : undefined,
    'line-height': round(t.lineHeight, 3),
    'letter-spacing': t.letterSpacing ? px(t.letterSpacing) : undefined,
    color: safeColor(t.color, '#000'),
    'text-align': t.align,
    'text-transform': t.textTransform === 'none' ? undefined : t.textTransform,
    'text-shadow': t.textShadow ? textShadowCss(t.textShadow) : undefined,
    'overflow-wrap': 'break-word',
  };
}

export function renderElement(el: BannerElement, ctx: RenderContext): string {
  const id = cssId(el.id);
  const sel = `#${id}`;
  const frame: Decls = { ...frameDecls(el), ...ctx.animation.elementDecls(el, ctx.size) };
  const cls = `el el-${el.type}`;

  switch (el.type) {
    case 'text':
      ctx.css.push(rule(sel, { ...frame, ...boxDecls(el.box), ...textDecls(el.textStyle) }));
      return `<div id="${id}" class="${cls}"><span>${escapeText(el.text)}</span></div>`;

    case 'image': {
      const src = ctx.resolveAsset(el.assetId);
      ctx.css.push(rule(sel, { ...frame, ...boxDecls(el.box), overflow: 'hidden' }));
      ctx.css.push(rule(`${sel}>img`, { display: 'block', width: '100%', height: '100%', 'object-fit': el.fit }));
      return `<div id="${id}" class="${cls}"><img src="${escapeHtml(src)}" alt="${escapeHtml(el.alt ?? '')}"></div>`;
    }

    case 'shape':
      ctx.css.push(
        rule(sel, { ...frame, ...boxDecls(el.box), ...(el.shape === 'ellipse' ? { 'border-radius': '50%' } : {}) }),
      );
      return `<div id="${id}" class="${cls}"></div>`;

    case 'button':
      // Visual only. The click layer handles all clicks.
      ctx.css.push(
        rule(sel, {
          ...frame,
          ...boxDecls(el.box),
          ...textDecls(el.textStyle),
          'flex-direction': 'row',
          'align-items': 'center',
          'justify-content': HALIGN[el.textStyle.align],
          padding: `${px(el.padding.y)} ${px(el.padding.x)}`,
          'white-space': 'nowrap',
          overflow: 'hidden',
        }),
      );
      return `<div id="${id}" class="${cls}"><span>${escapeText(el.label)}</span></div>`;

    case 'group':
      ctx.css.push(rule(sel, frame));
      return `<div id="${id}" class="${cls}">${renderElements(el.children, ctx)}</div>`;

    default: {
      const never: never = el;
      throw new Error(`Unknown element type: ${(never as { type: string }).type}`);
    }
  }
}
