import { percent } from './overview-panel';

describe('percent', () => {
  it('computes completion and clamps to 0–100', () => {
    expect(percent(152, 170)).toBeCloseTo(89.41, 1);
    expect(percent(0, 10)).toBe(0);
    expect(percent(12, 10)).toBe(100);
  });

  it('is 0 when the total is unknown', () => {
    expect(percent(5, 0)).toBe(0);
  });
});
