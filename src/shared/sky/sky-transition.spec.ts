import { computeLayout } from './sky-render';
import { LightState, SUN_HIDDEN_DEPTH, ease, lightBetween, sunBetween, sunPlaceAt, sunScreen } from './sky-transition';

describe('sky transition', () => {
  it('eases from 0 to 1, slow at both ends', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 9);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
    let last = 0;
    for (let t = 0.05; t <= 1; t += 0.05) {
      expect(ease(t)).toBeGreaterThanOrEqual(last);
      last = ease(t);
    }
  });

  it('finds the sky place of a point on screen, and puts it back there', () => {
    const layout = computeLayout(1280, 800, 0.5);
    const place = sunPlaceAt(layout, layout.valleyX, layout.valleyY);
    // The valley is a little below the horizon, a little west of south.
    expect(place.alt).toBeLessThan(0);
    expect(place.alt).toBeGreaterThan(-3);
    expect(place.az).toBeGreaterThan(180);
    const back = sunScreen(layout, place)!;
    expect(back.x).toBeCloseTo(layout.valleyX, 6);
    expect(back.y).toBeCloseTo(layout.valleyY, 6);
  });

  it('moves the Sun across the sky, the short way round', () => {
    const mid = sunBetween({ alt: 0, az: 350 }, { alt: 40, az: 30 }, 0.5)!;
    expect(mid.alt).toBeCloseTo(20, 9);
    expect(mid.az).toBeCloseTo(10, 9);
    expect(sunBetween({ alt: 10, az: 100 }, { alt: 20, az: 200 }, 0)).toEqual({ alt: 10, az: 100 });
    expect(sunBetween({ alt: 10, az: 100 }, { alt: 20, az: 200 }, 1)).toEqual({ alt: 20, az: 200 });
  });

  it('turning to darkness sets the Sun where it is; turning away raises one from below', () => {
    const setting = sunBetween({ alt: 40, az: 200 }, null, 0.5)!;
    expect(setting.az).toBeCloseTo(200, 9);
    expect(setting.alt).toBeCloseTo((40 - SUN_HIDDEN_DEPTH) / 2, 9);
    expect(sunBetween({ alt: 40, az: 200 }, null, 1)).toBeNull();
    const rising = sunBetween(null, { alt: -1, az: 190 }, 0.25)!;
    expect(rising.az).toBeCloseTo(190, 9);
    expect(rising.alt).toBeLessThan(-1);
    expect(sunBetween(null, null, 0.5)).toBeNull();
  });

  it('eases the small lights and the page with it, and lands exactly on each end', () => {
    const night: LightState = { sun: null, window: 1, fireflies: 0, daylight: 0 };
    const day: LightState = { sun: { alt: 40, az: 200 }, window: 0, fireflies: 0, daylight: 1 };
    const mid = lightBetween(night, day, 0.25);
    expect(mid.window).toBeCloseTo(0.75, 9);
    expect(mid.daylight).toBeCloseTo(0.25, 9);
    expect(mid.sun!.alt).toBeLessThan(40);
    expect(lightBetween(night, day, 0)).toBe(night);
    expect(lightBetween(night, day, 1)).toBe(day);
  });
});
