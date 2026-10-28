import { METEOR_LEFTWARD, planMeteor } from './sky-meteor';

describe('sky meteor (a shooting star)', () => {
  const sequence = (...values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it('starts in the upper sky, clear of the edges, and heads down at a shallow angle', () => {
    for (let n = 0; n < 200; n++) {
      const m = planMeteor(1440, 480);
      expect(m.x).toBeGreaterThanOrEqual(1440 * 0.15);
      expect(m.x).toBeLessThanOrEqual(1440 * 0.85);
      expect(m.y).toBeGreaterThanOrEqual(480 * 0.08);
      expect(m.y).toBeLessThanOrEqual(480 * 0.4);
      expect(m.dy).toBeGreaterThan(0);
      const slope = (Math.atan2(m.dy, Math.abs(m.dx)) * 180) / Math.PI;
      expect(slope).toBeGreaterThanOrEqual(20);
      expect(slope).toBeLessThanOrEqual(35);
      expect(m.length).toBeGreaterThanOrEqual(160);
      expect(m.length).toBeLessThanOrEqual(260);
      expect(m.duration).toBeGreaterThanOrEqual(700);
      expect(m.duration).toBeLessThanOrEqual(1000);
      // It points the way it travels.
      expect(m.angle).toBeCloseTo((Math.atan2(m.dy, m.dx) * 180) / Math.PI, 9);
    }
  });

  it('usually falls toward the bottom left, now and then the bottom right', () => {
    const left = planMeteor(1440, 480, sequence(METEOR_LEFTWARD - 0.01, 0.5));
    expect(left.dx).toBeLessThan(0);
    expect(left.angle).toBeGreaterThan(90);
    const right = planMeteor(1440, 480, sequence(METEOR_LEFTWARD + 0.01, 0.5));
    expect(right.dx).toBeGreaterThan(0);
    expect(right.angle).toBeLessThan(90);
    let leftward = 0;
    for (let n = 0; n < 1000; n++) if (planMeteor(1440, 480).dx < 0) leftward++;
    expect(leftward / 1000).toBeGreaterThan(0.7);
    expect(leftward / 1000).toBeLessThan(0.9);
  });
});
