import { altAzToVector } from './sky-math';
import { computeLayout, screenPoint } from './sky-render';
import {
  MAX_PANORAMA_PIXELS,
  MAX_PANORAMA_SIDE,
  bringIntoView,
  bufferPoint,
  computePanorama,
  dragView,
  panoramaOffset,
  panoramaProjection,
  screenOfBuffer,
  turnBetween,
  viewBetween,
  viewDirection,
  viewPoint,
} from './sky-panorama';
import { FACE_SOUTH, LookView } from './sky-view';

const pan = computePanorama(1440, 900);
const views: LookView[] = [FACE_SOUTH, { facing: 0, tilt: 0 }, { facing: 338, tilt: 40 }, { facing: 0.4, tilt: 90 }, { facing: 359.6, tilt: 12 }];

describe('sky panorama (free look)', () => {
  describe('size', () => {
    it('matches the normal view\'s scale, and at 1× uses one buffer pixel per CSS pixel', () => {
      const layout = computeLayout(1440, 900);
      expect(pan.cssPerDeg).toBeCloseTo((layout.scale * Math.PI) / 180, 9);
      expect(pan.degPx).toBeCloseTo(pan.cssPerDeg, 9);
      expect(pan.artPixel).toBeCloseTo(1, 9);
      // 360° plus a screen's width across, so any facing is one unbroken stretch.
      expect(pan.width * pan.artPixel).toBeGreaterThanOrEqual(360 * pan.cssPerDeg + 1440);
      expect(pan.period).toBeCloseTo(360 * pan.degPx, 9);
      // From just under the horizon to past the zenith, as far as the top of the screen is when tilted right up.
      expect(pan.altBottom).toBeLessThan(-1);
      expect(pan.altTop).toBeGreaterThanOrEqual(90 + layout.horizonY / pan.cssPerDeg);
    });

    it('stays within its memory budget on big, dense screens, and never goes past the far horizon', () => {
      for (const [w, h, dpr] of [[1440, 900, 2], [2560, 1080, 1], [2560, 1440, 2], [390, 844, 3], [740, 360, 2]]) {
        const p = computePanorama(w, h, Math.min(2, dpr));
        expect(p.width * p.height).toBeLessThanOrEqual(MAX_PANORAMA_PIXELS * 1.01);
        expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(MAX_PANORAMA_SIDE + 1);
        expect(p.altTop).toBeLessThanOrEqual(181);
      }
      // A phone at 2× gets close to 2 buffer pixels per CSS pixel.
      expect(1 / computePanorama(390, 844, 2).artPixel).toBeGreaterThan(1.7);
    });
  });

  describe('lined up with the normal view facing south, level', () => {
    const layout = computeLayout(1440, 900);

    it('puts the south point of the horizon in the same place', () => {
      const normal = screenPoint(layout, altAzToVector(0, 180))!;
      const free = viewPoint(pan, FACE_SOUTH, 0, 180)!;
      expect(free.x).toBeCloseTo(normal.x, 6);
      expect(free.y).toBeCloseTo(normal.y, 6);
    });

    it('agrees closely near there, and drifts further out (stereographic vs cylinder)', () => {
      const offBy = (alt: number, az: number) => {
        const a = screenPoint(layout, altAzToVector(alt, az))!;
        const b = viewPoint(pan, FACE_SOUTH, alt, az, 1000)!;
        return Math.hypot(a.x - b.x, a.y - b.y);
      };
      expect(offBy(2, 178)).toBeLessThan(0.1);
      expect(offBy(20, 160)).toBeLessThan(10);
      expect(offBy(60, 180)).toBeGreaterThan(20);
    });
  });

  describe('mapping', () => {
    it('screen → sky → screen round trips, as seen and over the top', () => {
      const same = (a: { alt: number; az: number }, b: { alt: number; az: number }) =>
        Math.abs(a.alt - b.alt) < 1e-6 && (a.alt > 89.999 || Math.abs(turnBetween(a.az, b.az)) < 1e-6);
      for (const view of views) {
        for (const [x, y] of [[10, 10], [720, 479], [1400, 300], [200, 880], [720, 5]]) {
          const direction = viewDirection(pan, view, x, y);
          if (direction.alt < pan.altBottom) continue;
          const back = viewPoint(pan, view, direction.alt, direction.az, 1);
          expect(back).not.toBeNull();
          // Tilted past the zenith on a wide screen, a direction can be on screen twice (as seen, and
          // over the top): the point found is one of them, the one as seen if that's on screen.
          expect(same(viewDirection(pan, view, back!.x, back!.y), direction)).toBe(true);
        }
      }
      // Level and facing south, every direction above the horizon has one place.
      const { alt, az } = viewDirection(pan, FACE_SOUTH, 300, 200);
      const back = viewPoint(pan, FACE_SOUTH, alt, az)!;
      expect(back.x).toBeCloseTo(300, 6);
      expect(back.y).toBeCloseTo(200, 6);
    });

    it('past the zenith is the sky behind you: tilted right up, above the horizon line is facing the other way', () => {
      const view = { facing: 0, tilt: 90 };
      expect(viewDirection(pan, view, 720, pan.horizonY).alt).toBe(90);
      const above = viewDirection(pan, view, 720, pan.horizonY - 10 * pan.cssPerDeg);
      expect(above.alt).toBeCloseTo(80, 6);
      expect(above.az).toBeCloseTo(180, 6);
      const below = viewDirection(pan, view, 720, pan.horizonY + 10 * pan.cssPerDeg);
      expect(below.alt).toBeCloseTo(80, 6);
      expect(below.az).toBeCloseTo(0, 6);
    });

    it('what the renderer draws lands on screen where the view says (through the buffer, either side of the seam)', () => {
      const projection = panoramaProjection(pan);
      for (const view of views) {
        for (const [alt, az] of [[30, 0.2], [30, 359.8], [10, 180], [70, 90], [45, 300]]) {
          const on = viewPoint(pan, view, alt, az);
          if (!on) continue;
          // The buffer point in either image, and its copy a period over; the one on screen is where the view has it.
          const places = [0, 1].flatMap(image => {
            const p = projection.point(altAzToVector(alt, az), image);
            return p ? [p, { x: p.x + pan.period, y: p.y }] : [];
          }).map(p => screenOfBuffer(pan, view, p.x, p.y));
          expect(places.some(p => Math.hypot(p.x - on.x, p.y - on.y) < 1e-6)).toBe(true);
          const back = bufferPoint(pan, view, on.x, on.y);
          const screen = screenOfBuffer(pan, view, back.x, back.y);
          expect(screen.x).toBeCloseTo(on.x, 6);
        }
      }
    });

    it('every facing and tilt shows one unbroken stretch of the buffer across the screen', () => {
      for (let facing = 0; facing < 360; facing += 7) {
        for (let tilt = 0; tilt <= 90; tilt += 15) {
          const { x, y } = panoramaOffset(pan, { facing, tilt });
          expect(x).toBeLessThanOrEqual(0);
          expect(x + pan.width * pan.artPixel).toBeGreaterThanOrEqual(1440);
          // Down to the horizon line at least (below it is landscape), up to the top of the screen.
          expect(y).toBeLessThanOrEqual(0);
          expect(y + pan.height * pan.artPixel).toBeGreaterThanOrEqual(pan.horizonY);
        }
      }
    });

    it('wraps seamlessly past north: a star near north moves smoothly as the facing crosses 0°', () => {
      const a = viewPoint(pan, { facing: 0.5, tilt: 20 }, 40, 359.9)!;
      const b = viewPoint(pan, { facing: 359.5, tilt: 20 }, 40, 359.9)!;
      expect(b.x - a.x).toBeCloseTo(pan.cssPerDeg, 6);
      // And the canvas jumps a whole period between them, which looks the same.
      const [oa, ob] = [panoramaOffset(pan, { facing: 0.5, tilt: 20 }), panoramaOffset(pan, { facing: 359.5, tilt: 20 })];
      expect(Math.abs(ob.x - oa.x - pan.cssPerDeg) % (360 * pan.cssPerDeg)).toBeLessThan(1e-6);
    });
  });

  describe('moving', () => {
    it('a drag takes the sky with the pointer, wraps past north, and holds the tilt between horizon and zenith', () => {
      const p = pan.cssPerDeg;
      expect(dragView(pan, FACE_SOUTH, 45 * p, 0)).toEqual({ facing: 135, tilt: 0 });
      expect(dragView(pan, { facing: 2, tilt: 30 }, 4 * p, 10 * p).facing).toBeCloseTo(358, 6);
      expect(dragView(pan, { facing: 2, tilt: 30 }, 4 * p, 10 * p).tilt).toBeCloseTo(40, 6);
      expect(dragView(pan, FACE_SOUTH, 0, -50).tilt).toBe(0);
      expect(dragView(pan, { facing: 0, tilt: 80 }, 0, 100 * p).tilt).toBe(90);
    });

    it('in between two views, turns the short way round', () => {
      expect(turnBetween(350, 10)).toBe(20);
      expect(turnBetween(10, 350)).toBe(-20);
      expect(viewBetween({ facing: 350, tilt: 0 }, { facing: 10, tilt: 40 }, 0.5)).toEqual({ facing: 0, tilt: 20 });
      expect(viewBetween(FACE_SOUTH, { facing: 0, tilt: 0 }, 1)).toEqual({ facing: 0, tilt: 0 });
    });
  });

  describe('bringing a star into view', () => {
    // Pretend the bottom half of the screen is landscape, and the middle third a panel.
    const clear = (x: number, y: number) => x > 0 && y > 0 && x < 1440 && y < 450;
    const clearOfPanel = (x: number, y: number) => clear(x, y) && !(x > 500 && x < 1000);

    it('doesn\'t move if it\'s already in view', () => {
      const view = { facing: 180, tilt: 0 };
      expect(bringIntoView(pan, view, 30, 170, clear)).toBe(view);
    });

    it('turns round to one behind you, keeping the tilt, and puts it where it can be seen', () => {
      const view = bringIntoView(pan, FACE_SOUTH, 30, 10, clear)!;
      expect(view.tilt).toBe(0);
      const at = viewPoint(pan, view, 30, 10)!;
      expect(clear(at.x, at.y)).toBe(true);
      expect(at.x).toBeCloseTo(pan.centerX, 6); // the middle first
      // Not in the middle if a panel's there.
      const beside = bringIntoView(pan, FACE_SOUTH, 30, 10, clearOfPanel)!;
      const p = viewPoint(pan, beside, 30, 10)!;
      expect(clearOfPanel(p.x, p.y)).toBe(true);
    });

    it('tilts up for one too high to see at this tilt, and down for one that\'s sunk behind the hills', () => {
      const up = bringIntoView(pan, FACE_SOUTH, 85, 180, clear)!;
      expect(up.tilt).toBeGreaterThan(0);
      const at = viewPoint(pan, up, 85, 180)!;
      expect(clear(at.x, at.y)).toBe(true);
      const down = bringIntoView(pan, { facing: 180, tilt: 60 }, 20, 180, clear)!;
      expect(down.tilt).toBeLessThan(60);
      const p = viewPoint(pan, down, 20, 180)!;
      expect(clear(p.x, p.y)).toBe(true);
    });

    it('says so (null) if no view shows it, rather than turning to it anyway', () => {
      expect(bringIntoView(pan, FACE_SOUTH, 2, 45, () => false)).toBeNull();
    });

    it('on a phone, a low star that could only sit under the bottom sheet can\'t be shown (tilting only moves it down)', () => {
      const phone = computePanorama(390, 844, 2);
      // The sheet covers everything below y = 430; above it is clear sky.
      const clearOfSheet = (x: number, y: number) => x > 24 && x < 366 && y > 24 && y < 430;
      // Low (5° up): at tilt 0 it's at horizonY − 5° ≈ 428 + clearance → under the sheet's edge; no tilt lifts it.
      const low = 1 + (phone.horizonY - 430) / phone.cssPerDeg;
      expect(bringIntoView(phone, FACE_SOUTH, low - 2, 20, clearOfSheet)).toBeNull();
      // A little higher fits above the sheet.
      const view = bringIntoView(phone, FACE_SOUTH, low + 6, 20, clearOfSheet)!;
      const at = viewPoint(phone, view, low + 6, 20)!;
      expect(clearOfSheet(at.x, at.y)).toBe(true);
    });
  });
});
