/** The eight phase names. New, the quarters and full get about a day each (±7.5° of the cycle). */
export function phaseName(phase: number): string {
  const p = ((phase % 360) + 360) % 360;
  const near = (target: number) => Math.min(Math.abs(p - target), 360 - Math.abs(p - target)) <= 7.5;
  if (near(0)) return 'new moon';
  if (near(90)) return 'first quarter';
  if (near(180)) return 'full moon';
  if (near(270)) return 'last quarter';
  if (p < 90) return 'waxing crescent';
  if (p < 180) return 'waxing gibbous';
  if (p < 270) return 'waning gibbous';
  return 'waning crescent';
}

/** "waxing" / "waning", or the principal phase's short name ("full", "new", "1st qtr", "3rd qtr"), to fit the face. */
export function phaseShort(phase: number): string {
  const name = phaseName(phase);
  switch (name) {
    case 'new moon': return 'new';
    case 'full moon': return 'full';
    case 'first quarter': return '1st qtr';
    case 'last quarter': return '3rd qtr';
    default: return name.split(' ')[0];
  }
}

/**
 * The lit part of a Moon of radius `r` at (`cx`, `cy`), as an SVG path, seen from the northern
 * hemisphere (lit on the right while waxing). Empty at new moon.
 */
export function litPath(phase: number, cx = 12, cy = 12, r = 8): string {
  const p = ((phase % 360) + 360) % 360;
  const rad = (p * Math.PI) / 180;
  const rx = Math.abs(r * Math.cos(rad));
  if (rx >= r - 0.05 && Math.cos(rad) > 0) return '';
  const waxing = p < 180;
  const gibbous = Math.cos(rad) < 0;
  const top = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;
  // Down the lit limb, then back up along the terminator, which bulges away from the lit side when gibbous.
  const limbSweep = waxing ? 1 : 0;
  const terminatorSweep = waxing === gibbous ? 1 : 0;
  const n = (value: number) => +value.toFixed(2);
  return `M${top} A${r} ${r} 0 0 ${limbSweep} ${bottom} A${n(rx)} ${r} 0 0 ${terminatorSweep} ${top} Z`;
}
