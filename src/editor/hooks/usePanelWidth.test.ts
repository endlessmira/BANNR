import { describe, expect, it } from 'vitest';
import { panelWidthFor } from './usePanelWidth';

describe('properties panel width', () => {
  it('is 600 px on wide screens, narrower on small ones, and never squeezes the canvas', () => {
    expect(panelWidthFor(null, 1280)).toBe(300);
    expect(panelWidthFor(null, 1600)).toBe(600);
    expect(panelWidthFor(null, 2560)).toBe(600);
    expect(panelWidthFor(800, 1280)).toBe(560);
    expect(panelWidthFor(1200, 2560)).toBe(900);
    expect(panelWidthFor(100, 1920)).toBe(300);
  });
});
