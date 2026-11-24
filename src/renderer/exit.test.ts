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

  it('the preview runs the platform click code and reports tracked events', () => {
    const size = createSize(300, 250);
    const cm = previewInjection(createProject('C', { platform: 'cm360', sizes: [size], landingUrl: 'https://example.com/?a=1' }), size);
    expect(cm.head).toContain('var clickTag = "https://example.com/?a=1";');
    expect(cm.bodyEnd).toContain("bannr.exit = function(){ window.open(window.clickTag, '_blank'); };");
    expect(cm.bodyEnd).toContain('bannr.track=function(n)');
    const ad = previewInjection(createProject('A', { platform: 'adform', sizes: [size] }), size);
    expect(ad.head.indexOf('window.API_URL=')).toBeGreaterThan(-1);
    expect(ad.head.indexOf('window.API_URL=')).toBeLessThan(ad.head.indexOf('Adform.DHTML.js'));
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
