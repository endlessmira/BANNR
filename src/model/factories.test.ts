import { describe, expect, it } from 'vitest';
import { cloneProject, createGroup, createProject, createSize, createText } from './factories';

describe('createProject', () => {
  it('refuses to create a project without a platform', () => {
    // @ts-expect-error: platform is required at the type level too
    expect(() => createProject('X', {})).toThrow(/platform must be chosen/);
  });
});

describe('cloneProject', () => {
  it('assigns fresh ids everywhere and remaps size references', () => {
    const master = createSize(300, 250, { elements: [createGroup([createText()])] });
    const derived = createSize(728, 90, { derivedFrom: master.id });
    const src = createProject('A', { platform: 'adform', sizes: [master, derived] });
    const copy = cloneProject(src);

    expect(copy.id).not.toBe(src.id);
    expect(copy.masterSizeId).toBe(copy.sizes[0]?.id);
    expect(copy.sizes[1]?.derivedFrom).toBe(copy.sizes[0]?.id);
    const g = copy.sizes[0]?.elements[0];
    expect(g?.type === 'group' && g.children[0]?.id).not.toBe(
      (src.sizes[0]?.elements[0] as { children: { id: string }[] }).children[0]?.id,
    );
  });

  it('keeps the platform when duplicating', () => {
    const src = createProject('A', { platform: 'ttd' });
    expect(cloneProject(src).selectedPlatform).toBe('ttd');
  });
});
