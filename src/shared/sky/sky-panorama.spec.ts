import { altAzToVector } from './sky-math';
import { computeLayout, screenPoint } from './sky-render';
import {
  MAX_PANORAMA_PIXELS,
  MAX_PANORAMA_SIDE,
  bringIntoView,
  bufferPoint,
  computePanorama,
  dragView,
  mercator,
  panoramaOffset,
  panoramaProjection,
  screenOfBuffer,
  turnBetween,
  unmercator,
  viewBetween,
  viewDirection,
  viewPoint,
} from './sky-panorama';
import { FACE_SOUTH, LookView } from './sky-view';

const pan = computePanorama(1440, 900);
const views: LookView[] = [FACE_SOUTH, { facing: 0 }, { facing: 338 }, { facing: 0.4 }, { facing: 359.6 }];

describe('sky panorama (free look)', () => {
  describe('size', () => {
    it('matches the normal view\'s scale, and at 1× uses one buffer pixel per CSS pixel', () => {
      const layout = computeLayout(1440, 900);
      expect(pan.cssPerDeg).toBeCloseTo((layout.scale * Math.PI) / 180, 9);
      expect(pan.cssScale).toBe(layout.scale);
      expect(pan.degPx).toBeCloseTo(pan.cssPerDeg, 9);
      expect(pan.artPixel).toBeCloseTo(1, 9);
      // 360° plus a screen's width across, so any facing is one unbroken stretch.
      expect(pan.width * pan.artPixel).toBeGreaterThanOrEqual(360 * pan.cssPerDeg + 1440);
      expect(pan.period).toBeCloseTo(360 * pan.degPx, 9);
      // From just under the horizon to just past the top of the screen.
      expect(pan.altBottom).toBeLessThan(-1);
      expect(pan.altTop).toBeGreaterThan(unmercator(layout.horizonY / layout.scale));
      expect(pan.altTop).toBeLessThan(unmercator(layout.horizonY / layout.scale) + 2);
    });

    it('reaches about 60° up on a landscape screen and about 75° on a phone held upright, never the zenith', () => {
      expect(pan.altTop).toBeGreaterThan(55);
      expect(pan.altTop).toBeLessThan(65);
      const phone = computePanorama(390, 844, 2);
      expect(phone.altTop).toBeGreaterThan(70);
      expect(phone.altTop).toBeLessThan(80);
      for (const [w, h] of [[2560, 1080], [740, 360], [320, 1200]]) expect(computePanorama(w, h).altTop).toBeLessThan(90);
    });

    it('stays within its memory budget on big, dense screens', () => {
      for (const [w, h, dpr] of [[1440, 900, 2], [2560, 1080, 1], [2560, 1440, 2], [390, 844, 3], [740, 360, 2]]) {
        const p = computePanorama(w, h, Math.min(2, dpr));
        expect(p.width * p.height).toBeLessThanOrEqual(MAX_PANORAMA_PIXELS * 1.01);
        expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(MAX_PANORAMA_SIDE + 1);
      }
      // A phone at 2× gets close to 2 buffer pixels per CSS pixel.
      expect(1 / computePanorama(390, 844, 2).artPixel).toBeGreaterThan(1.7);
    });
  });

  describe('the Mercator ordinate', () => {
    it('is zero at the horizon, grows with altitude, and inverts', () => {
      expect(mercator(0)).toBeCloseTo(0, 12);
      expect(mercator(45)).toBeGreaterThan(mercator(30));
      expect(mercator(-3)).toBeLessThan(0);
      for (const alt of [-3, 0, 12.5, 45, 70, 89]) expect(unmercator(mercator(alt))).toBeCloseTo(alt, 9);
    });
  });

  describe('lined up with the normal view facing south', () => {
    const layout = computeLayout(1440, 900);

    it('puts the south point of the horizon in the same place', () => {
      const normal = screenPoint(layout, altAzToVector(0, 180))!;
      const free = viewPoint(pan, FACE_SOUTH, 0, 180)!;
      expect(free.x).toBeCloseTo(normal.x, 6);
      expect(free.y).toBeCloseTo(normal.y, 6);
    });

    it('agrees closely near there, and drifts further out (stereographic vs Mercator)', () => {
      const offBy = (alt: number, az: number) => {
        const a = screenPoint(layout, altAzToVector(alt, az))!;
        const b = viewPoint(pan, FACE_SOUTH, alt, az, 1000)!;
        return Math.hypot(a.x - b.x, a.y - b.y);
      };
      expect(offBy(2, 178)).toBeLessThan(0.1);
      expect(offBy(20, 160)).toBeLessThan(10);
      expect(offBy(50, 180)).toBeGreaterThan(10);
    });

    it('is conformal: a small square of sky stays square (the same stretch up as across) high up', () => {
      const square = (alt: number, az: number) => {
        const o = viewPoint(pan, FACE_SOUTH, alt, az, 1e9)!;
        const right = viewPoint(pan, FACE_SOUTH, alt, az + 0.01 / Math.cos((alt * Math.PI) / 180), 1e9)!;
        const up = viewPoint(pan, FACE_SOUTH, alt + 0.01, az, 1e9)!;
        return Math.hypot(right.x - o.x, right.y - o.y) / Math.hypot(up.x - o.x, up.y - o.y);
      };
      expect(square(5, 180)).toBeCloseTo(1, 3);
      expect(square(50, 180)).toBeCloseTo(1, 3);
      // Where an equirectangular cylinder would have given 1 / cos 50° ≈ 1.56.
    });
  });

  describe('mapping', () => {
    it('screen → sky → screen round trips', () => {
      for (const view of views) {
        for (const [x, y] of [[10, 10], [720, 479], [1400, 300], [200, 880], [720, 5]]) {
          const direction = viewDirection(pan, view, x, y);
          if (direction.alt < pan.altBottom) continue;
          const back = viewPoint(pan, view, direction.alt, direction.az, 1)!;
          expect(back).not.toBeNull();
          expect(back.x).toBeCloseTo(x, 6);
          expect(back.y).toBeCloseTo(y, 6);
        }
      }
    });

    it('what the renderer draws lands on screen where the view says (through the buffer, either side of the seam)', () => {
      const projection = panoramaProjection(pan);
      expect(projection.images).toBe(1);
      for (const view of views) {
        for (const [alt, az] of [[30, 0.2], [30, 359.8], [10, 180], [50, 90], [45, 300]]) {
          const on = viewPoint(pan, view, alt, az);
          if (!on) continue;
          // The buffer point and its copy a period over; the one on screen is where the view has it.
          const p = projection.point(altAzToVector(alt, az), 0)!;
          const places = [p, { x: p.x + pan.period, y: p.y }].map(q => screenOfBuffer(pan, view, q.x, q.y));
          expect(places.some(q => Math.hypot(q.x - on.x, q.y - on.y) < 1e-6)).toBe(true);
          const back = bufferPoint(pan, view, on.x, on.y);
          const screen = screenOfBuffer(pan, view, back.x, back.y);
          expect(screen.x).toBeCloseTo(on.x, 6);
        }
      }
    });

    it('draws nothing above the window\'s top: the zenith has no place in the buffer', () => {
      const projection = panoramaProjection(pan);
      expect(projection.point(altAzToVector(89, 10), 0)).toBeNull();
      expect(projection.point(altAzToVector(pan.altTop - 1, 10), 0)).not.toBeNull();
    });

    it('every facing shows one unbroken stretch of the buffer across the screen', () => {
      for (let facing = 0; facing < 360; facing += 7) {
        const { x, y } = panoramaOffset(pan, { facing });
        expect(x).toBeLessThanOrEqual(0);
        expect(x + pan.width * pan.artPixel).toBeGreaterThanOrEqual(1440);
        // Down to the horizon line at least (below it is landscape), up to the top of the screen.
        expect(y).toBeLessThanOrEqual(0);
        expect(y + pan.height * pan.artPixel).toBeGreaterThanOrEqual(pan.horizonY);
      }
    });

    it('wraps seamlessly past north: a star near north moves smoothly as the facing crosses 0°', () => {
      const a = viewPoint(pan, { facing: 0.5 }, 40, 359.9)!;
      const b = viewPoint(pan, { facing: 359.5 }, 40, 359.9)!;
      expect(b.x - a.x).toBeCloseTo(pan.cssPerDeg, 6);
      // And the canvas jumps a whole period between them, which looks the same.
      const [oa, ob] = [panoramaOffset(pan, { facing: 0.5 }), panoramaOffset(pan, { facing: 359.5 })];
      expect(Math.abs(ob.x - oa.x - pan.cssPerDeg) % (360 * pan.cssPerDeg)).toBeLessThan(1e-6);
    });
  });

  describe('moving', () => {
    it('a drag takes the sky with the pointer and wraps past north', () => {
      const p = pan.cssPerDeg;
      expect(dragView(pan, FACE_SOUTH, 45 * p)).toEqual({ facing: 135 });
      expect(dragView(pan, { facing: 2 }, 4 * p).facing).toBeCloseTo(358, 6);
    });

    it('in between two views, turns the short way round', () => {
      expect(turnBetween(350, 10)).toBe(20);
      expect(turnBetween(10, 350)).toBe(-20);
      expect(viewBetween({ facing: 350 }, { facing: 10 }, 0.5)).toEqual({ facing: 0 });
      expect(viewBetween(FACE_SOUTH, { facing: 0 }, 1)).toEqual({ facing: 0 });
    });
  });

  describe('bringing a star into view', () => {
    // Pretend the bottom half of the screen is landscape, and the middle third a panel.
    const clear = (x: number, y: number) => x > 0 && y > 0 && x < 1440 && y < 450;
    const clearOfPanel = (x: number, y: number) => clear(x, y) && !(x > 500 && x < 1000);

    it('doesn\'t move if it\'s already in view', () => {
      const view = { facing: 180 };
      expect(bringIntoView(pan, view, 30, 170, clear)).toBe(view);
    });

    it('turns round to one behind you, and puts it where it can be seen', () => {
      const view = bringIntoView(pan, FACE_SOUTH, 30, 10, clear)!;
      const at = viewPoint(pan, view, 30, 10)!;
      expect(clear(at.x, at.y)).toBe(true);
      expect(at.x).toBeCloseTo(pan.centerX, 6); // the middle first
      // Not in the middle if a panel's there.
      const beside = bringIntoView(pan, FACE_SOUTH, 30, 10, clearOfPanel)!;
      const p = viewPoint(pan, beside, 30, 10)!;
      expect(clearOfPanel(p.x, p.y)).toBe(true);
    });

    it('says so (null) for one above the window\'s top, or one no view shows, rather than turning to it anyway', () => {
      expect(bringIntoView(pan, FACE_SOUTH, 85, 180, clear)).toBeNull();
      expect(bringIntoView(pan, FACE_SOUTH, 2, 45, () => false)).toBeNull();
    });

    it('on a phone, a low star that could only sit under the bottom sheet can\'t be shown', () => {
      const phone = computePanorama(390, 844, 2);
      // The sheet covers everything below y = 430; above it is clear sky.
      const clearOfSheet = (x: number, y: number) => x > 24 && x < 366 && y > 24 && y < 430;
      const low = unmercator((phone.horizonY - 430) / phone.cssScale);
      expect(bringIntoView(phone, FACE_SOUTH, low - 1, 20, clearOfSheet)).toBeNull();
      // A little higher fits above the sheet.
      const view = bringIntoView(phone, FACE_SOUTH, low + 6, 20, clearOfSheet)!;
      const at = viewPoint(phone, view, low + 6, 20)!;
      expect(clearOfSheet(at.x, at.y)).toBe(true);
    });
  });
});
