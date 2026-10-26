import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import { computeBodies } from './sky-bodies';
import { CINCINNATI } from './sky.service';
import { computeLayout, drawLine, prepareCatalog, renderSky, skyColors, starVisibility } from './sky-render';

const catalog = prepareCatalog(
  JSON.parse(readFileSync('public/data/sky/stars.json', 'utf8')),
  JSON.parse(readFileSync('public/data/sky/constellations.json', 'utf8')),
);
const { lat, lon } = CINCINNATI;

function render(iso: string, withBodies = true) {
  const layout = computeLayout(1280, 800);
  const buffer = new Uint8ClampedArray(layout.width * layout.height * 4);
  const date = new Date(iso);
  const bodies = withBodies ? computeBodies(Astronomy, date, lat, lon) : null;
  const result = renderSky(buffer, layout, { date, lat, lon, catalog, bodies });
  const pixel = (x: number, y: number) => Array.from(buffer.slice((y * layout.width + x) * 4, (y * layout.width + x) * 4 + 4));
  return { layout, buffer, result, pixel, bodies };
}

describe('sky render', () => {
  it('lines the horizon up with the painting\'s valley floor', () => {
    const layout = computeLayout(1280, 800);
    expect(layout.width).toBe(427);
    expect(layout.height).toBe(267);
    // background.webp is drawn at half size, 26.5 px cropped off the top; the valley floor is row 905.
    expect(layout.horizonY * 3).toBeCloseTo(905 * 0.5 - 26.5, 6);
    expect(layout.scale * 3).toBe(320);
  });

  it('on portrait screens the zenith reaches the top edge', () => {
    const layout = computeLayout(390, 844);
    expect(layout.horizonY - 2 * layout.scale).toBeCloseTo(0, 6);
  });

  it('noon is a blue sky with no stars', () => {
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

  it('still renders stars and the right sky colour without astronomy-engine', () => {
    const { result } = render('2026-10-26T05:00:00Z', false);
    expect(result.sunAlt).toBeLessThan(-40);
    expect(result.starsDrawn).toBeGreaterThan(100);
  });

  it('drawLine steps one pixel at a time and includes both ends', () => {
    const points: [number, number][] = [];
    drawLine(0, 0, 5, 2, (x, y) => points.push([x, y]));
    expect(points[0]).toEqual([0, 0]);
    expect(points.at(-1)).toEqual([5, 2]);
    expect(points.length).toBe(6);
    for (let i = 1; i < points.length; i++) {
      expect(Math.abs(points[i][0] - points[i - 1][0])).toBeLessThanOrEqual(1);
      expect(Math.abs(points[i][1] - points[i - 1][1])).toBeLessThanOrEqual(1);
    }
  });
});
