import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DRAG_RADIANS_PER_PX, Ps1StageComponent } from './ps1-stage.component';
import { PS1_MODELS } from './ps1-models';
import { PS1_FPS, PS1_TURN_SPEED, renderPs1 } from './ps1-render';

const FRAME_MS = 1000 / PS1_FPS;

/** Stubs what happy-dom lacks (a 2D canvas, media queries, IntersectionObserver), recording every frame drawn. */
function stubBrowser({ reducedMotion = false } = {}) {
  const frames: Uint8ClampedArray[] = [];
  const context = {
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
    putImageData: vi.fn((image: ImageData) => frames.push(image.data.slice())),
  };
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  // A media query whose answer can change while the page is open, as when a visitor turns on Reduce Motion.
  const motionListeners = new Set<(event: MediaQueryListEvent) => void>();
  let reduce = reducedMotion;
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    get matches() { return reduce && query.includes('reduce'); },
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => motionListeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => motionListeners.delete(listener),
  }) as unknown as MediaQueryList);
  const setReducedMotion = (value: boolean) => {
    reduce = value;
    for (const listener of [...motionListeners]) listener({ matches: value } as MediaQueryListEvent);
  };
  const observers: { callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal('IntersectionObserver', class {
    disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) {
      observers.push({ callback, disconnect: this.disconnect });
    }
    observe(): void { /* the test says when it's on screen */ }
  });
  const setIntervalSpy = vi.spyOn(window, 'setInterval');
  const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
  const onScreen = (isIntersecting: boolean) =>
    observers.at(-1)!.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  return { frames, getContext, observers, onScreen, setIntervalSpy, clearIntervalSpy, setReducedMotion, motionListeners };
}

const frameTimers = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.filter(call => call[1] === FRAME_MS).length;

describe('Ps1StageComponent', () => {
  let fixture: ComponentFixture<Ps1StageComponent>;
  const canvas = () => (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
  const expected = (key: keyof typeof PS1_MODELS, turn: number, time = 0) => renderPs1(PS1_MODELS[key], { turn, time }, 110, 84).data;

  async function mount(model: keyof typeof PS1_MODELS = 'hoss', name = 'BIG HOSS', providers: unknown[] = []) {
    TestBed.configureTestingModule({ imports: [Ps1StageComponent], providers: providers as never[] });
    fixture = TestBed.createComponent(Ps1StageComponent);
    fixture.componentRef.setInput('model', model);
    fixture.componentRef.setInput('name', name);
    await fixture.whenStable();
  }

  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));

  // Spies first: the interval spies wrap the fake timers, so restoring them after the real timers came back would put the fakes back.
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('is an image named for the machine, at a fixed size, with no text over it', async () => {
    stubBrowser();
    await mount();
    expect(canvas().getAttribute('role')).toBe('img');
    expect(canvas().getAttribute('aria-label')).toBe('BIG HOSS, a low-poly model turning slowly');
    expect([canvas().width, canvas().height]).toEqual([110, 84]);
    expect(canvas().hasAttribute('tabindex')).toBe(false);
    // Morgan, 2026-11-05: cleaner without a hint; the grab cursor says it can be dragged.
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });

  it('draws the first frame after render, then turns at 15 frames a second', async () => {
    const { frames, setIntervalSpy } = stubBrowser();
    await mount();
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toEqual(expected('hoss', 0));
    expect(frameTimers(setIntervalSpy)).toBe(1);
    const before = frames.length;
    vi.advanceTimersByTime(1000);
    expect(frames.length - before).toBe(PS1_FPS);
    expect(frames.at(-1)).not.toEqual(expected('hoss', 0));
  });

  it('draws nothing on the server', async () => {
    const { frames, getContext, setIntervalSpy } = stubBrowser();
    await mount('hoss', 'BIG HOSS', [{ provide: PLATFORM_ID, useValue: 'server' }]);
    expect(getContext).not.toHaveBeenCalled();
    expect(frames).toEqual([]);
    expect(frameTimers(setIntervalSpy)).toBe(0);
    // The stage and its canvas are still there, at their size and with their name.
    expect([canvas().width, canvas().height]).toEqual([110, 84]);
    expect(canvas().getAttribute('aria-label')).toBe('BIG HOSS, a low-poly model turning slowly');
  });

  it('under reduced motion, is one still three-quarter frame with no timer', async () => {
    const { frames, setIntervalSpy } = stubBrowser({ reducedMotion: true });
    await mount('nas', 'FalkenburghNAS');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(frame => frame.every((v, i) => v === frames[0][i]))).toBe(true);
    expect(frames[0]).toEqual(expected('nas', 0));
    expect(frameTimers(setIntervalSpy)).toBe(0);
    expect(canvas().getAttribute('aria-label')).toBe('FalkenburghNAS, a low-poly model');
  });

  it('follows Reduce Motion switched on or off while the page is open', async () => {
    const { frames, clearIntervalSpy, setIntervalSpy, setReducedMotion, motionListeners } = stubBrowser();
    await mount();
    expect(frameTimers(setIntervalSpy)).toBe(1);

    setReducedMotion(true);
    await fixture.whenStable();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(canvas().getAttribute('aria-label')).toBe('BIG HOSS, a low-poly model');
    const before = frames.length;
    vi.advanceTimersByTime(1000);
    expect(frames.length).toBe(before);

    setReducedMotion(false);
    await fixture.whenStable();
    expect(frameTimers(setIntervalSpy)).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(frames.length).toBeGreaterThan(before);

    fixture.destroy();
    expect(motionListeners.size).toBe(0);
  });

  it('only turns while on screen and while the tab is visible', async () => {
    const { frames, onScreen, clearIntervalSpy, setIntervalSpy } = stubBrowser();
    await mount();
    onScreen(false);
    expect(clearIntervalSpy).toHaveBeenCalled();
    let before = frames.length;
    vi.advanceTimersByTime(1000);
    expect(frames.length).toBe(before);

    onScreen(true);
    expect(frameTimers(setIntervalSpy)).toBe(2);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    before = frames.length;
    vi.advanceTimersByTime(1000);
    expect(frames.length).toBe(before);

    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(1000);
    expect(frames.length).toBe(before + PS1_FPS);
  });

  it('stops on destroy', async () => {
    const { frames, observers, clearIntervalSpy } = stubBrowser();
    await mount();
    fixture.destroy();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(observers[0].disconnect).toHaveBeenCalled();
    const before = frames.length;
    vi.advanceTimersByTime(1000);
    expect(frames.length).toBe(before);
  });

  it('swaps the model when the machine changes, starting its turn again', async () => {
    const { frames } = stubBrowser();
    await mount();
    vi.advanceTimersByTime(1000);
    fixture.componentRef.setInput('model', 'nas');
    fixture.componentRef.setInput('name', 'FalkenburghNAS');
    await fixture.whenStable();
    expect(frames.at(-1)).toEqual(expected('nas', 0, 1));
    expect(canvas().getAttribute('aria-label')).toBe('FalkenburghNAS, a low-poly model turning slowly');
  });

  it('spins with a drag, then eases back into its slow turn', async () => {
    const { frames } = stubBrowser();
    await mount('ups', 'UPS');
    const pointer = (type: string, clientX: number, timeStamp: number) => {
      const event = new PointerEvent(type, { pointerId: 1, button: 0, clientX, bubbles: true });
      Object.defineProperty(event, 'timeStamp', { value: timeStamp });
      canvas().dispatchEvent(event);
    };
    pointer('pointerdown', 100, 0);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).classList).toContain('dragging');
    pointer('pointermove', 140, 50);
    expect(frames.at(-1)).toEqual(expected('ups', -40 * DRAG_RADIANS_PER_PX));
    // While held, the timer doesn't turn it.
    vi.advanceTimersByTime(FRAME_MS);
    expect(frames.at(-1)).toEqual(expected('ups', -40 * DRAG_RADIANS_PER_PX, 1 / PS1_FPS));
    // Let go after holding still: it picks up its slow turn again, getting faster each frame.
    pointer('pointerup', 140, 400);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).classList).not.toContain('dragging');
    const component = fixture.componentInstance as unknown as { turn: number; spin: number };
    const turns = [component.turn];
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(FRAME_MS);
      turns.push(component.turn);
    }
    const steps = turns.slice(1).map((turn, i) => turn - turns[i]);
    expect(steps.every((step, i) => step > 0 && (i === 0 || step > steps[i - 1]))).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(component.spin).toBeCloseTo(PS1_TURN_SPEED, 2);
  });

  it('a pointer that is not the one dragging, or a right click, does nothing', async () => {
    const { frames } = stubBrowser({ reducedMotion: true });
    await mount();
    const before = frames.length;
    canvas().dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 2, clientX: 0, bubbles: true }));
    canvas().dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 50, bubbles: true }));
    expect(frames.length).toBe(before);
  });
});
