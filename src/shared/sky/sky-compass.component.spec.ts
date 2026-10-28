import { TestBed } from '@angular/core/testing';
import { SkyCompassComponent } from './sky-compass.component';
import { SkyService } from './sky.service';

describe('SkyCompassComponent', () => {
  async function mount() {
    const fixture = TestBed.createComponent(SkyCompassComponent);
    const sky = TestBed.inject(SkyService);
    sky.enterLookUp();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const button = (name: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
    return { fixture, sky, el, button };
  }

  it('reads which way the sky is turned', async () => {
    const { fixture, sky, el } = await mount();
    expect(el.querySelector('.reading')?.textContent).toBe('facing S · 180°');
    sky.view.set({ facing: 338 });
    await fixture.whenStable();
    expect(el.querySelector('.reading')?.textContent).toBe('facing NNW · 338°');
  });

  it('has three named buttons, each a real button, and no arrow keys of its own', async () => {
    const { el, button } = await mount();
    for (const name of ['turn left 45°', 'turn right 45°', 'face south']) {
      expect(button(name)).toBeTruthy();
      expect(button(name).type).toBe('button');
    }
    // The visible word is in the name, for voice control.
    expect(button('face south').textContent?.trim()).toBe('south');
    // ← → stay page navigation: nothing here listens for keys.
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    el.querySelector('button')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('the buttons ask the sky to turn, and a polite live region says where that leaves you', async () => {
    const { fixture, sky, el, button } = await mount();
    const live = el.querySelector('[aria-live="polite"]')!;
    expect(live.textContent?.trim()).toBe('');
    button('turn left 45°').click();
    expect(sky.viewRequest()?.view).toEqual({ facing: 135 });
    button('turn left 45°').click();
    expect(sky.viewRequest()?.view).toEqual({ facing: 90 });
    await fixture.whenStable();
    expect(live.textContent?.trim()).toBe('facing east, 90°');
    button('turn right 45°').click();
    expect(sky.viewRequest()?.view).toEqual({ facing: 135 });
    button('face south').click();
    expect(sky.viewRequest()?.view).toEqual({ facing: 180 });
    await fixture.whenStable();
    expect(live.textContent?.trim()).toBe('facing south, 180°');
  });

  it('has no tilt: the window\'s top is as high as the sky goes', async () => {
    const { el } = await mount();
    expect(el.querySelector('[aria-label^="tilt"]')).toBeNull();
  });
});
