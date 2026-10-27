import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OwnButtonBadgeComponent, OWN_BUTTON_SNIPPET } from './own-button-badge.component';

describe('OwnButtonBadgeComponent', () => {
  async function render() {
    TestBed.configureTestingModule({ imports: [OwnButtonBadgeComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(OwnButtonBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector<HTMLButtonElement>('button.badge')!;
    return { fixture, el, button };
  }

  it('links to the site with the real gif', () => {
    expect(OWN_BUTTON_SNIPPET).toBe(
      '<a href="https://morganvanv.com"><img src="https://morganvanv.com/88x31.gif" width="88" height="31" alt="morganvanv.com"></a>',
    );
  });

  it('opens a panel with the gif and the HTML, as a disclosure', async () => {
    const { fixture, el, button } = await render();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#link-to-me')).toBeNull();

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe('link-to-me');
    expect(el.querySelector('#link-to-me img')?.getAttribute('src')).toBe('/88x31.gif');
    expect(el.querySelector<HTMLTextAreaElement>('#link-to-me textarea')?.value).toBe(OWN_BUTTON_SNIPPET);

    button.click();
    await fixture.whenStable();
    expect(el.querySelector('#link-to-me')).toBeNull();
  });

  it('copies the HTML and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const { fixture, el, button } = await render();
    button.click();
    await fixture.whenStable();

    el.querySelector<HTMLButtonElement>('.copy')!.click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith(OWN_BUTTON_SNIPPET);
    expect(el.querySelector('.copy')?.textContent).toContain('copied');
    vi.unstubAllGlobals();
  });

  it('closes on Escape without sending the page back to the greeting', async () => {
    const { fixture, el, button } = await render();
    button.click();
    await fixture.whenStable();

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    el.querySelector('.copy')!.dispatchEvent(escape);
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(el.querySelector('#link-to-me')).toBeNull();
  });

  it('closes on a click elsewhere', async () => {
    const { fixture, el, button } = await render();
    button.click();
    await fixture.whenStable();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(el.querySelector('#link-to-me')).toBeNull();
  });

  it('closes when focus moves somewhere else on the page', async () => {
    const { fixture, el, button } = await render();
    button.click();
    await fixture.whenStable();
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    el.querySelector('.copy')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: elsewhere }));
    await fixture.whenStable();
    expect(el.querySelector('#link-to-me')).toBeNull();
    elsewhere.remove();
  });
});
