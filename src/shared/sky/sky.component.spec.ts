import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { REDRAW_INTERVAL_MS, SkyComponent, labelPosition } from './sky.component';
import { METEOR_AFTER_MS, METEOR_KEY } from './sky-meteor';
import { TRANSITION_MS } from './sky-transition';
import { TURN_MS } from './sky-free-look';
import { SkyTarget, computeLayout } from './sky-render';
import { SkyToggleComponent } from './sky-toggle.component';
import { CINCINNATI, SkyService, VISITOR_STARS_TOKEN } from './sky.service';
import { VISITOR_STARS } from '../../generated/visitor-stars';
import { altAzToVector, j2000ToHorizontalMatrix, multiply } from './sky-math';
import { FACES, computeCube, cubeTransform, viewPoint } from './sky-cube';
import { FACE_SOUTH, spokenView } from './sky-view';

const files: Record<string, string> = {
  '/data/sky/stars.json': readFileSync('public/data/sky/stars.json', 'utf8'),
  '/data/sky/constellations.json': readFileSync('public/data/sky/constellations.json', 'utf8'),
  '/data/sky/names.json': readFileSync('public/data/sky/names.json', 'utf8'),
  '/data/sky/proper-names.json': readFileSync('public/data/sky/proper-names.json', 'utf8'),
};

/** Stubs the browser pieces happy-dom doesn't have (canvas, image decoding, media queries) and the data fetches. */
function stubBrowser({ fetchFails = false, reducedMotion = false, landBelow = 1, failLooks = [] as string[], extra = {} as Record<string, string> } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (fetchFails) throw new Error('offline');
    const body = extra[url] ?? files[url];
    return new Response(body, { status: body ? 200 : 404 });
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

/** Looks up and waits for free look (loaded on first use) to take over the sky. */
async function lookUp(fixture: { componentInstance: unknown; whenStable: () => Promise<unknown> }, sky: SkyService) {
  sky.enterLookUp();
  await vi.waitFor(() => expect((fixture.componentInstance as { freeOn: boolean }).freeOn).toBe(true), { timeout: 5000 });
  await fixture.whenStable();
}

/** Starts naming a star, once free look has the sky. */
async function startNaming(fixture: { componentInstance: unknown; whenStable: () => Promise<unknown> }, sky: SkyService) {
  await lookUp(fixture, sky);
  sky.startNaming();
  await fixture.whenStable();
}

/** Where the ring is (CSS px), from its transform. */
function ringAt(root: HTMLElement): { x: number; y: number } {
  const ring = root.querySelector('.star-ring') as HTMLElement;
  const [, x, y] = /translate\(([-\d.e]+)px, ([-\d.e]+)px\)/.exec(ring.style.transform) ?? [];
  return { x: parseFloat(x), y: parseFloat(y) };
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
    sessionStorage.clear();
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

  it('a shooting star falls once a visit, a moment after the sky is up, behind the landscape, and never under reduced motion', async () => {
    stubBrowser();
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.meteor')).toBeNull();
    await vi.waitFor(() => expect(el.querySelector('.meteor')).not.toBeNull(), { timeout: METEOR_AFTER_MS + 2000 });
    const star = el.querySelector('.meteor') as HTMLElement;
    expect(sessionStorage.getItem(METEOR_KEY)).toBe('1');
    // In the upper sky, with a path and a length, and it comes before the landscape in the stack.
    expect(parseFloat(star.style.top)).toBeGreaterThan(0);
    expect(star.style.getPropertyValue('--dx')).toMatch(/px$/);
    expect(star.style.getPropertyValue('--length')).toMatch(/px$/);
    expect(star.compareDocumentPosition(el.querySelector('.land')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Gone when its animation ends.
    star.dispatchEvent(new Event('animationend'));
    await fixture.whenStable();
    expect(el.querySelector('.meteor')).toBeNull();

    // The next page this visit: no arrival star.
    fixture.destroy();
    TestBed.resetTestingModule();
    stubBrowser();
    const again = await mount();
    await vi.waitFor(() => expect(again.sky.ready()).toBe(true), { timeout: 5000 });
    await new Promise(resolve => setTimeout(resolve, METEOR_AFTER_MS + 300));
    expect((again.fixture.nativeElement as HTMLElement).querySelector('.meteor')).toBeNull();
  }, 15000);

  it('no shooting star under reduced motion, or in a daylight', async () => {
    sessionStorage.removeItem(METEOR_KEY);
    stubBrowser({ reducedMotion: true });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    await new Promise(resolve => setTimeout(resolve, METEOR_AFTER_MS + 300));
    expect((fixture.nativeElement as HTMLElement).querySelector('.meteor')).toBeNull();
    expect(sessionStorage.getItem(METEOR_KEY)).toBeNull();
    // With stars hidden by the light, a roll makes nothing fall; with them showing, it does.
    const roll = () => (fixture.componentInstance as unknown as { shootingStar: () => void }).shootingStar();
    sky.lighting.set('day');
    roll();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.meteor')).toBeNull();
    sky.lighting.set('darkness');
    roll();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.meteor')).not.toBeNull();
  }, 10000);

  it('never redraws on a timer under reduced motion', async () => {
    const { setIntervalSpy } = stubBrowser({ reducedMotion: true });
    const { sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    expect(setIntervalSpy.mock.calls.some(([, ms]) => ms === REDRAW_INTERVAL_MS)).toBe(false);
  });

  it('the landscape canvas holds what the painting has above the screen, so the treetops come down whole when the ground slides', async () => {
    stubBrowser();
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const layout = computeLayout(window.innerWidth, window.innerHeight);
    const above = Math.ceil(Math.max(0, -layout.imageY));
    const land = (fixture.nativeElement as HTMLElement).querySelector('.land canvas') as HTMLCanvasElement;
    expect(land.height).toBe(layout.height + above);
    expect(land.style.top).toBe(`${-above}px`);
    // (This 1024×768 window crops the painting's sides, not its top, so here that's nothing extra;
    // a 1600×900 one crops 83 px off the top, and gets them back.)
    expect(above).toBe(0);
    const wide = computeLayout(1600, 900);
    expect(Math.ceil(-wide.imageY)).toBeGreaterThanOrEqual(83);
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

  it('a tapped label stays up on touch, though Chrome sends <html> a pointerleave straight after', async () => {
    stubBrowser({ landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const scene = (fixture.componentInstance as unknown as { scene: { targets: SkyTarget[] } }).scene;
    const star = scene.targets.find(t => t.kind === 'star' && t.y < window.innerHeight * 0.5)!;
    const open = document.createElement('div');
    document.body.append(open);
    open.dispatchEvent(new PointerEvent('pointerup', { clientX: star.x, clientY: star.y, pointerType: 'touch', bubbles: true }));
    document.documentElement.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'touch' }));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.sky-label')?.textContent).toContain(star.name);
    // A mouse leaving the window still takes it away.
    document.documentElement.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    await fixture.whenStable();
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

describe('SkyComponent: visitor names and naming', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.inject(SkyService).leaveLookUp();
  });

  it('draws with no visitor names (and offers all 543 unnamed stars)', async () => {
    TestBed.overrideProvider(VISITOR_STARS_TOKEN, { useValue: [] });
    stubBrowser();
    const { sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    expect(sky.visitorNames()).toEqual([]);
    expect(sky.unnamed().length).toBe(543);
  });

  it('offers no stars to name (but still draws) when proper-names.json is missing', async () => {
    stubBrowser({ extra: { '/data/sky/proper-names.json': '' } });
    const { sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    expect(sky.unnamed()).toEqual([]);
  });

  it('reads visitor names from the build (content/stars/), not from a fetch', async () => {
    expect(TestBed.inject(VISITOR_STARS_TOKEN)).toBe(VISITOR_STARS);
    stubBrowser();
    const { sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.some(url => url.includes('visitor'))).toBe(false);
    expect(sky.visitorNames().length).toBe(VISITOR_STARS.length);
  });

  it('loads visitor names: hover targets with their label, and the star is no longer offered', async () => {
    TestBed.overrideProvider(VISITOR_STARS_TOKEN, {
      useValue: [{ ra: 283.626, dec: 36.899, name: 'Gerald', by: 'sam', added: '2026-10', near: null }],
    });
    stubBrowser({ landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    expect(sky.visitorNames().map(v => [v.name, v.near])).toEqual([['Gerald', 'Vega']]);
    expect(sky.unnamed().length).toBe(542);
    const catalog = (fixture.componentInstance as unknown as { catalog: { visitorNames: { name: string; detail: string }[] } }).catalog;
    expect(catalog.visitorNames).toEqual([expect.objectContaining({ name: 'Gerald', detail: 'named by sam, Oct 2026' })]);
  });

  it('while naming: lists what can be picked, selects the brightest, rings it, and a click picks another', async () => {
    stubBrowser({ landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    // A fixed night: at some hours two candidates sit close enough that the click below lands nearer the
    // wrong one, so a run at the wrong time failed.
    const component = fixture.componentInstance as unknown as { pinnedTime: Date | null; draw: () => void };
    component.pinnedTime = new Date('2026-10-28T01:00:00Z');
    component.draw();
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.candidates().length).toBeGreaterThan(1));
    const candidates = sky.candidates();
    // Only above the landscape (here, the top 60% of the window).
    expect(candidates.every(c => c.y < window.innerHeight * 0.6)).toBe(true);
    const brightest = candidates.reduce((a, b) => (b.star.mag < a.star.mag ? b : a));
    expect(sky.selected()).toBe(brightest.star);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.star-ring')).not.toBeNull();
    const ring = ringAt(fixture.nativeElement);
    expect(ring.x).toBeCloseTo(brightest.x, 3);
    expect(ring.y).toBeCloseTo(brightest.y, 3);

    const another = candidates.find(c => c.star !== brightest.star)!;
    const open = document.createElement('div');
    document.body.append(open);
    open.dispatchEvent(new MouseEvent('click', { clientX: another.x + 3, clientY: another.y - 3, bubbles: true }));
    await fixture.whenStable();
    expect(sky.selected()).toBe(another.star);
    open.remove();
  });

  it('a tap picks from further away than a click (touch reach), even when the click has no pointerType', async () => {
    stubBrowser({ landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    // A fixed night, so the stars (and which one is on its own) are the same every run.
    const component = fixture.componentInstance as unknown as { pinnedTime: Date | null; draw: () => void };
    component.pinnedTime = new Date('2026-10-28T01:00:00Z');
    component.draw();
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.candidates().length).toBeGreaterThan(1));
    // A candidate with nothing else within 70px (the tap's 30px off plus a finger's 36px), so the only question is reach.
    const lonely = sky.candidates().find(c => c.star !== sky.selected()
      && sky.candidates().every(o => o === c || Math.hypot(o.x - c.x, o.y - c.y) > 70))!;
    expect(lonely).toBeTruthy();
    const open = document.createElement('div');
    document.body.append(open);
    const tapAt = (type: string) => {
      open.dispatchEvent(new PointerEvent('pointerdown', { pointerType: type, bubbles: true }));
      open.dispatchEvent(new MouseEvent('click', { clientX: lonely.x + 30, clientY: lonely.y, bubbles: true }));
    };
    tapAt('mouse'); // 30px: out of a mouse's reach
    expect(sky.selected()).not.toBe(lonely.star);
    tapAt('touch'); // within a finger's
    expect(sky.selected()).toBe(lonely.star);
    open.remove();
  });

  it('the ring follows the selected star to where it now projects when the sky redraws', async () => {
    stubBrowser({ landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const component = fixture.componentInstance as unknown as { pinnedTime: Date | null; draw: () => void };
    const expected = (date: Date) => {
      const star = sky.selected()!;
      const { lat, lon } = sky.location();
      // Looking up, the sky is free look's camera, facing south to start.
      const h = multiply(j2000ToHorizontalMatrix(date, lat, lon), star.v);
      return viewPoint(computeCube(window.innerWidth, window.innerHeight), FACE_SOUTH, h)!;
    };
    component.pinnedTime = new Date('2026-10-28T01:00:00Z');
    component.draw();
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.selected()).not.toBeNull());
    await fixture.whenStable();
    const before = ringAt(fixture.nativeElement);
    expect(before.x).toBeCloseTo(expected(component.pinnedTime).x, 3);

    // Ten minutes on: the sky has turned, and the ring has gone with its star.
    component.pinnedTime = new Date('2026-10-28T01:10:00Z');
    component.draw();
    await fixture.whenStable();
    const after = ringAt(fixture.nativeElement);
    const there = expected(component.pinnedTime);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(5);
    expect(after.x).toBeCloseTo(there.x, 3);
    expect(after.y).toBeCloseTo(there.y, 3);
  });

  it('keeps the selection while its star is still up and on screen, even under the panel; picks again once it has gone', async () => {
    stubBrowser({ landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const component = fixture.componentInstance as unknown as { pinnedTime: Date | null; draw: () => void };
    component.pinnedTime = new Date('2026-10-28T01:00:00Z');
    component.draw();
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.candidates().length).toBeGreaterThan(2));
    const pick = sky.candidates().find(c => c.star !== sky.selected())!;
    const chosen = pick.star;
    sky.select(chosen);
    // Something now covers it (as the panel or the trees might): it's no longer a candidate, but stays selected.
    const cover = document.createElement('div');
    cover.className = 'look-up-surface';
    const at = { x: pick.x, y: pick.y };
    cover.getBoundingClientRect = () => ({ left: at.x - 30, right: at.x + 30, top: at.y - 30, bottom: at.y + 30, width: 60, height: 60 }) as DOMRect;
    document.body.append(cover);
    component.draw();
    expect(sky.candidates().some(c => c.star === chosen)).toBe(false);
    expect(sky.selected()).toBe(chosen);
    cover.remove();

    // Hours later it has set: then (and only then) the brightest on screen takes over.
    component.pinnedTime = new Date('2026-10-28T13:00:00Z');
    component.draw();
    expect(sky.selected()).not.toBe(chosen);
  });

  it('picks nothing in a light too bright for stars', async () => {
    stubBrowser({ reducedMotion: true });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    sky.setLighting('day');
    await fixture.whenStable();
    await startNaming(fixture, sky);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(sky.candidates()).toEqual([]);
    expect(sky.selected()).toBeNull();
    localStorage.clear();
  });
});

describe('SkyComponent: free look', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    TestBed.inject(SkyService).leaveLookUp();
  });

  interface Internals { freeOn: boolean; pinnedTime: Date | null; draw: () => void }
  const box = (root: HTMLElement) => root.querySelector<HTMLElement>('.free .cube')!;
  const face = (root: HTMLElement) => root.querySelector<HTMLCanvasElement>('.free .face-0')!;
  interface Fixture { nativeElement: HTMLElement; whenStable: () => Promise<unknown> }
  /** Pointer events on the sky (on one of its canvases, so they reach free look's listeners on the host). */
  const fire = (fixture: Fixture, type: string, x: number, y: number) =>
    fixture.nativeElement.querySelector('.overlay')!.dispatchEvent(
      new PointerEvent(type, { pointerId: 7, isPrimary: true, pointerType: 'mouse', button: 0, clientX: x, clientY: y, bubbles: true }));
  /**
   * A press, a move, a release and the click that follows, on the sky. The click lands at `clickAt()`,
   * worked out after the release (once the sky has come to rest), or where the release was.
   */
  async function press(fixture: Fixture, from: { x: number; y: number }, to: { x: number; y: number }, clickAt?: () => { x: number; y: number }) {
    fire(fixture, 'pointerdown', from.x, from.y);
    fire(fixture, 'pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2);
    fire(fixture, 'pointermove', to.x, to.y);
    fire(fixture, 'pointerup', to.x, to.y);
    const at = clickAt?.() ?? to;
    fixture.nativeElement.querySelector('.overlay')!.dispatchEvent(new MouseEvent('click', { clientX: at.x, clientY: at.y, bubbles: true }));
    await fixture.whenStable();
  }

  /** Animation frames and the clock under the test's control (no real waiting). */
  function fakeFrames() {
    let now = 0;
    let id = 0;
    const queue = new Map<number, FrameRequestCallback>();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      queue.set(++id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(handle => void queue.delete(handle));
    return {
      /** Runs frames 16 ms apart for `ms`. */
      advance(ms: number) {
        const end = now + ms;
        while (now < end) {
          now = Math.min(end, now + 16);
          const due = [...queue.values()];
          queue.clear();
          for (const callback of due) callback(now);
        }
      },
    };
  }

  it('looking up draws the whole sky once onto the cube\'s faces, facing south, and the sky canvas keeps only the gradient', async () => {
    const { putImageData } = stubBrowser({ reducedMotion: true });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    expect(fixture.nativeElement.classList).not.toContain('free-look');
    const before = putImageData.mock.calls.length;
    await lookUp(fixture, sky);
    const cube = computeCube(window.innerWidth, window.innerHeight);
    const faces = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLCanvasElement>('.free .face');
    expect(faces.length).toBe(FACES.length);
    for (const canvas of faces) expect([canvas.width, canvas.height]).toEqual([cube.face, cube.face]);
    expect(box(fixture.nativeElement).style.opacity).toBe('1');
    expect(fixture.nativeElement.classList).toContain('free-look');
    // One redraw, a face at a time (the sky canvas, now just the gradient, puts none).
    expect(putImageData.mock.calls.length - before).toBe(FACES.length);
    expect(box(fixture.nativeElement).style.transform).toBe(cubeTransform(cube, FACE_SOUTH));
    expect(fixture.nativeElement.style.getPropertyValue('--ground-shift')).toBe('0px');
  });

  it('a drag only turns the cube: nothing is redrawn, the sky follows the pointer, and the click it ends with picks nothing', async () => {
    const { putImageData } = stubBrowser({ reducedMotion: true, landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    // A fixed night: which stars are where (and so which is clicked) mustn't depend on the hour the tests run.
    (fixture.componentInstance as unknown as Internals).pinnedTime = new Date('2026-10-28T03:00:00Z');
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.candidates().length).toBeGreaterThan(2));
    const selected = sky.selected();
    expect(selected).not.toBeNull();
    const another = sky.candidates().find(c => c.star !== selected)!;
    const draws = putImageData.mock.calls.length;
    const transform = box(fixture.nativeElement).style.transform;
    const cube = computeCube(window.innerWidth, window.innerHeight);
    const perPx = 180 / Math.PI / cube.focal;

    // Drag right by 100px and down by 30: the sky goes with it (turned left, tilted up). The click it
    // ends with lands right on another star, where that star is once the sky has stopped.
    let clickedOn: typeof another | undefined;
    await press(fixture, { x: another.x - 100, y: another.y - 30 }, another, () => {
      clickedOn = sky.candidates().find(c => c.star !== sky.selected())!;
      return clickedOn;
    });
    expect(putImageData.mock.calls.length).toBe(draws);
    expect(box(fixture.nativeElement).style.transform).not.toBe(transform);
    expect(sky.view().facing).toBeCloseTo(180 - 100 * perPx, 6);
    expect(sky.view().tilt).toBeCloseTo(30 * perPx, 6);
    // Tilted up a little, the ground has slid down a little.
    expect(parseFloat(fixture.nativeElement.style.getPropertyValue('--ground-shift'))).toBeCloseTo(cube.focal * Math.tan((30 * perPx * Math.PI) / 180), 1);
    expect(clickedOn).toBeTruthy();
    expect(sky.selected()).not.toBe(clickedOn!.star);
    expect(sky.selected()).toBe(selected);
    // A drag says nothing (only the compass's buttons and a ‹ › turn do).
    expect(sky.viewAnnouncement()).toBe('');
  });

  it('a tap (barely moving) still picks the nearest unnamed star', async () => {
    stubBrowser({ reducedMotion: true, landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    (fixture.componentInstance as unknown as Internals).pinnedTime = new Date('2026-10-28T03:00:00Z');
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.candidates().length).toBeGreaterThan(2));
    const another = sky.candidates().find(c => c.star !== sky.selected())!;
    await press(fixture, { x: another.x + 2, y: another.y - 2 }, { x: another.x + 3, y: another.y - 1 });
    expect(sky.view()).toEqual(FACE_SOUTH);
    expect(sky.selected()).toBe(another.star);
  });

  it('the compass turns the sky, and the ring follows its star round', async () => {
    stubBrowser({ reducedMotion: true, landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const component = fixture.componentInstance as unknown as Internals;
    component.pinnedTime = new Date('2026-10-28T03:00:00Z');
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.candidates().length).toBeGreaterThan(2));
    // A star near the middle, so a small turn keeps it on screen.
    const middle = sky.candidates().reduce((a, b) => (Math.abs(b.x - window.innerWidth / 2) < Math.abs(a.x - window.innerWidth / 2) ? b : a));
    sky.select(middle.star);
    await fixture.whenStable();
    sky.turn(-5);
    await fixture.whenStable();
    expect(sky.view()).toEqual({ facing: 175, tilt: 0 });
    expect(sky.viewRequest()).toBeNull();
    expect(sky.viewAnnouncement()).toBe('facing south, 175°, at the horizon');
    const h = multiply(j2000ToHorizontalMatrix(component.pinnedTime, CINCINNATI.lat, CINCINNATI.lon), middle.star.v);
    const cube = computeCube(window.innerWidth, window.innerHeight);
    const there = viewPoint(cube, sky.view(), h)!;
    expect(there).not.toBeNull();
    // Turned left 5°, the star has moved right by about 5° worth (a little more, off the camera's axis).
    expect(there.x - middle.x).toBeGreaterThan(5 * cube.focal * (Math.PI / 180) * 0.9);
    expect(there.x - middle.x).toBeLessThan(5 * cube.focal * (Math.PI / 180) * 1.5);
    const ring = ringAt(fixture.nativeElement);
    expect(ring.x).toBeCloseTo(there.x, 3);
    expect(ring.y).toBeCloseTo(there.y, 3);
  });

  it('‹ › go round to a star behind you, and the sky turns to bring it into view', async () => {
    stubBrowser({ reducedMotion: true, landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const component = fixture.componentInstance as unknown as Internals;
    component.pinnedTime = new Date('2026-10-28T03:00:00Z');
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.around().length).toBeGreaterThan(100));
    // A star in the north, well up (behind you, facing south), and the one before it round the sky.
    const around = sky.around();
    const i = around.findIndex(s => s.az > 5 && s.alt > 20 && s.alt < 50);
    sky.select(around[i - 1].star);
    sky.step(1);
    await fixture.whenStable();
    expect(sky.selected()).toBe(around[i].star);
    expect(Math.abs(sky.view().facing - around[i].az)).toBeLessThan(60);
    const ring = ringAt(fixture.nativeElement);
    const there = viewPoint(computeCube(window.innerWidth, window.innerHeight), sky.view(), altAzToVector(around[i].alt, around[i].az))!;
    expect(ring.x).toBeCloseTo(there.x, 3);
    expect(ring.y).toBeCloseTo(there.y, 3);
    expect(there.y).toBeLessThan(window.innerHeight * 0.6); // above the landscape
  });

  it('leaving looks south again with the usual crossfade, and lets the cube go; coming back starts south', async () => {
    stubBrowser({ reducedMotion: true });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    await lookUp(fixture, sky);
    sky.turn(90);
    sky.tilt(30);
    await fixture.whenStable();
    expect(sky.view()).toEqual({ facing: 270, tilt: 30 });
    sky.leaveLookUp();
    await fixture.whenStable();
    expect(sky.view()).toEqual(FACE_SOUTH);
    expect((fixture.componentInstance as unknown as Internals).freeOn).toBe(false);
    expect(fixture.nativeElement.classList).not.toContain('free-look');
    expect(face(fixture.nativeElement).width).toBe(0);
    expect(box(fixture.nativeElement).style.opacity).toBe('0');
    expect(fixture.nativeElement.style.getPropertyValue('--ground-shift')).toBe('0px');

    await lookUp(fixture, sky);
    expect(box(fixture.nativeElement).style.transform).toBe(cubeTransform(computeCube(window.innerWidth, window.innerHeight), FACE_SOUTH));
  });

  it('with motion allowed, entering crossfades: the cube fades in as the stars of the normal view go (quicker), and leaving fades it out', async () => {
    stubBrowser();
    const frames = fakeFrames();
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    await lookUp(fixture, sky);
    const cube = box(fixture.nativeElement);
    const canvas = face(fixture.nativeElement);
    expect(cube.style.opacity).toBe('0');
    frames.advance(TRANSITION_MS / 2);
    expect(Number(cube.style.opacity)).toBeGreaterThan(0.3);
    expect(Number(cube.style.opacity)).toBeLessThan(0.7);
    // Half way, the normal view's stars have already gone: its upper canvas is all the way in or out.
    const over = fixture.nativeElement.querySelectorAll('canvas.sky')[1] as HTMLCanvasElement;
    expect(['0', '1']).toContain(over.style.opacity);
    frames.advance(TRANSITION_MS);
    expect(cube.style.opacity).toBe('1');
    sky.leaveLookUp();
    await fixture.whenStable();
    expect(canvas.width).toBeGreaterThan(0);
    frames.advance(TRANSITION_MS / 2);
    expect(cube.style.opacity).toBe('0'); // the cube goes in the first part
    frames.advance(TRANSITION_MS);
    expect(canvas.width).toBe(0);
  });

  it('‹ › turn the sky over a few frames, keep the star they turn to through a redraw mid-turn, then say where they got to', async () => {
    stubBrowser({ landBelow: 0.6 });
    const frames = fakeFrames();
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    const component = fixture.componentInstance as unknown as Internals;
    component.pinnedTime = new Date('2026-10-28T03:00:00Z');
    await startNaming(fixture, sky);
    frames.advance(TRANSITION_MS + 100);
    await vi.waitFor(() => expect(sky.around().length).toBeGreaterThan(100));
    const around = sky.around();
    const i = around.findIndex(s => s.az > 5 && s.alt > 20 && s.alt < 50);
    sky.select(around[i - 1].star);
    sky.step(1);
    await fixture.whenStable();
    const target = around[i].star;
    expect(sky.selected()).toBe(target);
    frames.advance(48);
    // Barely started: still facing about south, the star still behind you.
    expect(sky.view().facing).toBeGreaterThan(120);
    expect(sky.viewAnnouncement()).toBe('');
    // The minute's redraw lands now: the star isn't on screen yet, but it's what the sky is turning to.
    component.draw();
    expect(sky.selected()).toBe(target);
    frames.advance(TURN_MS + 100);
    expect(sky.selected()).toBe(target);
    const there = viewPoint(computeCube(window.innerWidth, window.innerHeight), sky.view(), altAzToVector(around[i].alt, around[i].az))!;
    expect(there).not.toBeNull();
    await fixture.whenStable();
    const ring = ringAt(fixture.nativeElement);
    expect(ring.x).toBeCloseTo(there.x, 3);
    expect(ring.y).toBeCloseTo(there.y, 3);
    expect(sky.viewAnnouncement()).toBe(spokenView(sky.view()));
  });

  it('a minute\'s redraw waits while the sky is being dragged, and happens once it comes to rest', async () => {
    const { putImageData, setIntervalSpy } = stubBrowser({ landBelow: 0.6 });
    const frames = fakeFrames();
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    await lookUp(fixture, sky);
    frames.advance(TRANSITION_MS + 100);
    const tick = setIntervalSpy.mock.calls.find(([, ms]) => ms === REDRAW_INTERVAL_MS)![0] as () => void;
    fire(fixture, 'pointerdown', 300, 100);
    fire(fixture, 'pointermove', 340, 110);
    const before = putImageData.mock.calls.length;
    tick();
    expect(putImageData.mock.calls.length).toBe(before);
    fire(fixture, 'pointermove', 380, 120);
    fire(fixture, 'pointerup', 380, 120);
    frames.advance(3000); // any glide
    expect(putImageData.mock.calls.length).toBe(before + FACES.length); // one redraw: a face at a time
  });

  it('when the naming panel first appears, a star it covers is picked again', async () => {
    stubBrowser({ reducedMotion: true, landBelow: 0.6 });
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.selected()).not.toBeNull());
    const first = sky.selected();
    const at = sky.selectedPoint()!;
    // The panel (loaded on first use) arrives over it.
    const cover = document.createElement('div');
    cover.className = 'look-up-surface';
    cover.getBoundingClientRect = () => ({ left: at.x - 40, right: at.x + 40, top: at.y - 40, bottom: at.y + 40, width: 80, height: 80 }) as DOMRect;
    document.body.append(cover);
    sky.namingPanelShown.update(count => count + 1);
    await fixture.whenStable();
    expect(sky.selected()).not.toBe(first);
    expect(sky.candidates().some(c => c.star === sky.selected())).toBe(true);
    cover.remove();
  });

  it('on a phone, ‹ › never land on a star under the bottom sheet', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844);
    stubBrowser({ reducedMotion: true, landBelow: 0.6 });
    const sheet = document.createElement('div');
    sheet.className = 'look-up-surface';
    sheet.getBoundingClientRect = () => ({ left: 8, right: 382, top: 430, bottom: 836, width: 374, height: 406 }) as DOMRect;
    document.body.append(sheet);
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    (fixture.componentInstance as unknown as Internals).pinnedTime = new Date('2026-10-28T03:00:00Z');
    await startNaming(fixture, sky);
    await vi.waitFor(() => expect(sky.around().length).toBeGreaterThan(100));
    // Some stars that are up can't be shown clear of the sheet (low ones, which tilting only sinks).
    const low = sky.around().filter(s => s.alt < 4);
    expect(low.length).toBeGreaterThan(0);
    // A whole lap and a bit, so every star that's up is reached.
    const seen = new Set<unknown>();
    for (let k = 0; k < sky.around().length + 5; k++) {
      sky.step(1);
      await fixture.whenStable();
      const point = sky.selectedPoint();
      expect(point).not.toBeNull();
      expect(point!.y).toBeLessThan(430);
      seen.add(sky.selected());
    }
    expect(seen.size).toBeGreaterThan(20);
    expect(low.some(s => seen.has(s.star))).toBe(false);
    sheet.remove();
  });

  it('the compass and the drag only come once free look is really on (loaded, with a sky to turn)', async () => {
    stubBrowser({ fetchFails: true });
    const { fixture, sky } = await mount();
    sky.enterLookUp();
    await new Promise(resolve => setTimeout(resolve, 100));
    await fixture.whenStable();
    expect(sky.ready()).toBe(false);
    expect(sky.freeLooking()).toBe(false);
    expect(fixture.nativeElement.classList).not.toContain('free-look');
  });

  it('a turn asked for before free look was on isn\'t carried out once it is', async () => {
    stubBrowser({ reducedMotion: true });
    const { fixture, sky } = await mount();
    sky.enterLookUp();
    sky.turn(90); // too early: no compass yet, but say something asked
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    await vi.waitFor(() => expect((fixture.componentInstance as unknown as Internals).freeOn).toBe(true), { timeout: 5000 });
    expect(sky.viewRequest()).toBeNull();
    sky.turn(45);
    await fixture.whenStable();
    expect(sky.view()).toEqual({ facing: 225, tilt: 0 });
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
