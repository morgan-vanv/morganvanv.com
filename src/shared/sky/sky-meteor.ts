/**
 * A shooting star: one element, animated by CSS (like the fireflies), that
 * crosses the upper sky once on arrival and, rarely, again while a tab stays
 * open. Pure (no DOM): the sky component places it and the styles move it.
 * Nothing is redrawn for it.
 */

/** Falls this long after the sky is up (before the ☾ hint, which says what it was). */
export const METEOR_AFTER_MS = 2500;
/** The chance, on each minute's tick while the tab is visible, of another one: about one every ten minutes. */
export const METEOR_REPEAT_CHANCE = 0.1;
/** Remembers, for this tab, that the arrival star has fallen. */
export const METEOR_KEY = 'sky-meteor';
/** How often, out of one, it falls toward the bottom left (Morgan: it looks best that way); the rest go bottom right. */
export const METEOR_LEFTWARD = 0.8;

export interface Meteor {
  /** Where the head starts (CSS px). */
  readonly x: number;
  readonly y: number;
  /** How far it travels (CSS px); negative dx is leftward. */
  readonly dx: number;
  readonly dy: number;
  /** The streak's length (CSS px) and the angle it points (degrees, CSS rotate: 0 is rightward, positive clockwise). */
  readonly length: number;
  readonly angle: number;
  /** How long it takes (ms). */
  readonly duration: number;
}

const RAD = Math.PI / 180;

/**
 * Plans one meteor for a screen: it starts in the upper sky (the top 40% of what's above the
 * painting's horizon line, the middle 70% across), heads down at 20–35° from level, usually
 * toward the bottom left, 160–260 px long, and takes 0.7–1.0 s. `random` is 0…1 (injectable
 * for tests).
 */
export function planMeteor(width: number, horizonY: number, random: () => number = Math.random): Meteor {
  const leftward = random() < METEOR_LEFTWARD;
  const x = width * (0.15 + 0.7 * random());
  const y = horizonY * (0.08 + 0.32 * random());
  const slope = (20 + 15 * random()) * RAD;
  const length = 160 + 100 * random();
  const travel = length * (2.2 + 0.8 * random());
  const dx = Math.cos(slope) * travel * (leftward ? -1 : 1);
  const dy = Math.sin(slope) * travel;
  return {
    x, y, dx, dy, length,
    angle: Math.atan2(dy, dx) / RAD,
    duration: Math.round(700 + 300 * random()),
  };
}
