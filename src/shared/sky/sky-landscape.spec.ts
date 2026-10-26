import { LandscapeLayer, compositeLandscape, isLand, lookWeights, windowGlow } from './sky-landscape';
import { computeLayout } from './sky-render';

const sum = (w: Record<string, number | undefined>) => Object.values(w).reduce((a, b) => a! + (b ?? 0), 0);

describe('sky landscape', () => {
  it('fixed lightings use their own look', () => {
    expect(lookWeights('darkness', 40, 180)).toEqual({ darkness: 1 });
    expect(lookWeights('sunset', -30, 0)).toEqual({ sunset: 1 });
    expect(lookWeights('day', -30, 0)).toEqual({ day: 1 });
  });

  it('real time follows the Sun: night, then sunrise in the morning or sunset in the evening, then day', () => {
    expect(lookWeights('real', -30, 0)).toEqual({ darkness: 1 });
    expect(lookWeights('real', 40, 180)).toEqual({ day: 1 });
    const morning = lookWeights('real', -6, 100);
    expect(morning.sunrise).toBeGreaterThan(0);
    expect(morning.sunset).toBeUndefined();
    const evening = lookWeights('real', 2, 260);
    expect(evening.sunset).toBeGreaterThan(0);
    expect(evening.day).toBeGreaterThan(0);
    for (const alt of [-14, -10, -6, -3, 0, 5, 9, 12]) expect(sum(lookWeights('real', alt, 250))).toBeCloseTo(1, 6);
  });

  it('the farmhouse light is on after dark and off in daylight', () => {
    expect(windowGlow('darkness', 60)).toBe(1);
    expect(windowGlow('day', -30)).toBe(0);
    expect(windowGlow('real', -20)).toBe(1);
    expect(windowGlow('real', 20)).toBe(0);
    expect(windowGlow('sunset', -3)).toBeGreaterThan(windowGlow('sunrise', -3));
  });

  it('composites only solid land pixels, blending looks by weight, and lights the window', () => {
    const layout = computeLayout(1280, 800);
    const size = layout.width * layout.height * 4;
    const sky = new Uint8ClampedArray(size).fill(10);
    const make = (value: number, alpha: (i: number) => number): LandscapeLayer => {
      const data = new Uint8ClampedArray(size);
      for (let i = 0; i < size; i += 4) data.set([value, value, value, alpha(i)], i);
      return { look: 'darkness', data };
    };
    // Land in the bottom half only.
    const half = Math.floor(layout.height / 2) * layout.width * 4;
    const land = (i: number) => (i >= half ? 255 : 0);
    const a = make(100, land);
    const b = { ...make(200, land), look: 'day' as const };
    compositeLandscape(sky, layout, [{ layer: a, weight: 0.25 }, { layer: b, weight: 0.75 }], 0);
    expect(sky[0]).toBe(10);
    expect(sky[size - 4]).toBe(175);
    expect(isLand(a, layout, 1, 1)).toBe(false);
    expect(isLand(a, layout, 1, layout.height - 1)).toBe(true);

    const lit = new Uint8ClampedArray(size).fill(10);
    compositeLandscape(lit, layout, [{ layer: make(20, () => 255), weight: 1 }], 1);
    const i = (Math.round(layout.windowY) * layout.width + Math.round(layout.windowX)) * 4;
    expect(lit[i]).toBeGreaterThan(200);
    expect(lit[i]).toBeGreaterThan(lit[i + 2]);
  });
});
