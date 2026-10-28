import { FACE_SOUTH, clampView, compassPoint, compassText, sameReading, spokenView } from './sky-view';

describe('sky view (free look)', () => {
  it('starts facing south', () => {
    expect(FACE_SOUTH).toEqual({ facing: 180 });
  });

  it('wraps the facing round', () => {
    expect(clampView({ facing: -22 })).toEqual({ facing: 338 });
    expect(clampView({ facing: 725 })).toEqual({ facing: 5 });
    expect(clampView({ facing: 360 })).toEqual({ facing: 0 });
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
    expect(compassText({ facing: 338 })).toBe('facing NNW · 338°');
    expect(compassText(FACE_SOUTH)).toBe('facing S · 180°');
    expect(compassText({ facing: 359.7 })).toBe('facing N · 0°');
    expect(spokenView({ facing: 337.6 })).toBe('facing north-northwest, 338°');
    expect(spokenView({ facing: 90 })).toBe('facing east, 90°');
  });

  it('only counts a change the compass would show', () => {
    expect(sameReading({ facing: 180.2 }, FACE_SOUTH)).toBe(true);
    expect(sameReading({ facing: 181 }, FACE_SOUTH)).toBe(false);
    expect(sameReading({ facing: 359.8 }, { facing: 0.2 })).toBe(true);
  });
});
