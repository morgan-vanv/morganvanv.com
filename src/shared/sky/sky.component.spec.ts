import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { REDRAW_INTERVAL_MS, SkyComponent, labelPosition } from './sky.component';
import { TRANSITION_MS } from './sky-transition';
import { SkyTarget } from './sky-render';
import { SkyToggleComponent } from './sky-toggle.component';
import { SkyService } from './sky.service';

const files: Record<string, string> = {
  '/data/sky/stars.json': readFileSync('public/data/sky/stars.json', 'utf8'),
  '/data/sky/constellations.json': readFileSync('public/data/sky/constellations.json', 'utf8'),
  '/data/sky/names.json': readFileSync('public/data/sky/names.json', 'utf8'),
};

/** Stubs the browser pieces happy-dom doesn't have (canvas, image decoding, media queries) and the data fetches. */
function stubBrowser({ fetchFails = false, reducedMotion = false, landBelow = 1, failLooks = [] as string[] } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (fetchFails) throw new Error('offline');
    return new Response(files[url], { status: files[url] ? 200 : 404 });
  }));
  const decode = vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (this: HTMLImageElement) {
    return failLooks.some(look => this.src.includes(`/landscape/${look}.webp`)) ? Promise.reject(new Error('404')) : Promise.resolve();
  });
  const putImageData = vi.fn();
  const drawImage = vi.fn();
  // A 2D context that records the calls we care about and accepts everything else.
  const context = new Proxy({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    // The landscape covers the bottom (1 - landBelow) of the screen.
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = Math.floor(h * landBelow); y < h; y++) for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = 255;
      return { data, width: w, height: h };
    },
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    putImageData,
    drawImage,
  } as Record<string, unknown>, {
    get: (target, key: string) => (key in target ? target[key] : vi.fn()),
    set: () => true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: reducedMotion && query.includes('reduce') }) as MediaQueryList);
  const setIntervalSpy = vi.spyOn(window, 'setInterval');
  const geolocation = vi.fn();
  vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({ getCurrentPosition: geolocation } as unknown as Geolocation);
  return { putImageData, setIntervalSpy, geolocation, drawImage, decode };
}

async function mount() {
  const fixture = TestBed.createComponent(SkyComponent);
  await fixture.whenStable();
  return { fixture, sky: TestBed.inject(SkyService) };
}

describe('SkyComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty('--daylight');
  });

  it('draws the sky and the landscape, and redraws once a minute', async () => {
    const { putImageData, setIntervalSpy, geolocation, drawImage } = stubBrowser();
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    expect(putImageData).toHaveBeenCalled();
    // The night landscape is rasterised from its image.
    expect(drawImage.mock.calls.some(([image]) => (image as HTMLImageElement).src?.endsWith('/landscape/darkness.webp'))).toBe(true);
    expect(setIntervalSpy.mock.calls.some(([, ms]) => ms === REDRAW_INTERVAL_MS)).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--daylight')).not.toBe('');
    expect(geolocation).not.toHaveBeenCalled();
    fixture.destroy();
    expect(document.documentElement.style.getPropertyValue('--daylight')).toBe('');
  });

  it('never redraws on a timer under reduced motion', async () => {
    const { setIntervalSpy } = stubBrowser({ reducedMotion: true });
    const { sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    expect(setIntervalSpy.mock.calls.some(([, ms]) => ms === REDRAW_INTERVAL_MS)).toBe(false);
  });

  it('names what the pointer is over, but not through the landscape', async () => {
    stubBrowser({ landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const scene = (fixture.componentInstance as unknown as { scene: { targets: SkyTarget[] } }).scene;
    const height = window.innerHeight;
    const star = scene.targets.find(t => t.kind === 'star' && t.y < height * 0.5);
    expect(star).toBeTruthy();
    const open = document.createElement('div');
    document.body.append(open);
    const move = async (x: number, y: number) => {
      open.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse', bubbles: true }));
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
      await fixture.whenStable();
    };
    await move(star!.x, star!.y); // devicePixelRatio is 1 here, so buffer pixels are CSS pixels
    expect(fixture.nativeElement.querySelector('.sky-label')?.textContent).toContain(star!.name);
    // Low on the screen is landscape here: nothing to name.
    await move(30, window.innerHeight - 10);
    expect(fixture.nativeElement.querySelector('.sky-label')).toBeNull();
    open.remove();
  });

  it('draws at device resolution on a 2x screen, and still names stars at CSS positions', async () => {
    stubBrowser({ landBelow: 0.6 });
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('canvas');
    expect(canvas.width).toBe(Math.ceil(window.innerWidth * 2));
    expect(parseFloat(canvas.style.width)).toBeCloseTo(Math.ceil(window.innerWidth * 2) / 2, 3);
    const scene = (fixture.componentInstance as unknown as { scene: { targets: SkyTarget[] } }).scene;
    const star = scene.targets.find(t => t.kind === 'star' && t.y < window.innerHeight);
    expect(star).toBeTruthy();
    const open = document.createElement('div');
    document.body.append(open);
    open.dispatchEvent(new PointerEvent('pointermove', { clientX: star!.x / 2, clientY: star!.y / 2, pointerType: 'mouse', bubbles: true }));
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.sky-label')?.textContent).toContain(star!.name);
    open.remove();
  });

  it('a look that fails to load is asked for once, and the night look stands in', async () => {
    const { decode, putImageData } = stubBrowser({ failLooks: ['sunset'] });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    sky.setLighting('sunset');
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve, 20));
    const draw = (fixture.componentInstance as unknown as { draw: () => void }).draw.bind(fixture.componentInstance);
    for (let i = 0; i < 5; i++) draw();
    const sunsetLoads = decode.mock.contexts.filter(img => (img as HTMLImageElement).src.includes('/landscape/sunset.webp'));
    expect(sunsetLoads.length).toBe(1);
    expect(putImageData.mock.calls.length).toBeGreaterThan(5);
    localStorage.clear();
  });

  it('eases into a new light: crossfades to it, moves the Sun, then settles on one set of layers', async () => {
    stubBrowser();
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => frames.push(cb));
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    // Runs everything waiting for the next frame (Angular may be among it), at time `at`.
    const frame = (at: number) => frames.splice(0).forEach(cb => cb(at));
    const host: HTMLElement = fixture.nativeElement;
    const [sky0, sky1] = Array.from(host.querySelectorAll<HTMLCanvasElement>('canvas.sky')).slice(0, 2);
    const [land0, land1] = Array.from(host.querySelectorAll<HTMLCanvasElement>('.land canvas'));
    const sun = host.querySelector<HTMLElement>('.sun')!;
    expect(sun.style.display).toBe('none'); // darkness: no Sun

    sky.setLighting('sunset');
    await fixture.whenStable();
    await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0));
    // The new light is drawn on the hidden pair, which fades in over the old.
    expect(sky1.style.opacity).toBe('0');
    frame(1000 + TRANSITION_MS * 0.4);
    const p = Number(sky1.style.opacity);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.5);
    // The landscapes are added, weighted to sum to one (their soft edges keep their coverage).
    expect(Number(land1.style.opacity)).toBeCloseTo(p, 6);
    expect(Number(land0.style.opacity)).toBeCloseTo(1 - p, 6);
    expect(sun.style.display).toBe('block');
    const rising = sun.style.transform;
    frame(1000 + TRANSITION_MS * 0.75);
    expect(sun.style.transform).not.toBe(rising);
    frame(1000 + TRANSITION_MS);
    expect(sky1.style.opacity).toBe('');
    expect(sky0.style.opacity).toBe('0');
    expect(sky0.width).toBe(0); // its memory given back
    expect(host.style.getPropertyValue('--night-light')).toBe('0.800');
    frame(1000 + TRANSITION_MS * 2);
    expect(frames.length).toBe(0); // and the loop stops

    // Changed again part way: it carries on from what's on screen, and still ends on one pair.
    sky.setLighting('day');
    await fixture.whenStable();
    await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0));
    frame(1000 + TRANSITION_MS * 0.3);
    const [lightBefore, sunBefore] = [host.style.getPropertyValue('--night-light'), sun.style.transform];
    sky.setLighting('darkness');
    await fixture.whenStable();
    await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0));
    // Nothing jumps: the new change starts from exactly what was on screen.
    expect(host.style.getPropertyValue('--night-light')).toBe(lightBefore);
    expect(sun.style.transform).toBe(sunBefore);
    for (let i = 0; i < 5 && frames.length; i++) frame(1000 + TRANSITION_MS);
    const shown = [sky0, sky1].filter(c => c.width > 0);
    expect(shown.length).toBe(1);
    expect(shown[0].style.opacity).toBe('');
    expect(sun.style.display).toBe('none');
    expect(host.classList).toContain('night-lit');
    localStorage.clear();
  });

  it('has no Sun in real time at night, and puts the small lights out by day', async () => {
    stubBrowser({ reducedMotion: true });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const host: HTMLElement = fixture.nativeElement;
    sky.setLighting('real'); // the default test date is whenever the test runs, so pin it:
    (fixture.componentInstance as unknown as { pinnedTime: Date }).pinnedTime = new Date('2026-10-26T05:00:00Z');
    (fixture.componentInstance as unknown as { draw: () => void }).draw();
    expect(host.querySelector<HTMLElement>('.sun')!.style.display).toBe('none');
    expect(host.classList).toContain('night-lit');
    sky.setLighting('day');
    await fixture.whenStable();
    expect(host.classList).not.toContain('night-lit');
    localStorage.clear();
  });

  it('changes the light at once under reduced motion', async () => {
    stubBrowser({ reducedMotion: true });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    sky.setLighting('day');
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve, 20));
    // Nothing fading: one pair on screen, the other put away.
    const skies = Array.from<HTMLCanvasElement>(fixture.nativeElement.querySelectorAll('canvas.sky')).slice(0, 2);
    expect(skies.map(c => c.style.opacity).sort()).toEqual(['', '0']);
    expect(fixture.nativeElement.querySelector('.sun').style.display).toBe('block');
    expect(document.documentElement.style.getPropertyValue('--daylight')).toBe('1');
    localStorage.clear();
  });

  it('removes its listeners when destroyed', async () => {
    stubBrowser();
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const removed = vi.spyOn(document, 'removeEventListener');
    fixture.destroy();
    const types = removed.mock.calls.map(([type]) => type);
    expect(types).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'visibilitychange']));
  });

  it('leaves the painted sky alone when the data can\'t load', async () => {
    const { putImageData } = stubBrowser({ fetchFails: true });
    const { fixture, sky } = await mount();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(sky.ready()).toBe(false);
    expect(putImageData).not.toHaveBeenCalled();
    expect(fixture.nativeElement.classList).not.toContain('ready');
  });
});

describe('labelPosition', () => {
  it('sits below-right of the pointer, and flips away from a page card', () => {
    expect(labelPosition('Vega · Lyra', 100, 100, [])).toEqual({ x: 114, y: 112 });
    const card = { left: 150, right: 900, top: 0, bottom: 700 } as DOMRect;
    const flipped = labelPosition('Vega · Lyra', 140, 100, [card]);
    expect(flipped.x + 'Vega · Lyra'.length * 7.5 + 22).toBeLessThanOrEqual(150);
  });
});

describe('SkyToggleComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('holds its place invisibly until the sky is ready, then offers one button', async () => {
    const fixture = TestBed.createComponent(SkyToggleComponent);
    const sky = TestBed.inject(SkyService);
    await fixture.whenStable();
    const text = () => fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
    expect(fixture.nativeElement.querySelector('.sky-toggle').classList).toContain('waiting');

    sky.ready.set(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.sky-toggle').classList).not.toContain('waiting');
    expect(text()).toContain('the sky over Cincinnati, live');
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(1);
  });

  it('keeps the same button through locating and back, so focus survives', async () => {
    let answer: PositionCallback = () => undefined;
    vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({
      getCurrentPosition: vi.fn((success: PositionCallback) => (answer = success)),
    } as unknown as Geolocation);
    const fixture = TestBed.createComponent(SkyToggleComponent);
    TestBed.inject(SkyService).ready.set(true);
    await fixture.whenStable();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    const status = () => fixture.nativeElement.querySelector('[role="status"]').textContent.trim();

    button.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBe(button);
    expect(button.textContent.trim()).toBe('cancel');
    expect(status()).toBe('finding your sky…');

    answer({ coords: { latitude: 51.5, longitude: -0.12 } } as GeolocationPosition);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBe(button);
    expect(button.textContent.trim()).toBe('back to Cincinnati');
    expect(status()).toBe('');
    localStorage.clear();
  });
});
