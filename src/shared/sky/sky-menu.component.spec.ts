import { TestBed } from '@angular/core/testing';
import { HINT_AFTER_MS, HINT_FOR_MS, HINT_KEY, HINT_TEXT, SkyMenuComponent } from './sky-menu.component';
import { SkyService } from './sky.service';

async function mount(ready = true, setup: (sky: SkyService) => void = () => undefined) {
  setup(TestBed.inject(SkyService));
  const fixture = TestBed.createComponent(SkyMenuComponent);
  TestBed.inject(SkyService).ready.set(ready);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el, sky: TestBed.inject(SkyService), button: () => el.querySelector<HTMLButtonElement>('.sky-button') };
}

describe('SkyMenuComponent', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('shows nothing until the sky has drawn', async () => {
    const { button } = await mount(false);
    expect(button()).toBeNull();
  });

  it('opens and closes as a disclosure', async () => {
    const { fixture, el, button } = await mount();
    expect(button()!.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#sky-menu')).toBeNull();
    button()!.click();
    await fixture.whenStable();
    expect(button()!.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('#sky-menu')).not.toBeNull();
    // Outside click closes it.
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(el.querySelector('#sky-menu')).toBeNull();
  });

  it('Escape closes it, returns focus, and stops the site-wide Escape', async () => {
    const { fixture, el, button } = await mount();
    button()!.click();
    await fixture.whenStable();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    el.querySelector('#sky-menu')!.dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(el.querySelector('#sky-menu')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('picking a light changes and remembers it', async () => {
    const { fixture, el, sky, button } = await mount();
    button()!.click();
    await fixture.whenStable();
    const radios = Array.from(el.querySelectorAll<HTMLInputElement>('input[name="sky-lighting"]'));
    expect(radios.map(r => r.value)).toEqual(['darkness', 'real', 'sunrise', 'sunset', 'day']);
    expect(radios[0].checked).toBe(true);
    expect(el.textContent).toContain('darkness [default]');
    radios[3].click();
    await fixture.whenStable();
    expect(sky.lighting()).toBe('sunset');
    expect(localStorage.getItem('sky-lighting')).toBe('sunset');
  });

  it('lists what is up right now', async () => {
    const { fixture, el, sky, button } = await mount();
    sky.upNow.set({ planets: ['Venus', 'Jupiter'], constellations: ['Orion'], moon: 'Moon, 40% lit', detail: null });
    button()!.click();
    await fixture.whenStable();
    const items = Array.from(el.querySelectorAll('.up-now li')).map(li => li.textContent!.trim());
    expect(items).toEqual(['Venus, Jupiter', 'Orion', 'Moon, 40% lit']);
  });

  it('opens from elsewhere (the sky badges) and takes focus', async () => {
    const { fixture, el, sky, button } = await mount();
    sky.openMenu();
    await fixture.whenStable();
    expect(button()!.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(el.querySelector('input[name="sky-lighting"]:checked'));
  });

  it('hands focus back to the badge that opened it on Escape', async () => {
    const { fixture, el, sky } = await mount();
    const badge = document.createElement('button');
    document.body.appendChild(badge);
    badge.focus();
    sky.openMenu();
    await fixture.whenStable();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    el.querySelector('#sky-menu')!.dispatchEvent(event);
    await fixture.whenStable();
    expect(document.activeElement).toBe(badge);
    badge.remove();
  });

  it('has a look up group: hide the page (a toggle button) and name a star', async () => {
    const { fixture, el, sky, button } = await mount();
    button()!.click();
    await fixture.whenStable();
    const labels = Array.from(el.querySelectorAll('.group .label')).map(h => h.textContent!.trim());
    expect(labels).toContain('look up');
    const [hide, name] = Array.from(el.querySelectorAll<HTMLButtonElement>('.action'));
    expect(hide.textContent!.trim()).toBe('hide the page');
    expect(hide.getAttribute('aria-pressed')).toBe('false');
    hide.click();
    await fixture.whenStable();
    expect(sky.lookingUp()).toBe(true);
    // The menu closes (so the first touch lands on the sky), and focus goes back to the ☾.
    expect(sky.menuOpen()).toBe(false);
    await vi.waitFor(() => expect(document.activeElement).toBe(button()));
    // Opened again while looking up, the toggle shows it's on, and brings the page back.
    button()!.click();
    await fixture.whenStable();
    const again = el.querySelector<HTMLButtonElement>('.action')!;
    expect(again.getAttribute('aria-pressed')).toBe('true');
    again.click();
    await fixture.whenStable();
    expect(sky.lookingUp()).toBe(false);

    const named = el.querySelectorAll<HTMLButtonElement>('.action')[1];
    expect(name.textContent!.trim()).toBe('name a star');
    named.click();
    await fixture.whenStable();
    expect(sky.lookingUp()).toBe(true);
    expect(sky.naming()).toBe(true);
    expect(sky.menuOpen()).toBe(false);
    // Closing the panel later hands focus back to the ☾ button.
    expect(sky.namingOpener).toBe(button());
    sky.leaveLookUp();
  });

  it('lists the stars visitors have named, and hides the group when there are none', async () => {
    const { fixture, el, sky, button } = await mount();
    button()!.click();
    await fixture.whenStable();
    const labels = () => Array.from(el.querySelectorAll('.group .label')).map(h => h.textContent!.trim());
    expect(labels()).not.toContain('named by visitors');
    sky.visitorNames.set([
      { ra: 283.626, dec: 36.899, name: 'Gerald', credit: 'sam', added: '2026-10', near: 'Vega' },
      { ra: 10, dec: 20, name: 'Pat', credit: null, added: '2026-11', near: 'Mirach' },
    ]);
    await fixture.whenStable();
    expect(labels()).toContain('named by visitors');
    const items = Array.from(el.querySelectorAll('.visitor-names li')).map(li => li.textContent!.trim());
    expect(items).toEqual(['Gerald · near Vega · by sam', 'Pat · near Mirach · by a visitor']);
  });

  describe('the one-time nudge', () => {
    const hint = (el: HTMLElement) => el.querySelector('.sky-hint');

    it('a moment after the sky is up, points at it: a pill under the ☾ and a ring on it, gone after a few seconds', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const { fixture, el, button } = await mount();
      expect(hint(el)).toBeNull();
      vi.advanceTimersByTime(HINT_AFTER_MS);
      await fixture.whenStable();
      expect(hint(el)?.textContent?.trim()).toBe(HINT_TEXT);
      expect(hint(el)?.getAttribute('aria-hidden')).toBe('true');
      expect(button()!.classList).toContain('hinting');
      expect(sessionStorage.getItem(HINT_KEY)).toBe('1');
      vi.advanceTimersByTime(HINT_FOR_MS);
      await fixture.whenStable();
      expect(hint(el)).toBeNull();
      expect(button()!.classList).not.toContain('hinting');
    });

    it('goes at once when the menu opens or on a press anywhere, and only comes once a visit', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const { fixture, el, button } = await mount();
      vi.advanceTimersByTime(HINT_AFTER_MS);
      await fixture.whenStable();
      expect(hint(el)).not.toBeNull();
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await fixture.whenStable();
      expect(hint(el)).toBeNull();
      // Opening the menu would end it too, and it never comes back this page.
      button()!.click();
      await fixture.whenStable();
      vi.advanceTimersByTime(HINT_AFTER_MS + HINT_FOR_MS);
      await fixture.whenStable();
      expect(hint(el)).toBeNull();

      // The next page this visit: the flag says it's been shown.
      TestBed.resetTestingModule();
      const again = await mount();
      vi.advanceTimersByTime(HINT_AFTER_MS);
      await again.fixture.whenStable();
      expect(hint(again.el)).toBeNull();
    });

    it('stays away while there are no stars to point at (a daylight), and when the menu is already open', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const { fixture, el, sky } = await mount(true, s => s.lighting.set('day'));
      vi.advanceTimersByTime(HINT_AFTER_MS);
      await fixture.whenStable();
      expect(hint(el)).toBeNull();
      expect(sessionStorage.getItem(HINT_KEY)).toBeNull();
      // Real time counts once the Sun is down.
      sky.lighting.set('real');
      sky.upNow.set({ planets: [], moon: null, constellations: [], detail: { moon: { illuminated: 0, phase: 0, alt: 0 }, sunAlt: -20, planets: [] } });
      expect(sky.starsShowing()).toBe(true);
      sky.upNow.set({ planets: [], moon: null, constellations: [], detail: { moon: { illuminated: 0, phase: 0, alt: 0 }, sunAlt: 10, planets: [] } });
      expect(sky.starsShowing()).toBe(false);
    });
  });
});
