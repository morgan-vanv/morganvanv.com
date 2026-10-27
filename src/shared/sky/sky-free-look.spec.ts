import { flickVelocity } from './sky-free-look';

describe('free look: the glide after a flick', () => {
  it('measures the speed over the drag\'s last moments, capped so it glides gently', () => {
    expect(flickVelocity([{ t: 0, x: 0, y: 0 }, { t: 50, x: 50, y: 0 }], 60)).toEqual({ x: 1, y: 0 });
    const fast = flickVelocity([{ t: 0, x: 0, y: 0 }, { t: 10, x: 300, y: 400 }], 10)!;
    expect(Math.hypot(fast.x, fast.y)).toBeCloseTo(2, 6);
    expect(fast.x / fast.y).toBeCloseTo(0.75, 6);
  });

  it('no glide after a drag that had stopped, or was only one sample', () => {
    // Held still for a moment before letting go: only samples from the last 100 ms count.
    expect(flickVelocity([{ t: 0, x: 0, y: 0 }, { t: 50, x: 80, y: 0 }], 400)).toBeNull();
    expect(flickVelocity([{ t: 0, x: 0, y: 0 }], 10)).toBeNull();
    expect(flickVelocity([{ t: 0, x: 0, y: 0 }, { t: 90, x: 2, y: 0 }], 95)).toBeNull();
  });
});
