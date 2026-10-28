import { Vec3, altAz, altAzToVector } from './sky-math';
import { computeLayout, screenPoint } from './sky-render';
import {
  CAMERA_FOV,
  FACES,
  GUTTER,
  MAX_FACE_PIXELS,
  MAX_FACE_SIDE,
  atlasDirection,
  atlasPoint,
  bringIntoView,
  cameraFrame,
  computeCube,
  cubeTransform,
  dragView,
  faceAt,
  faceOf,
  faceOrigin,
  facePoint,
  faceProjection,
  faceTransform,
  groundShift,
  screenOfAtlas,
  turnBetween,
  viewBetween,
  viewDirection,
  viewPoint,
} from './sky-cube';
import { FACE_SOUTH, LookView } from './sky-view';

const cube = computeCube(1440, 900);
const views: LookView[] = [FACE_SOUTH, { facing: 0, tilt: 0 }, { facing: 338, tilt: 40 }, { facing: 0.4, tilt: 90 }, { facing: 359.6, tilt: 12 }, { facing: 90, tilt: 60 }];
const RAD = Math.PI / 180;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sameDirection = (a: Vec3, b: Vec3) => dot(a, b) > 1 - 1e-9;

/** matrix3d(...) as sixteen numbers. */
const numbers = (transform: string) => transform.replace(/^matrix3d\(|\)$/g, '').split(',').map(Number);
/** A 3D point through a matrix3d (column-major, as CSS has it). */
function apply(transform: string, p: Vec3): Vec3 {
  const m = numbers(transform);
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

describe('sky cube (free look\'s camera)', () => {
  describe('size', () => {
    it('sees CAMERA_FOV across the longer side, a face per CSS pixel at 1×, within the budget', () => {
      expect(2 * Math.atan(720 / cube.focal) / RAD).toBeCloseTo(CAMERA_FOV, 6);
      expect(cube.faceCss).toBeCloseTo(2 * cube.focal, 9);
      expect(cube.face).toBe(Math.floor(cube.faceCss));
      expect(cube.artPixel).toBeCloseTo(cube.faceCss / cube.face, 9);
      const layout = computeLayout(1440, 900);
      expect(cube.centerX).toBe(layout.centerX);
      expect(cube.horizonY).toBe(layout.horizonY);
      for (const [w, h, dpr] of [[1440, 900, 2], [2560, 1080, 1], [2560, 1440, 2], [390, 844, 3], [740, 360, 2]]) {
        const c = computeCube(w, h, Math.min(2, dpr));
        expect(c.face * c.face * FACES.length).toBeLessThanOrEqual(MAX_FACE_PIXELS);
        expect(c.face).toBeLessThanOrEqual(MAX_FACE_SIDE);
      }
      // A phone held upright sees CAMERA_FOV top to bottom, so less across.
      const phone = computeCube(390, 844, 2);
      expect(2 * Math.atan(422 / phone.focal) / RAD).toBeCloseTo(CAMERA_FOV, 6);
      expect(2 * Math.atan(195 / phone.focal) / RAD).toBeLessThan(60);
      expect(1 / phone.artPixel).toBeGreaterThan(1.7);
    });

    it('lays the faces out in an atlas with gutters all round', () => {
      for (let i = 0; i < FACES.length; i++) {
        const o = faceOrigin(cube, i);
        expect(o.x).toBeGreaterThanOrEqual(GUTTER);
        expect(o.y).toBeGreaterThanOrEqual(GUTTER);
        expect(o.x + cube.face + GUTTER).toBeLessThanOrEqual(cube.width);
        expect(o.y + cube.face + GUTTER).toBeLessThanOrEqual(cube.height);
        expect(faceAt(cube, o.x + 1, o.y + 1)).toBe(i);
        expect(faceAt(cube, o.x + cube.face + GUTTER / 3, o.y + cube.face - 1)).toBe(i); // its gutter is its own
      }
    });
  });

  describe('faces', () => {
    it('are right-handed 90° views: south, west, north, east, then up, joined along the south face\'s top', () => {
      for (const f of FACES) {
        const [rx, ry, rz] = [f.r[1] * f.u[2] - f.r[2] * f.u[1], f.r[2] * f.u[0] - f.r[0] * f.u[2], f.r[0] * f.u[1] - f.r[1] * f.u[0]];
        expect(sameDirection([rx, ry, rz], f.d)).toBe(true); // right × up = forward
      }
      expect(faceOf(altAzToVector(10, 180))).toBe(0);
      expect(faceOf(altAzToVector(10, 270))).toBe(1);
      expect(faceOf(altAzToVector(10, 0))).toBe(2);
      expect(faceOf(altAzToVector(10, 90))).toBe(3);
      expect(faceOf(altAzToVector(80, 123))).toBe(4);
      // Along the south face's top edge (45° up, due south), the up face's bottom edge meets it: same column.
      const edge = altAzToVector(45, 180);
      const [a, b] = [facePoint(cube, 0, edge)!, facePoint(cube, 4, edge)!];
      expect(a.y - faceOrigin(cube, 0).y).toBeCloseTo(0, 6);
      expect(b.y - faceOrigin(cube, 4).y).toBeCloseTo(cube.face, 6);
      expect(a.x - faceOrigin(cube, 0).x).toBeCloseTo(b.x - faceOrigin(cube, 4).x, 6);
    });

    it('project gnomonically: the middle of a face is its direction, its corners 45° out, and a little past the edge lands in the gutter', () => {
      const o = faceOrigin(cube, 0);
      const half = cube.face / 2;
      const middle = facePoint(cube, 0, altAzToVector(0, 180))!;
      expect(middle.x).toBeCloseTo(o.x + half, 6);
      expect(middle.y).toBeCloseTo(o.y + half, 6);
      // West on the right: 30° toward the west lands tan 30° of a half-face to the right.
      const west = facePoint(cube, 0, altAzToVector(0, 210))!;
      expect(west.x - middle.x).toBeCloseTo(half * Math.tan(30 * RAD), 6);
      const corner = facePoint(cube, 0, altAzToVector(Math.atan(Math.SQRT1_2) / RAD, 225))!; // the cube's corner, 54.7° from the face's middle
      expect(corner.x - o.x).toBeCloseTo(cube.face, 2);
      expect(corner.y - o.y).toBeCloseTo(0, 2);
      // 2° past the edge is still drawn (into the gutter); well past it isn't.
      expect(facePoint(cube, 0, altAzToVector(0, 227))).not.toBeNull();
      expect(facePoint(cube, 0, altAzToVector(0, 260))).toBeNull();
      expect(facePoint(cube, 0, altAzToVector(0, 0))).toBeNull(); // behind
    });

    it('atlas → direction → atlas round trips, on the face and in its gutter', () => {
      for (let face = 0; face < FACES.length; face++) {
        const o = faceOrigin(cube, face);
        for (const [dx, dy] of [[1, 1], [cube.face / 2, cube.face / 2], [cube.face - 1, 10], [cube.face + GUTTER / 2, cube.face / 3], [-GUTTER / 2, cube.face - 5]]) {
          const [x, y] = [o.x + dx, o.y + dy];
          const h = atlasDirection(cube, face, x, y);
          const back = facePoint(cube, face, h)!;
          expect(back.x).toBeCloseTo(x, 6);
          expect(back.y).toBeCloseTo(y, 6);
        }
      }
    });

    it('a face\'s projection for the renderer is its own buffer with the gutter round it, lined up with the atlas', () => {
      const projection = faceProjection(cube, 2);
      expect(projection.images).toBe(1);
      expect(projection.period).toBe(0);
      expect(projection.width).toBe(cube.face + 2 * GUTTER);
      const h = altAzToVector(20, 10);
      const [own, atlas] = [projection.point(h, 0)!, facePoint(cube, 2, h)!];
      const o = faceOrigin(cube, 2);
      expect(own.x).toBeCloseTo(atlas.x - (o.x - GUTTER), 6);
      expect(own.y).toBeCloseTo(atlas.y - (o.y - GUTTER), 6);
      expect(projection.point(altAzToVector(20, 180), 0)).toBeNull();
      expect(projection.maxSegment).toBeLessThan(cube.face / 2);
    });
  });

  describe('the camera', () => {
    it('facing south, level, agrees with the normal view at the painting\'s horizon and drifts away from it (rectilinear vs stereographic)', () => {
      const layout = computeLayout(1440, 900);
      const normal = screenPoint(layout, altAzToVector(0, 180))!;
      const camera = viewPoint(cube, FACE_SOUTH, altAzToVector(0, 180))!;
      expect(camera.x).toBeCloseTo(normal.x, 6);
      expect(camera.y).toBeCloseTo(normal.y, 6);
      const offBy = (alt: number, az: number) => {
        const a = screenPoint(layout, altAzToVector(alt, az))!;
        const b = viewPoint(cube, FACE_SOUTH, altAzToVector(alt, az), 1e9)!;
        return Math.hypot(a.x - b.x, a.y - b.y);
      };
      expect(offBy(0.2, 179.8)).toBeLessThan(2);
      expect(offBy(30, 150)).toBeGreaterThan(30); // the camera is zoomed in on the normal view (100° across, not 180°)
    });

    it('screen → direction → screen round trips in every view, and straight ahead is the view', () => {
      for (const view of views) {
        const ahead = viewPoint(cube, view, altAzToVector(view.tilt, view.facing))!;
        expect(ahead.x).toBeCloseTo(cube.centerX, 6);
        expect(ahead.y).toBeCloseTo(cube.horizonY, 6);
        for (const [x, y] of [[10, 10], [720, 450], [1400, 300], [200, 880], [720, 5]]) {
          const h = viewDirection(cube, view, x, y);
          const back = viewPoint(cube, view, h, 1)!;
          expect(back.x).toBeCloseTo(x, 6);
          expect(back.y).toBeCloseTo(y, 6);
        }
      }
    });

    it('keeps up up: the zenith is straight above the middle, and tilting raises it toward the horizon line', () => {
      const zenith: Vec3 = [0, 0, 1];
      // Level, the zenith is behind the camera's plane (90° from its axis): not on screen at all.
      expect(viewPoint(cube, FACE_SOUTH, zenith, 1e9)).toBeNull();
      const nearly = viewPoint(cube, FACE_SOUTH, altAzToVector(80, 180), 1e9)!;
      expect(nearly.x).toBeCloseTo(cube.centerX, 6);
      expect(nearly.y).toBeLessThan(cube.horizonY - cube.focal * 5); // a long way up (tan 80°)
      const up = viewPoint(cube, { facing: 180, tilt: 60 }, zenith)!;
      expect(up.y).toBeCloseTo(cube.horizonY - cube.focal * Math.tan(30 * RAD), 6);
      const top = viewPoint(cube, { facing: 180, tilt: 90 }, zenith)!;
      expect(top.y).toBeCloseTo(cube.horizonY, 6);
      // And straight up, north is at the top of the screen and east on the left (the sky, not a map).
      const north = viewPoint(cube, { facing: 180, tilt: 90 }, altAzToVector(80, 0))!;
      const east = viewPoint(cube, { facing: 180, tilt: 90 }, altAzToVector(80, 90))!;
      expect(north.y).toBeLessThan(top.y);
      expect(east.x).toBeLessThan(top.x);
    });

    it('a screen point maps to the atlas on the face it\'s best drawn on, and back', () => {
      for (const view of views) {
        for (const [x, y] of [[100, 100], [720, 400], [1300, 850]]) {
          const h = viewDirection(cube, view, x, y);
          const at = atlasPoint(cube, view, x, y);
          expect(at.face).toBe(faceOf(h));
          expect(faceAt(cube, at.x, at.y)).toBe(at.face);
          const back = screenOfAtlas(cube, view, at.x, at.y);
          expect(back.x).toBeCloseTo(x, 4);
          expect(back.y).toBeCloseTo(y, 4);
        }
      }
    });

    it('slides the ground down as the camera tilts up: not at all level, off the bottom well before straight up', () => {
      expect(groundShift(cube, FACE_SOUTH)).toBe(0);
      expect(groundShift(cube, { facing: 180, tilt: 20 })).toBeCloseTo(cube.focal * Math.tan(20 * RAD), 6);
      expect(groundShift(cube, { facing: 180, tilt: 60 })).toBe(cube.viewHeight);
      expect(groundShift(cube, { facing: 180, tilt: 90 })).toBe(cube.viewHeight);
    });
  });

  describe('CSS', () => {
    it('the cube\'s transform puts a direction where the camera does, through CSS perspective', () => {
      for (const view of views) {
        const box = cubeTransform(cube, view);
        for (const h of [altAzToVector(10, 180), altAzToVector(50, 300), altAzToVector(89, 10), altAzToVector(5, 90)]) {
          const on = viewPoint(cube, view, h, 1e9);
          const { f } = cameraFrame(view);
          // Where the cube puts the point, a `focal` out along h, in the sky's CSS frame (x west, y down, z north).
          const p = apply(box, [-h[1] * cube.focal, -h[2] * cube.focal, h[0] * cube.focal]);
          if (dot(h, f) < 0.05) continue; // behind the camera: not shown
          // CSS perspective: the viewer at z = focal, looking at the origin of the .free layer.
          const scale = cube.focal / (cube.focal - p[2]);
          expect(cube.centerX + p[0] * scale).toBeCloseTo(on!.x, 2);
          expect(cube.horizonY + p[1] * scale).toBeCloseTo(on!.y, 2);
        }
      }
    });

    it('each face\'s transform puts its canvas `focal` out, facing the viewer, lined up with its projection', () => {
      for (let i = 0; i < FACES.length; i++) {
        const t = faceTransform(cube, i);
        const f = FACES[i];
        // The canvas's centre goes to focal × d; its x axis along r and its y axis down along −u (CSS frame).
        const centre = apply(t, [0, 0, 0]);
        expect(centre).toEqual([-f.d[1], -f.d[2], f.d[0]].map(v => expect.closeTo(v * cube.focal, 6)));
        const right = apply(t, [1, 0, 0]).map((v, k) => v - centre[k]);
        expect(right).toEqual([-f.r[1], -f.r[2], f.r[0]].map(v => expect.closeTo(v, 6)));
        const down = apply(t, [0, 1, 0]).map((v, k) => v - centre[k]);
        expect(down).toEqual([f.u[1], f.u[2], -f.u[0]].map(v => expect.closeTo(v, 6)));
        // Its front (local +z) points in, toward the viewer at the cube's centre.
        const front = apply(t, [0, 0, 1]);
        const normal: Vec3 = [front[0] - centre[0], front[1] - centre[1], front[2] - centre[2]];
        expect(dot(normal, centre)).toBeLessThan(0);
      }
    });

    it('a point drawn on a face sits, in the cube, on the line from the viewer out along its direction', () => {
      for (const [face, h] of [[0, altAzToVector(20, 190)], [1, altAzToVector(30, 250)], [4, altAzToVector(70, 45)]] as const) {
        const t = faceTransform(cube, face);
        const drawn = facePoint(cube, face, h)!;
        const o = faceOrigin(cube, face);
        // Buffer px from the face's middle → CSS px on the canvas (its transform origin is its middle).
        const local: Vec3 = [(drawn.x - o.x - cube.face / 2) * cube.artPixel, (drawn.y - o.y - cube.face / 2) * cube.artPixel, 0];
        const world = apply(t, local);
        // Back to the sky's frame: [north, east, up] = [z, −x, −y].
        const through: Vec3 = [world[2], -world[0], -world[1]];
        const n = Math.hypot(...through);
        expect(sameDirection(h, [through[0] / n, through[1] / n, through[2] / n])).toBe(true);
      }
    });
  });

  describe('moving', () => {
    it('a drag takes the sky with the pointer, wraps past north, and holds the tilt between horizon and zenith', () => {
      const perPx = 1 / (cube.focal * RAD);
      expect(dragView(cube, FACE_SOUTH, 100, 0).facing).toBeCloseTo(180 - 100 * perPx, 6);
      expect(dragView(cube, { facing: 2, tilt: 30 }, 4 / perPx, 10 / perPx).facing).toBeCloseTo(358, 6);
      expect(dragView(cube, { facing: 2, tilt: 30 }, 4 / perPx, 10 / perPx).tilt).toBeCloseTo(40, 6);
      expect(dragView(cube, FACE_SOUTH, 0, -50).tilt).toBe(0);
      expect(dragView(cube, { facing: 0, tilt: 80 }, 0, 100 / perPx).tilt).toBe(90);
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
      expect(bringIntoView(cube, view, 30, 170, clear)).toBe(view);
    });

    it('turns round to one behind you, keeping the tilt, and puts it where it can be seen', () => {
      const view = bringIntoView(cube, FACE_SOUTH, 30, 10, clear)!;
      expect(view.tilt).toBe(0);
      const at = viewPoint(cube, view, altAzToVector(30, 10))!;
      expect(clear(at.x, at.y)).toBe(true);
      expect(Math.abs(at.x - cube.centerX)).toBeLessThan(cube.viewWidth / 12); // the middle first
      const beside = bringIntoView(cube, FACE_SOUTH, 30, 10, clearOfPanel)!;
      const p = viewPoint(cube, beside, altAzToVector(30, 10))!;
      expect(clearOfPanel(p.x, p.y)).toBe(true);
    });

    it('tilts up for one too high to see at this tilt, and down for one that\'s sunk behind the hills', () => {
      const up = bringIntoView(cube, FACE_SOUTH, 85, 180, clear)!;
      expect(up.tilt).toBeGreaterThan(0);
      const at = viewPoint(cube, up, altAzToVector(85, 180))!;
      expect(clear(at.x, at.y)).toBe(true);
      const down = bringIntoView(cube, { facing: 180, tilt: 60 }, 20, 180, clear)!;
      expect(down.tilt).toBeLessThan(60);
      const p = viewPoint(cube, down, altAzToVector(20, 180))!;
      expect(clear(p.x, p.y)).toBe(true);
    });

    it('says so (null) if no view shows it, rather than turning to it anyway', () => {
      expect(bringIntoView(cube, FACE_SOUTH, 2, 45, () => false)).toBeNull();
      expect(bringIntoView(cube, FACE_SOUTH, -2, 45, clear)).toBeNull();
    });
  });

  it('altitude and azimuth of a screen point read back sensibly', () => {
    const { alt, az } = altAz(viewDirection(cube, FACE_SOUTH, cube.centerX, cube.horizonY));
    expect(alt).toBeCloseTo(0, 9);
    expect(az).toBeCloseTo(180, 9);
  });
});
