import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { REDRAW_INTERVAL_MS, SkyComponent } from './sky.component';
import { SkyToggleComponent } from './sky-toggle.component';
import { SkyService } from './sky.service';

const files: Record<string, string> = {
  '/data/sky/stars.json': readFileSync('public/data/sky/stars.json', 'utf8'),
  '/data/sky/constellations.json': readFileSync('public/data/sky/constellations.json', 'utf8'),
};

/** Stubs the browser pieces happy-dom doesn't have (canvas, image decoding, media queries) and the data fetches. */
function stubBrowser({ fetchFails = false, reducedMotion = false } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (fetchFails) throw new Error('offline');
    return new Response(files[url], { status: files[url] ? 200 : 404 });
  }));
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue(undefined);
  const putImageData = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: reducedMotion && query.includes('reduce') }) as MediaQueryList);
  const setIntervalSpy = vi.spyOn(window, 'setInterval');
  const geolocation = vi.fn();
  vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({ getCurrentPosition: geolocation } as unknown as Geolocation);
  return { putImageData, setIntervalSpy, geolocation };
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

  it('draws, shows the foreground, and redraws once a minute', async () => {
    const { putImageData, setIntervalSpy, geolocation } = stubBrowser();
    const { fixture, sky } = await mount();
    await vi.waitFor(() => expect(sky.ready()).toBe(true), { timeout: 5000 });
    expect(putImageData).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.foreground img')).not.toBeNull();
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

  it('leaves the painted sky alone when the data can\'t load', async () => {
    const { putImageData } = stubBrowser({ fetchFails: true });
    const { fixture, sky } = await mount();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(sky.ready()).toBe(false);
    expect(putImageData).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.foreground img')).toBeNull();
    expect(fixture.nativeElement.classList).not.toContain('ready');
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
