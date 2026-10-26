import { lookWeights, nightLights, windowGlow } from './sky-landscape';
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

  it('puts the window light and the campfire on the farmhouse, in CSS pixels at any resolution', () => {
    // 1280 × 800: the painting at half size, 26.5 px cropped off the top.
    const lights = nightLights(computeLayout(1280, 800));
    expect(lights.window).toEqual({ x: 271, y: 499.5 });
    expect(lights.fire).toEqual({ x: 336, y: 509 });
    expect(lights.size).toBe(1);
    expect(nightLights(computeLayout(1280, 800, 0.5))).toEqual(lights);
    // Never vanishingly small on a phone.
    expect(nightLights(computeLayout(390, 844)).size).toBeGreaterThanOrEqual(0.7);
  });

  it('the farmhouse light is on after dark and off in daylight', () => {
    expect(windowGlow('darkness', 60)).toBe(1);
    expect(windowGlow('day', -30)).toBe(0);
    expect(windowGlow('real', -20)).toBe(1);
    expect(windowGlow('real', 20)).toBe(0);
    expect(windowGlow('sunset', -3)).toBeGreaterThan(windowGlow('sunrise', -3));
  });


});

describe('fireflies', () => {
  it('come out at the staged sunset and on real evenings in twilight, not otherwise', async () => {
    const { fireflyAmount } = await import('./sky-landscape');
    expect(fireflyAmount('sunset', -3, 270)).toBe(1);
    expect(fireflyAmount('darkness', -30, 0)).toBe(0);
    expect(fireflyAmount('sunrise', -3, 90)).toBe(0);
    expect(fireflyAmount('real', -6, 270)).toBeGreaterThan(0.3);
    expect(fireflyAmount('real', -6, 90)).toBe(0); // morning
    expect(fireflyAmount('real', 20, 250)).toBe(0);
    expect(fireflyAmount('real', -25, 300)).toBe(0);
  });

  it('are scattered over the meadow, the same every time, in CSS pixels at any resolution', async () => {
    const { fireflies } = await import('./sky-landscape');
    const layout = computeLayout(1280, 800);
    const a = fireflies(layout, 14);
    expect(a).toEqual(fireflies(layout, 14));
    expect(fireflies(computeLayout(1280, 800, 0.5), 14)).toEqual(a);
    expect(a.length).toBe(14);
    for (const fly of a) {
      // Below the treeline, above the bottom of the screen.
      expect(fly.y).toBeGreaterThan(layout.horizonY);
      expect(fly.y).toBeLessThan(800);
      expect(fly.x).toBeGreaterThan(0);
      expect(fly.x).toBeLessThan(1280);
    }
  });
});
