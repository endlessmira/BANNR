import { describe, expect, it } from 'vitest';
import { createButton, createImage, createProject, createShape, createSize, createText } from '@/model/factories';
import type { Project } from '@/model/types';
import { CLICK_LAYER_Z, renderBanner } from '@/renderer';

const resolve = (id: string) => `images/${id}.png`;

function fixture(): { project: Project; sizeId: string } {
  const size = createSize(300, 250, {
    elements: [
      createText({ id: 'eHead', text: 'Hello <b>&</b>\nworld', zIndex: 2 }),
      createImage({ id: 'eImg', assetId: 'aLogo', zIndex: 1 }),
      createImage({ id: 'eHidden', assetId: 'aUnused', hidden: true }),
      createShape({ id: 'eBad', box: { fill: { kind: 'solid', color: 'red;}</style><script>alert(1)</script>' } } }),
      createButton({ id: 'eCta', label: 'Shop now', zIndex: 5 }),
    ],
  });
  const project = createProject('Test', { platform: 'cm360', sizes: [size], clock: () => '2026-01-01T00:00:00.000Z' });
  return { project, sizeId: size.id };
}

describe('renderBanner', () => {
  it('produces a complete document at the banner size', () => {
    const { project, sizeId } = fixture();
    const out = renderBanner(project, sizeId, { resolveAsset: resolve });
    expect(out.html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(out.css).toContain('#banner{position:relative;overflow:hidden;width:300px;height:250px');
  });

  it('is deterministic (pure)', () => {
    const { project, sizeId } = fixture();
    expect(renderBanner(project, sizeId, { resolveAsset: resolve }).html)
      .toBe(renderBanner(project, sizeId, { resolveAsset: resolve }).html);
  });

  it('escapes user text and blocks CSS injection', () => {
    const { project, sizeId } = fixture();
    const { html, css } = renderBanner(project, sizeId, { resolveAsset: resolve });
    expect(html).toContain('Hello &lt;b&gt;&amp;&lt;/b&gt;<br>world');
    expect(html).not.toContain('alert(1)');
    expect(css).toMatch(/#eBad\{[^}]*background:transparent/);
  });

  it('omits hidden elements and reports only used assets with relative paths', () => {
    const { project, sizeId } = fixture();
    const out = renderBanner(project, sizeId, { resolveAsset: resolve });
    expect(out.html).not.toContain('eHidden');
    expect(out.usedAssetIds).toEqual(['aLogo']);
    expect(out.html).toContain('src="images/aLogo.png"');
  });

  it('orders by zIndex and puts the click layer last and on top', () => {
    const { project, sizeId } = fixture();
    const { html, css } = renderBanner(project, sizeId, { resolveAsset: resolve });
    expect(html.indexOf('id="eImg"')).toBeLessThan(html.indexOf('id="eHead"'));
    expect(html.indexOf('id="clickArea"')).toBeGreaterThan(html.indexOf('id="eCta"'));
    expect(css).toContain(`z-index:${CLICK_LAYER_Z}`);
  });

  it('places injections correctly and supports external css/js', () => {
    const { project, sizeId } = fixture();
    const out = renderBanner(project, sizeId, {
      resolveAsset: resolve, cssMode: 'external', jsMode: 'external',
      injection: { head: '<meta name="x-head">', bodyEnd: '<script>/*click*/</script>' },
    });
    expect(out.html.indexOf('<meta name="x-head">')).toBeLessThan(out.html.indexOf('</head>'));
    expect(out.html.indexOf('script.js')).toBeLessThan(out.html.indexOf('/*click*/'));
    expect(Object.keys(out.files).sort()).toEqual(['index.html', 'script.js', 'style.css']);
  });
});
