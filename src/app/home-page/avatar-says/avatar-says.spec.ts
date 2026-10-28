import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarSaysComponent, HELLO_AFTER_MS, HELLO_KEY, SAY_FOR_MS } from './avatar-says';
import { GUEST_SUBTITLES_TOKEN, SUBTITLES } from '../../../shared/constants/subtitles.const';
import { GuestSubtitle } from '../../../shared/visitor-content/visitor-content';

const GUEST: GuestSubtitle = { text: 'a guest line', by: 'sam', added: '2026-10' };

describe('AvatarSaysComponent', () => {
  let fixture: ComponentFixture<AvatarSaysComponent>;

  async function mount(guests: readonly GuestSubtitle[] = []) {
    TestBed.configureTestingModule({
      imports: [AvatarSaysComponent],
      providers: [{ provide: GUEST_SUBTITLES_TOKEN, useValue: guests }],
    });
    fixture = TestBed.createComponent(AvatarSaysComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const bubble = () => (fixture.nativeElement as HTMLElement).querySelector('.bubble');
  const said = () => bubble()?.querySelector('.said')?.textContent?.trim();
  const status = () => (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent?.trim();

  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the photo, as a button that says what it does', async () => {
    const el = await mount();
    const button = el.querySelector('button.avatar');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Make Morgan say something');
    expect(button?.querySelector('img.u-photo')?.getAttribute('alt')).toBe('Morgan Van Valkenburgh');
    expect(bubble()).toBeNull();
  });

  it('says hello once a visit, a moment after Home loads, without announcing it, then fades', async () => {
    await mount();
    expect(bubble()).toBeNull();
    vi.advanceTimersByTime(HELLO_AFTER_MS);
    await fixture.whenStable();
    expect(SUBTITLES).toContain(said());
    expect(status()).toBe('');
    expect(sessionStorage.getItem(HELLO_KEY)).toBe('1');
    vi.advanceTimersByTime(SAY_FOR_MS);
    await fixture.whenStable();
    expect(bubble()).toBeNull();

    // The next time Home loads in this tab, it waits to be asked.
    TestBed.resetTestingModule();
    await mount();
    vi.advanceTimersByTime(HELLO_AFTER_MS + SAY_FOR_MS);
    await fixture.whenStable();
    expect(bubble()).toBeNull();
  });

  it('says a line each press, out loud, every line before any repeats, a visitor\'s with its credit', async () => {
    sessionStorage.setItem(HELLO_KEY, '1');
    const el = await mount([GUEST]);
    const seen: string[] = [];
    for (let i = 0; i < SUBTITLES.length + 1; i++) {
      el.querySelector<HTMLButtonElement>('button.avatar')!.click();
      await fixture.whenStable();
      seen.push(said()!);
      if (said() === GUEST.text) {
        expect(bubble()?.querySelector('.credit')?.textContent?.trim()).toBe('— suggested by sam');
        expect(status()).toBe('a guest line — suggested by sam');
      } else {
        expect(bubble()?.querySelector('.credit')).toBeNull();
        expect(status()).toBe(said());
      }
    }
    expect([...seen].sort()).toEqual([...SUBTITLES, GUEST.text].sort());
  });

  it('hides on Escape, keeping the site-wide Escape out of it, and lets Escape be otherwise', async () => {
    sessionStorage.setItem(HELLO_KEY, '1');
    const el = await mount();
    const idle = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    document.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);

    el.querySelector<HTMLButtonElement>('button.avatar')!.click();
    await fixture.whenStable();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    document.dispatchEvent(escape);
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(bubble()).toBeNull();
  });

  it('hides on a press anywhere else', async () => {
    sessionStorage.setItem(HELLO_KEY, '1');
    const el = await mount();
    el.querySelector<HTMLButtonElement>('button.avatar')!.click();
    await fixture.whenStable();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(bubble()).toBeNull();
  });
});
