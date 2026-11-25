import { describe, expect, it } from 'vitest';
import { leadform } from '@/components/leadform';
import { resolveProps } from '@/components/settings';
import { safeColor } from '@/renderer/css';
import { formatColor, parseColor, toHex } from './color';

describe('colour with opacity', () => {
  it('reads hex, short hex, rgb(a) and transparent', () => {
    expect(parseColor('#f2a902')).toEqual({ r: 242, g: 169, b: 2, a: 1 });
    expect(parseColor('#ffffff80')).toEqual({ r: 255, g: 255, b: 255, a: 0.5 });
    expect(parseColor('#0008')).toEqual({ r: 0, g: 0, b: 0, a: 0.53 });
    expect(parseColor('rgba(0, 0, 0, 0.35)')).toEqual({ r: 0, g: 0, b: 0, a: 0.35 });
    expect(parseColor('rgba(10,20,30,50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseColor('red')).toBeNull();
  });

  it('keeps opaque colours as plain hex and writes rgba() below 100%', () => {
    expect(formatColor({ r: 242, g: 169, b: 2, a: 1 })).toBe('#f2a902');
    expect(formatColor({ r: 255, g: 255, b: 255, a: 0.5 })).toBe('rgba(255,255,255,0.5)');
    expect(toHex({ r: 255, g: 0, b: 0, a: 0.2 })).toBe('#ff0000');
    const out = formatColor({ r: 1, g: 2, b: 3, a: 0.25 });
    expect(safeColor(out, 'rejected')).toBe(out);
  });

  it('component colours accept opacity (lead form background)', () => {
    const p = resolveProps(leadform, { bgColor: 'rgba(255,255,255,0.5)' });
    expect(p.bgColor).toBe('rgba(255,255,255,0.5)');
    const css = leadform.render(p, {}, { id: 'x', sel: '#x', width: 280, height: 320 }).css;
    expect(css).toContain('background:rgba(255,255,255,0.5)');
  });
});
