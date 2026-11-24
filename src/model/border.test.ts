import { describe, expect, it } from 'vitest';
import { applyBorderToAll, setBorder } from './border';
import { createProject, createSize } from './factories';
import { renderBanner } from '@/renderer';

const make = () =>
  createProject('B', { platform: 'cm360', sizes: [createSize(300, 250), createSize(728, 90)] });

describe('border', () => {
  it('is off by default and not rendered', () => {
    const p = make();
    expect(p.sizes.every((s) => !s.border.enabled)).toBe(true);
    const out = renderBanner(p, p.sizes[0]!.id, { resolveAsset: (id) => id });
    expect(out.html).not.toContain('bannr-border');
  });

  it('renders when turned on for one size only', () => {
    const p0 = make();
    const p = setBorder(p0, { enabled: true, color: '#cccccc' }, [p0.sizes[0]!.id]);
    const on = renderBanner(p, p.sizes[0]!.id, { resolveAsset: (id) => id });
    const off = renderBanner(p, p.sizes[1]!.id, { resolveAsset: (id) => id });
    expect(on.css).toContain('border:1px solid #cccccc');
    expect(off.html).not.toContain('bannr-border');
  });

  it('applies one size border to all sizes and clamps width', () => {
    const p0 = make();
    const p = applyBorderToAll(setBorder(p0, { enabled: true, width: 99 }, [p0.sizes[0]!.id]), p0.sizes[0]!.id);
    expect(p.sizes.map((s) => [s.border.enabled, s.border.width])).toEqual([[true, 10], [true, 10]]);
  });
});
