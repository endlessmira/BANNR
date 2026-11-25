import { describe, expect, it } from 'vitest';
import { carousel } from './carousel';
import { carouselset } from './carouselset';
import { defaultProps } from './settings';

describe('carousel looping', () => {
  it('carousels wrap around by default', () => {
    expect(defaultProps(carousel).loop).toBe(true);
    expect(defaultProps(carouselset).loop).toBe(true);
  });
});
