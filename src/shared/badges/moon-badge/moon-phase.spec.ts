import { litPath, phaseName, phaseShort } from './moon-phase';

describe('moon phases', () => {
  it('names the eight phases, giving the principal ones about a day each', () => {
    expect(phaseName(0)).toBe('new moon');
    expect(phaseName(359)).toBe('new moon');
    expect(phaseName(45)).toBe('waxing crescent');
    expect(phaseName(92)).toBe('first quarter');
    expect(phaseName(135)).toBe('waxing gibbous');
    expect(phaseName(184)).toBe('full moon');
    // The night after the October 2026 full Moon.
    expect(phaseName(191.7)).toBe('waning gibbous');
    expect(phaseName(270)).toBe('last quarter');
    expect(phaseName(315)).toBe('waning crescent');
  });

  it('keeps the face short', () => {
    expect(phaseShort(191.7)).toBe('waning');
    expect(phaseShort(45)).toBe('waxing');
    expect(phaseShort(180)).toBe('full');
    expect(phaseShort(90)).toBe('1st qtr');
    expect(phaseShort(2)).toBe('new');
    expect(phaseShort(270)).toBe('3rd qtr');
  });

  it('draws nothing at new moon, the whole disc at full, and the lit side on the right while waxing', () => {
    expect(litPath(0)).toBe('');
    // Full: down one limb and back up the other.
    expect(litPath(180)).toBe('M12 4 A8 8 0 0 0 12 20 A8 8 0 0 0 12 4 Z');
    // Waxing crescent: down the right limb, back up a terminator bulging right.
    expect(litPath(45)).toBe('M12 4 A8 8 0 0 1 12 20 A5.66 8 0 0 0 12 4 Z');
    // Waning gibbous: down the left limb, back up a terminator bulging right.
    expect(litPath(225)).toBe('M12 4 A8 8 0 0 0 12 20 A5.66 8 0 0 0 12 4 Z');
  });
});
