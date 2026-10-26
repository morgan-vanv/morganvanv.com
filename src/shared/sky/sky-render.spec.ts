import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import { computeBodies } from './sky-bodies';
import { CINCINNATI } from './sky.service';
import { Lighting, computeLayout, drawLine, prepareCatalog, renderSky, skyColors, starVisibility } from './sky-render';

const catalog = prepareCatalog(
  JSON.parse(readFileSync('public/data/sky/stars.json', 'utf8')),
  JSON.parse(readFileSync('public/data/sky/constellations.json', 'utf8')),
  JSON.parse(readFileSync('public/data/sky/names.json', 'utf8')),
);
const { lat, lon } = CINCINNATI;

function render(iso: string, withBodies = true, lighting: Lighting = 'real') {
  const layout = computeLayout(1280, 800);
  const buffer = new Uint8ClampedArray(layout.width * layout.height * 4);
  const date = new Date(iso);
  const bodies = withBodies ? computeBodies(Astronomy, date, lat, lon) : null;
  const result = renderSky(buffer, layout, { date, lat, lon, catalog, bodies, lighting });
  const pixel = (x: number, y: number) => Array.from(buffer.slice((y * layout.width + x) * 4, (y * layout.width + x) * 4 + 4));
  return { layout, buffer, result, pixel, bodies };
}

describe('sky render', () => {
  it('lines the horizon up with the painting\'s valley floor', () => {
    const layout = computeLayout(1280, 800);
    expect(layout.width).toBe(1280);
    expect(layout.height).toBe(800);
    // background.webp is drawn at half size, 26.5 px cropped off the top; the valley floor is row 905.
    expect(layout.horizonY).toBeCloseTo(905 * 0.5 - 26.5, 6);
    expect(layout.scale).toBe(320);
    // At device resolution (2× here) everything doubles.
    const retina = computeLayout(1280, 800, 0.5);
    expect(retina.width).toBe(2560);
    expect(retina.horizonY).toBeCloseTo(2 * layout.horizonY, 6);
  });

  it('on portrait screens the zenith reaches the top edge', () => {
    const layout = computeLayout(390, 844);
    expect(layout.horizonY - 2 * layout.scale).toBeCloseTo(0, 6);
  });

  it('puts the valley between the mountains where the painting has it', () => {
    const layout = computeLayout(1280, 800);
    // Half size, no horizontal crop at this aspect: x 1350 → 675 px; y 922 → 461 - 26.5 px.
    expect(layout.valleyX).toBeCloseTo(675, 6);
    expect(layout.valleyY).toBeCloseTo(922 * 0.5 - 26.5, 6);
  });

  it('darkness is the default: stars out at noon, night colours, no Sun', () => {
    const layout = computeLayout(1280, 800);
    const buffer = new Uint8ClampedArray(layout.width * layout.height * 4);
    const date = new Date('2026-06-21T17:30:00Z');
    const result = renderSky(buffer, layout, { date, lat, lon, catalog, bodies: computeBodies(Astronomy, date, lat, lon) });
    expect(result.sunAlt).toBeLessThan(-18);
    expect(result.starsDrawn).toBeGreaterThan(100);
    const [r, g, b] = Array.from(buffer.slice(0, 3));
    expect(r + g + b).toBeLessThan(120);
  });

  it('sunrise and sunset put the Sun in the valley, glowing, whatever the real time', () => {
    for (const lighting of ['sunrise', 'sunset'] as const) {
      const { layout, pixel, result } = render('2026-10-26T05:00:00Z', true, lighting);
      const [r, g, b] = pixel(Math.round(layout.valleyX), Math.round(layout.valleyY) - 1);
      expect(r + g + b, lighting).toBeGreaterThan(650);
      // The glow is warm on the horizon right above the valley, and stronger there than far to the side.
      const above = pixel(Math.round(layout.valleyX), Math.round(layout.horizonY) - 8);
      const far = pixel(Math.round(layout.valleyX) > layout.width / 2 ? 2 : layout.width - 3, Math.round(layout.horizonY) - 8);
      expect(above[0], lighting).toBeGreaterThan(above[2]);
      expect(above[0], lighting).toBeGreaterThan(far[0]);
      expect(result.starsDrawn, lighting).toBeGreaterThan(0);
    }
  });

  it('can leave the Sun to the caller, and still says where it is', () => {
    const layout = computeLayout(1280, 800);
    const buffer = new Uint8ClampedArray(layout.width * layout.height * 4);
    const date = new Date('2026-10-26T05:00:00Z');
    const result = renderSky(buffer, layout, { date, lat, lon, catalog, bodies: null, lighting: 'sunset', drawSun: false });
    const [x, y] = [Math.round(layout.valleyX), Math.round(layout.valleyY) - 1];
    const [r, g, b] = Array.from(buffer.slice((y * layout.width + x) * 4, (y * layout.width + x) * 4 + 3));
    expect(r + g + b).toBeLessThan(650);
    expect(result.sun?.x).toBeCloseTo(layout.valleyX, 6);
    expect(result.targets.some(t => t.kind === 'sun')).toBe(true);
    expect(result.glows.every(g => g.radius !== result.sun!.radius * 6)).toBe(true);
    // Darkness has no Sun at all.
    expect(renderSky(buffer, layout, { date, lat, lon, catalog, bodies: null, lighting: 'darkness' }).sun).toBeNull();
  });

  it('day is blue with no stars at midnight', () => {
    const { result, pixel } = render('2026-10-26T05:00:00Z', true, 'day');
    expect(result.starsDrawn).toBe(0);
    const [r, , b] = pixel(10, 10);
    expect(b).toBeGreaterThan(r + 80);
  });

  it('real time at noon is a blue sky with no stars', () => {
    const { result, pixel } = render('2026-06-21T17:30:00Z');
    expect(result.sunAlt).toBeGreaterThan(70);
    expect(result.starsDrawn).toBe(0);
    const [r, g, b] = pixel(10, 10);
    expect(b).toBeGreaterThan(150);
    expect(b).toBeGreaterThan(r + 80);
    expect(g).toBeGreaterThan(r);
  });

  it('midnight has plenty of stars, and the night sky matches the painting', () => {
    const { result } = render('2026-10-26T05:00:00Z');
    expect(result.starsDrawn).toBeGreaterThan(100);
    expect(skyColors(-30).top).toEqual([1, 32, 49]);
    expect(starVisibility(-30)).toBe(1);
    expect(starVisibility(0)).toBe(0);
  });

  it('draws the Moon where it is: bright pixels at its projected position', () => {
    const { layout, pixel, bodies } = render('2026-10-26T03:00:00Z');
    const moon = bodies!.moon;
    // Project the same way the renderer does.
    const d = 1 - moon.h[0];
    const x = Math.round(layout.centerX + ((-2 * moon.h[1]) / d) * layout.scale);
    const y = Math.round(layout.horizonY - ((2 * moon.h[2]) / d) * layout.scale);
    const [r, g, b] = pixel(x, y);
    expect(r + g + b).toBeGreaterThan(600);
  });

  it('lights the side of the Moon that faces the Sun', () => {
    // Waxing crescent in the evening: the Sun has set in the west-southwest, so the
    // lit side faces right (west) and down.
    const evening = render('2026-11-14T00:00:00Z').result.moon!;
    expect(evening.litCount).toBeGreaterThan(0);
    expect(evening.litDx).toBeGreaterThan(0);
    expect(evening.litDy).toBeGreaterThan(0);
    // Waning crescent before sunrise: the Sun is below the eastern horizon, so the lit side faces left (east).
    const morning = render('2026-11-06T11:00:00Z');
    expect(morning.bodies!.moon.phaseAngle).toBeGreaterThan(110);
    expect(morning.result.moon!.litDx).toBeLessThan(0);
  });

  it('a hair-thin crescent still shows its sunward limb', () => {
    // 3.5 % lit, low in the east before sunrise.
    const { result, bodies } = render('2026-11-07T11:30:00Z');
    expect(bodies!.moon.illuminated).toBeLessThan(0.05);
    expect(bodies!.moon.illuminated).toBeGreaterThan(0.02);
    expect(result.moon!.litCount).toBeGreaterThan(0);
    expect(result.moon!.litDx).toBeLessThan(0);
  });

  it('still renders stars and the right sky colour without astronomy-engine', () => {
    const { result } = render('2026-10-26T05:00:00Z', false);
    expect(result.sunAlt).toBeLessThan(-40);
    expect(result.starsDrawn).toBeGreaterThan(100);
  });

  it('reports what can be hovered: named stars, planets and the Moon, plus figure lines', () => {
    const { result } = render('2026-01-15T04:00:00Z');
    const names = result.targets.map(t => t.name);
    expect(names).toContain('Betelgeuse');
    expect(names).toContain('Sirius');
    expect(result.targets.find(t => t.name === 'Betelgeuse')?.constellation).toBe('Ori');
    expect(result.segments.some(s => s.figure === 'Ori')).toBe(true);
    // Nothing to point at in a starless daytime sky but the Sun.
    const day = render('2026-01-15T04:00:00Z', true, 'day').result;
    expect(day.targets.some(t => t.kind === 'sun')).toBe(true);
    expect(day.targets.every(t => t.kind === 'sun' || t.kind === 'moon' || t.kind === 'planet')).toBe(true);
  });

  it('can leave the gradient to the caller: a transparent layer that lands on the same picture', () => {
    const layout = computeLayout(640, 400);
    const date = new Date('2026-10-26T03:00:00Z');
    const bodies = computeBodies(Astronomy, date, lat, lon);
    const opaque = new Uint8ClampedArray(layout.width * layout.height * 4);
    renderSky(opaque, layout, { date, lat, lon, catalog, bodies, lighting: 'darkness' });
    const layer = new Uint8ClampedArray(opaque.length);
    const { background } = renderSky(layer, layout, { date, lat, lon, catalog, bodies, lighting: 'darkness', paintBackground: false });
    expect(background.top).toEqual(skyColors(-30).top);
    let transparent = 0;
    let worst = 0;
    for (let i = 0; i < layer.length; i += 4) {
      if (layer[i + 3] === 0) {
        transparent++;
        continue;
      }
      // Lay the layer over the opaque render's own background colour there and compare.
      const a = layer[i + 3] / 255;
      const y = Math.floor(i / 4 / layout.width);
      const t = Math.min(1, y / layout.horizonY) ** 2;
      for (let c = 0; c < 3; c++) {
        const under = background.top[c] + (background.horizon[c] - background.top[c]) * t;
        worst = Math.max(worst, Math.abs(layer[i + c] * a + under * (1 - a) - opaque[i + c]));
      }
    }
    expect(transparent).toBeGreaterThan(layer.length / 4 * 0.9);
    expect(worst).toBeLessThan(3);
  });

  it('gives bright things a glow to draw', () => {
    const { result } = render('2026-10-26T03:00:00Z');
    // The full Moon, Saturn and the brightest stars.
    expect(result.glows.length).toBeGreaterThan(3);
    expect(result.glows.every(g => g.radius > 0 && g.strength > 0 && g.strength <= 1)).toBe(true);
  });

  it('drawLine is antialiased: two pixels share each step, coverage adding up to one', () => {
    const cover = new Map<string, number>();
    drawLine(0, 0, 10, 3.5, (x, y, c) => cover.set(`${x},${y}`, (cover.get(`${x},${y}`) ?? 0) + c));
    for (let x = 0; x <= 10; x++) {
      const column = [...cover].filter(([k]) => k.startsWith(`${x},`)).reduce((sum, [, c]) => sum + c, 0);
      expect(column).toBeCloseTo(1, 6);
    }
    expect(cover.get('0,0')).toBeCloseTo(1, 6);
  });

});
