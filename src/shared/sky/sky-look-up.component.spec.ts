import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { SkyLookUpComponent } from './sky-look-up.component';
import { SkyService } from './sky.service';
import { KeyboardNavService } from '../services/keyboard-nav.service';

@Component({ selector: 'app-blank', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class BlankComponent {}

async function mount() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'home', component: BlankComponent }, { path: 'now', component: BlankComponent }]),
    ],
  });
  const router = TestBed.inject(Router);
  await router.navigateByUrl('/home');
  const fixture = TestBed.createComponent(SkyLookUpComponent);
  const sky = TestBed.inject(SkyService);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const escape = async (target: EventTarget = document.body) => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    await fixture.whenStable();
    return event;
  };
  return { fixture, el, sky, router, escape };
}

describe('SkyLookUpComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the back button only while looking up, and it brings the page back', async () => {
    const { fixture, el, sky } = await mount();
    expect(el.querySelector('.back')).toBeNull();
    sky.enterLookUp();
    await fixture.whenStable();
    const back = el.querySelector<HTMLButtonElement>('.back')!;
    expect(back.textContent).toContain('back to the page');
    back.click();
    await fixture.whenStable();
    expect(sky.lookingUp()).toBe(false);
    expect(el.querySelector('.back')).toBeNull();
  });

  it('shows free look\'s compass, top-left, only while looking up, and coming back faces south again', async () => {
    const { fixture, el, sky } = await mount();
    expect(el.querySelector('app-sky-compass')).toBeNull();
    sky.enterLookUp();
    await fixture.whenStable();
    // Not until free look is really on (loaded, with a sky to turn).
    expect(el.querySelector('app-sky-compass')).toBeNull();
    sky.freeLooking.set(true);
    await fixture.whenStable();
    expect(el.querySelector('app-sky-compass .compass')).not.toBeNull();
    // Before the back pill, so focus goes in the order they sit on screen (top-left first).
    const compass = el.querySelector('app-sky-compass')!;
    expect(compass.compareDocumentPosition(el.querySelector('.back')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    sky.view.set({ facing: 20, tilt: 30 });
    el.querySelector<HTMLButtonElement>('.back')!.click();
    await fixture.whenStable();
    sky.freeLooking.set(false); // (the sky turns it off as it leaves)
    await fixture.whenStable();
    expect(el.querySelector('app-sky-compass')).toBeNull();
    expect(sky.view()).toEqual({ facing: 180, tilt: 0 });
  });

  it('Escape leaves look-up, and stops the site-wide Escape (back to the greeting)', async () => {
    const { sky, router, escape } = await mount();
    const nav = TestBed.inject(KeyboardNavService);
    const navigate = vi.spyOn(router, 'navigate');
    sky.enterLookUp();
    const event = await escape();
    expect(event.defaultPrevented).toBe(true);
    expect(sky.lookingUp()).toBe(false);
    nav.onKeyDown(event);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Escape closes the naming panel first, then leaves look-up', async () => {
    const { fixture, el, sky, escape } = await mount();
    sky.startNaming();
    await fixture.whenStable();
    expect(el.querySelector('app-star-naming')).not.toBeNull();
    const first = await escape(el.querySelector('app-star-naming .naming')!);
    expect(first.defaultPrevented).toBe(true);
    expect(sky.naming()).toBe(false);
    expect(sky.lookingUp()).toBe(true);
    expect(el.querySelector('app-star-naming')).toBeNull();
    const second = await escape();
    expect(second.defaultPrevented).toBe(true);
    expect(sky.lookingUp()).toBe(false);
  });

  it('Escape closes an open ☾ menu before leaving look-up, even with focus elsewhere', async () => {
    const { sky, escape } = await mount();
    sky.enterLookUp();
    sky.menuOpen.set(true);
    expect((await escape()).defaultPrevented).toBe(true);
    expect(sky.menuOpen()).toBe(false);
    expect(sky.lookingUp()).toBe(true);
    await escape();
    expect(sky.lookingUp()).toBe(false);
  });

  it('leaves Escape alone when not looking up, or when the ☾ menu already handled it', async () => {
    const { sky, escape } = await mount();
    expect((await escape()).defaultPrevented).toBe(false);
    sky.enterLookUp();
    const handled = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    expect(sky.lookingUp()).toBe(true);
    sky.leaveLookUp();
  });

  it('a route change (← →, a link) leaves look-up', async () => {
    const { fixture, sky, router } = await mount();
    sky.startNaming();
    await router.navigateByUrl('/now');
    await fixture.whenStable();
    expect(sky.lookingUp()).toBe(false);
    expect(sky.naming()).toBe(false);
  });

  it('focus goes into the panel when it opens and back to what opened it when it closes', async () => {
    const { fixture, el, sky, escape } = await mount();
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    sky.startNaming(opener);
    await fixture.whenStable();
    // The panel first; once the sky has selected a star, on to the name field.
    expect(document.activeElement).toBe(el.querySelector('app-star-naming .naming'));
    sky.setCandidates([{ star: { ra: 283.626, dec: 36.899, mag: 4.22, v: [0, 0, 1], near: 'Vega' }, x: 100, y: 100 }]);
    await fixture.whenStable();
    await vi.waitFor(() => expect(document.activeElement).toBe(el.querySelector('#star-name')));
    await escape(document.activeElement!);
    expect(document.activeElement).toBe(opener);
    opener.remove();
    sky.leaveLookUp();
  });
});
