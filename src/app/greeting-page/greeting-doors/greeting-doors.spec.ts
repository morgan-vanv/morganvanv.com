import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { GreetingDoorsComponent } from './greeting-doors';
import { SkyService } from '../../../shared/sky/sky.service';
import { CampfireService, ShoutLog } from '../../../shared/services/campfire.service';
import { computeLayout } from '../../../shared/sky/sky-render';
import { nightLights } from '../../../shared/sky/sky-landscape';

describe('GreetingDoorsComponent', () => {
  let fixture: ComponentFixture<GreetingDoorsComponent>;
  let sky: SkyService;
  let hero: HTMLElement;
  const shoutLog = signal<ShoutLog | null>(null);
  const campfire = { configured: true, shoutLog, watchShouts: vi.fn() };
  const stop = vi.fn();
  // happy-dom's window is 1024×768; the lights where the sky would put them there.
  const lights = nightLights(computeLayout(window.innerWidth, window.innerHeight));

  beforeEach(async () => {
    shoutLog.set(null);
    campfire.configured = true;
    campfire.watchShouts.mockReset().mockReturnValue(stop);
    stop.mockReset();
    await TestBed.configureTestingModule({
      imports: [GreetingDoorsComponent],
      providers: [provideRouter([]), { provide: CampfireService, useValue: campfire }],
    }).compileComponents();
    sky = TestBed.inject(SkyService);
    hero = document.createElement('div');
    document.body.appendChild(hero);
    fixture = TestBed.createComponent(GreetingDoorsComponent);
    fixture.componentRef.setInput('hero', hero);
    await fixture.whenStable();
  });

  afterEach(() => hero.remove());

  const el = () => fixture.nativeElement as HTMLElement;
  const door = (id: string) => el().querySelector<HTMLElement>(`.greeting-door[data-door="${id}"]`);
  const spot = (id: string) => door(id)!.querySelector<HTMLAnchorElement>('a.spot')!;
  const showLights = async () => {
    sky.nightLights.set(lights);
    await fixture.whenStable();
  };
  const press = async (id: string, pointerType: string | null) => {
    if (pointerType) spot(id).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType }));
    spot(id).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await fixture.whenStable();
  };

  it('shows nothing until the sky has placed its lights (so nothing is prerendered)', () => {
    expect(el().querySelector('.greeting-door')).toBeNull();
  });

  it('puts a door exactly on the farmhouse window and one on the campfire, named for where they go', async () => {
    await showLights();
    expect(door('window')!.style.left).toBe(`${lights.window.x}px`);
    expect(door('window')!.style.top).toBe(`${lights.window.y}px`);
    expect(door('fire')!.style.left).toBe(`${lights.fire.x}px`);
    expect(spot('window').getAttribute('aria-label')).toBe('Projects');
    expect(spot('window').getAttribute('href')).toBe('/projects');
    expect(spot('fire').getAttribute('aria-label')).toBe('Social');
    expect(spot('fire').getAttribute('href')).toBe('/social');
  });

  it('keeps the labels out of the tab order and away from screen readers (the spot is the link for them)', async () => {
    await showLights();
    for (const label of el().querySelectorAll('a.label')) {
      expect(label.getAttribute('tabindex')).toBe('-1');
      expect(label.getAttribute('aria-hidden')).toBe('true');
    }
    expect(door('window')!.querySelector('.label')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('the light\'s on [ projects › ]');
  });

  it('counts who\'s around the fire, or says it\'s lit when nobody is (or there\'s no campfire)', async () => {
    await showLights();
    const fireLabel = () => door('fire')!.querySelector('.label')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(fireLabel()).toBe('the fire\'s lit [ social › ]');
    shoutLog.set({ shouts: [], here: 3, open: true });
    await fixture.whenStable();
    expect(fireLabel()).toBe('3 around the fire [ social › ]');
    shoutLog.set({ shouts: [], here: 0, open: true });
    await fixture.whenStable();
    expect(fireLabel()).toBe('the fire\'s lit [ social › ]');
  });

  it('asks the campfire for its count only while the fire\'s door is on screen', async () => {
    expect(campfire.watchShouts).not.toHaveBeenCalled();
    await showLights();
    expect(campfire.watchShouts).toHaveBeenCalledTimes(1);
    sky.nightLights.set(null);
    await fixture.whenStable();
    expect(stop).toHaveBeenCalled();
  });

  it('hides a door whose spot is under the hero', async () => {
    const title = document.createElement('h1');
    hero.appendChild(title);
    const { x, y } = lights.window;
    title.getBoundingClientRect = () => ({ left: x - 20, top: y - 10, right: x + 20, bottom: y + 10, width: 40, height: 20, x: x - 20, y: y - 10, toJSON: () => ({}) });
    window.dispatchEvent(new Event('resize'));
    await showLights();
    expect(door('window')).toBeNull();
    expect(door('fire')).not.toBeNull();
  });

  it('shows the label while a mouse is over it, not before', async () => {
    await showLights();
    expect(door('window')!.classList).not.toContain('showing');
    door('window')!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(door('window')!.classList).toContain('showing');
    door('window')!.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(door('window')!.classList).not.toContain('showing');
  });

  it('goes in on a click or Enter', async () => {
    await showLights();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await press('window', 'mouse');
    expect(navigate).toHaveBeenCalledWith('/projects');
    await press('fire', null);
    expect(navigate).toHaveBeenCalledWith('/social');
  });

  it('on touch, shows the label on the first tap without going in; a second tap goes in', async () => {
    await showLights();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await press('fire', 'touch');
    expect(navigate).not.toHaveBeenCalled();
    expect(door('fire')!.classList).toContain('showing');
    await press('fire', 'touch');
    expect(navigate).toHaveBeenCalledWith('/social');
  });

  it('puts a tapped label away on a tap anywhere else', async () => {
    await showLights();
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await press('window', 'touch');
    expect(door('window')!.classList).toContain('showing');
    door('window')!.querySelector('.label')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    await fixture.whenStable();
    expect(door('window')!.classList).toContain('showing');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    await fixture.whenStable();
    expect(door('window')!.classList).not.toContain('showing');
  });

  it('hides a label on Escape, without the site-wide Escape', async () => {
    await showLights();
    door('fire')!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await fixture.whenStable();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape);
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(door('fire')!.classList).not.toContain('showing');
    // With nothing showing, Escape is the site's again.
    const again = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(again);
    expect(again.defaultPrevented).toBe(false);
  });
});
