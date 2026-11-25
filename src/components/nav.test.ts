import { describe, expect, it } from 'vitest';
import { carousel } from './carousel';
import { carouselset } from './carouselset';
import { NAV_BCC, NAV_BCS, navCss } from './nav';
import { resolveProps, schemaIssues } from './settings';

const ctx = { id: 'x', sel: '#x', width: 300, height: 250 };

describe('carousel arrows and dots', () => {
  it('both carousels have the arrow and dot settings and valid schemas', () => {
    for (const d of [carousel, carouselset]) {
      expect(schemaIssues(d)).toEqual([]);
      expect(Object.keys(d.settingsSchema)).toEqual(expect.arrayContaining([
        'arrows', 'arrowIcon', 'arrowStyle', 'arrowSize', 'arrowPosition', 'arrowBg', 'navColor',
        'dots', 'dotStyle', 'dotSize', 'dotPosition', 'dotColor', 'dotActiveColor',
      ]));
    }
  });

  it('defaults: circle chevrons left and right in the middle; colours accept opacity', () => {
    const css = navCss(resolveProps(carousel, { arrowBg: 'rgba(0,0,0,0.5)', navColor: '#ffffff' }), '#x', NAV_BCC);
    expect(css).toContain('#x .bcc-nav{width:28px;height:28px');
    expect(css).toContain('color:#ffffff');
    expect(css).toContain('background:rgba(0,0,0,0.5)');
    expect(css).toContain('border-radius:50%');
    expect(css).toContain('#x .bcc-prev{left:6px;right:auto;top:50%;bottom:auto;margin-top:-14px}');
    expect(css).toContain('rotate(45deg)');
  });

  it('other positions, styles and icons; dots move above bottom centred arrows', () => {
    const css = navCss(resolveProps(carousel, {
      arrowPosition: 'bottom-center', arrowStyle: 'plain', arrowIcon: 'triangle', dotStyle: 'bar',
    }), '#x', NAV_BCC);
    expect(css).toMatch(/#x \.bcc-nav\{[^}]*background:transparent/);
    expect(css).toContain('border-left:0');
    expect(css).toMatch(/#x \.bcc-dots\{[^}]*bottom:40px/);
    expect(css).toContain('#x .bcc-dot{width:17.5px');
    expect(navCss(resolveProps(carouselset, { arrowsOnHover: true }), '#y', NAV_BCS)).toContain('@media (hover:hover){#y .bcs-nav{opacity:0');
    expect(navCss(resolveProps(carouselset, { dotStyle: 'ring' }), '#y', NAV_BCS)).toContain('#y .bcs-dot.bcs-cur{');
    expect(navCss(resolveProps(carousel, { arrows: false, dots: false }), '#x', NAV_BCC)).toBe('');
  });

  it('the arrow and dot CSS is part of both rendered carousels', () => {
    expect(carousel.render(resolveProps(carousel, { arrowIcon: 'arrow' }), {}, ctx).css).toContain("content:'\\2192'");
    expect(carouselset.render(resolveProps(carouselset, { dotActiveColor: '#00ff00' }), {}, ctx).css)
      .toContain('#x .bcs-dot.bcs-cur{background:#00ff00}');
  });
});
