import { FACE_SOUTH, clampView, compassPoint, compassText, sameReading, spokenView } from './sky-view';

describe('sky view (free look)', () => {
  it('starts facing south, level', () => {
    expect(FACE_SOUTH).toEqual({ facing: 180, tilt: 0 });
  });

  it('wraps the facing round and holds the tilt between the horizon and the zenith', () => {
    expect(clampView({ facing: -22, tilt: -5 })).toEqual({ facing: 338, tilt: 0 });
    expect(clampView({ facing: 725, tilt: 120 })).toEqual({ facing: 5, tilt: 90 });
    expect(clampView({ facing: 360, tilt: 40 })).toEqual({ facing: 0, tilt: 40 });
  });

  it('names the 16 points of the compass', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(338)).toBe('NNW');
    expect(compassPoint(349)).toBe('N'); // rounds to the nearest point, past north
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(202.5)).toBe('SSW');
    expect(compassPoint(-90)).toBe('W');
  });

  it('reads like a compass, and says it in words', () => {
    expect(compassText({ facing: 338, tilt: 40 })).toBe('facing NNW · 338° · looking up 40°');
    expect(compassText(FACE_SOUTH)).toBe('facing S · 180° · at the horizon');
    expect(compassText({ facing: 359.7, tilt: 89.8 })).toBe('facing N · 0° · straight up');
    expect(spokenView({ facing: 337.6, tilt: 40.2 })).toBe('facing north-northwest, 338°, looking up 40°');
    expect(spokenView({ facing: 90, tilt: 0 })).toBe('facing east, 90°, at the horizon');
  });

  it('only counts a change the compass would show', () => {
    expect(sameReading({ facing: 180.2, tilt: 0.3 }, FACE_SOUTH)).toBe(true);
    expect(sameReading({ facing: 181, tilt: 0 }, FACE_SOUTH)).toBe(false);
    expect(sameReading({ facing: 359.8, tilt: 10 }, { facing: 0.2, tilt: 10 })).toBe(true);
  });
});
