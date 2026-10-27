import { TestBed } from '@angular/core/testing';
import { SkyMenuComponent } from './sky-menu.component';
import { SkyService } from './sky.service';

async function mount(ready = true) {
  const fixture = TestBed.createComponent(SkyMenuComponent);
  TestBed.inject(SkyService).ready.set(ready);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el, sky: TestBed.inject(SkyService), button: () => el.querySelector<HTMLButtonElement>('.sky-button') };
}

describe('SkyMenuComponent', () => {
  afterEach(() => localStorage.clear());

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
    expect(hide.getAttribute('aria-pressed')).toBe('true');
    hide.click();
    await fixture.whenStable();
    expect(sky.lookingUp()).toBe(false);

    expect(name.textContent!.trim()).toBe('name a star');
    name.click();
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
});

