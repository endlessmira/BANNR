import { describe, expect, it } from 'vitest';
import { createProject, createShape, createSize } from '@/model/factories';
import { renderBanner } from '@/renderer';

describe('layer stroke', () => {
  it('is drawn outside the edge', () => {
    const el = createShape({ id: 'eS', box: { fill: { kind: 'solid', color: '#ff0000' }, stroke: { width: 3, color: '#000000', style: 'dashed' } } });
    const size = createSize(300, 250, { elements: [el] });
    const out = renderBanner(createProject('S', { platform: 'cm360', sizes: [size] }), size.id, { resolveAsset: (id) => id });
    expect(out.css).toMatch(/#eS\{[^}]*outline:3px dashed #000000/);
    expect(out.css).not.toMatch(/#eS\{[^}]*border:3px/);
  });
});
