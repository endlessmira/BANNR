import { describe, expect, it } from 'vitest';
import { adaptSize } from '@/model/adapt';
import { cloneElement, createComponent, createProject, createSize, createText } from '@/model/factories';
import { CLICK_LAYER_ID, renderBanner } from '@/renderer';
import { previewInjection } from './preview';

describe('exit architecture', () => {
  it('routes the click layer through bannr.exit() and never calls window.open itself', () => {
    const size = createSize(300, 250, { elements: [createText({ id: 'eT' })] });
    const p = createProject('E', { platform: 'ttd', sizes: [size] });
    const out = renderBanner(p, size.id, { resolveAsset: (id) => id });
    expect(out.js).toContain('bannr.exit()');
    expect(out.html).not.toContain('window.open');
    expect(out.html.indexOf(`id="${CLICK_LAYER_ID}"`)).toBeLessThan(out.html.indexOf('id="eT"'));
  });

  it('the preview defines bannr.exit() and bannr.track()', () => {
    const inj = previewInjection('https://example.com/?a=1');
    expect(inj.bodyEnd).toContain('bannr.exit=function(){window.open("https://example.com/?a=1",\'_blank\');}');
    expect(inj.bodyEnd).toContain('bannr.track=function(n)');
  });
});

describe('component element', () => {
  it('has sensible defaults and survives cloning and new sizes', () => {
    const c = createComponent({ componentType: 'counter', props: { end: 100 } });
    expect(c).toMatchObject({
      type: 'component', componentType: 'counter', componentVersion: 1, props: { end: 100 }, slots: {}, width: 200, height: 200,
    });
    const copy = cloneElement(c);
    expect(copy.id).not.toBe(c.id);
    expect(copy.type).toBe('component');
    const s = adaptSize(createSize(480, 480, { elements: [c] }), 300, 250);
    expect(s.elements[0]).toMatchObject({ type: 'component', componentType: 'counter' });
  });

  it('renders a placeholder until the component registry exists', () => {
    const c = createComponent({ id: 'eC', componentType: 'cube' });
    const size = createSize(300, 250, { elements: [c] });
    const p = createProject('C', { platform: 'adform', sizes: [size] });
    const out = renderBanner(p, size.id, { resolveAsset: (id) => id });
    expect(out.html).toContain('<div id="eC" class="el el-component" data-component="cube">');
  });
});
