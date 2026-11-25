import { describe, expect, it } from 'vitest';
import { addSizes } from '@/editor/sizes';
import { useEditorStore } from '@/editor/store/editorStore';
import { createComponent, createProject, createSize } from '@/model/factories';
import { componentChecks } from '@/validation/components';
import { counter } from './counter';
import { cube } from './cube';
import { flip } from './flip';
import { sizeFit, sizeFitIssues, withComponentMins } from './fit';
import { leadform } from './leadform';

describe('component fit per size', () => {
  it('recommended sizes are fine; too small is unsupported; a very different shape or little room is tight', () => {
    expect(sizeFit(counter, 300, 250).level).toBe('ok');
    expect(sizeFit(flip, 300, 300).level).toBe('ok');
    expect(sizeFit(cube, 90, 60).level).toBe('unsupported');
    const wide = sizeFit(flip, 970, 250);
    expect(wide.level).toBe('tight');
    expect(wide.reason).toContain('very different shape');
    expect(wide.suggestion).toContain('Carousel');
    expect(sizeFit(leadform, 300, 300)).toMatchObject({ level: 'tight', reason: expect.stringContaining('small for Lead Form') });
  });

  it('lists the visible components that do not suit a size', () => {
    const size = createSize(970, 250, {
      elements: [
        createComponent({ name: 'A', componentType: 'flip', width: 970, height: 250 }),
        createComponent({ name: 'B', componentType: 'flip', width: 970, height: 250, hidden: true }),
        createComponent({ name: 'C', componentType: 'cube', width: 970, height: 250 }),
      ],
    });
    expect(sizeFitIssues(size).map((i) => i.name)).toEqual(['A']);
  });

  it('the checklist warns with the suggestion', () => {
    const size = createSize(970, 250, { elements: [createComponent({ componentType: 'flip', width: 970, height: 250 })] });
    const w = componentChecks(size).filter((r) => r.ruleId === 'component-size-fit');
    expect(w).toEqual([expect.objectContaining({ level: 'warning', detail: expect.stringContaining('Carousel') })]);
  });

  it('enlarges components below their minimum size, kept inside the banner', () => {
    const size = createSize(300, 250, { elements: [createComponent({ componentType: 'cube', x: 0, y: 0, width: 50, height: 40 })] });
    withComponentMins(size);
    expect(size.elements[0]).toMatchObject({ x: 0, y: 0, width: 100, height: 80 });
  });

  it('generated sizes respect the minimum size', () => {
    const master = createSize(480, 480, {
      elements: [createComponent({ componentType: 'cube', x: 180, y: 190, width: 120, height: 100 })],
    });
    useEditorStore.getState().load(createProject('F', { platform: 'cm360', sizes: [master] }));
    addSizes([{ width: 300, height: 250 }], 'master');
    const el = useEditorStore.getState().project!.sizes.at(-1)!.elements[0]!;
    expect([el.width, el.height]).toEqual([100, 80]);
    expect(el.x).toBeCloseTo(100, 0);
    expect(el.y).toBeCloseTo(85, 0);
  });
});
