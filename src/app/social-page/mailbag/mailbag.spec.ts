import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MAILBAG_TOKEN, MailbagComponent, SIDE_CARDS, SWIPE_PX, cardPose, letterCountLabel } from './mailbag';
import { MAILBAG } from '../../../generated/mailbag';
import { MailbagLetter, renderAnswer } from '../../../shared/visitor-content/visitor-content';

const letter = (n: number, question = `question ${n}?`, answer = `<p>answer ${n}</p>`): MailbagLetter => ({
  id: `2026-10-${String(30 - n).padStart(2, '0')}-q-0000000${n}`,
  asked: `2026-10-${String(30 - n).padStart(2, '0')}`,
  question,
  answer,
});

async function mount(letters: readonly MailbagLetter[]) {
  TestBed.configureTestingModule({
    imports: [MailbagComponent],
    providers: [provideRouter([]), { provide: MAILBAG_TOKEN, useValue: letters }],
  });
  const fixture = TestBed.createComponent(MailbagComponent);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const slots = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.slot')];
const front = (el: HTMLElement) => el.querySelector<HTMLElement>('.slot.front')!;
const position = (el: HTMLElement) => el.querySelector('.position')?.textContent?.trim();
const arrow = (el: HTMLElement, which: 'Newer' | 'Older') => el.querySelector<HTMLButtonElement>(`button[aria-label="${which} letter"]`)!;

describe('MailbagComponent', () => {
  it('reads the letters gathered from content/mailbag/ by default', () => {
    expect(TestBed.inject(MAILBAG_TOKEN)).toBe(MAILBAG);
  });

  it('with no letters, says so and links to the Contact form rather than hiding', async () => {
    const { el } = await mount([]);
    expect(el.querySelector('h2')?.textContent).toContain('You Asked');
    expect(el.querySelector('.range-label')?.textContent?.trim()).toBe('empty, for now');
    expect(el.querySelector('.letters')).toBeNull();
    const ask = el.querySelector<HTMLAnchorElement>('.empty a');
    expect(ask?.getAttribute('href')).toBe('/home');
    expect(ask?.textContent).toBe('Ask me something');
    expect(el.querySelector('.stage, .turn')).toBeNull();
  });

  it('shows each letter: the question as a quote, the answer, the date asked', async () => {
    const { el } = await mount([letter(1, 'why the cat?\nreally?', renderAnswer('Because *Ada*. See [now](/now).'))]);
    expect(el.querySelector('.range-label')?.textContent?.trim()).toBe('1 letter');
    const item = front(el);
    expect(item.querySelector('blockquote.question p')?.textContent).toBe('why the cat?\nreally?');
    expect(item.querySelector('.answer em')?.textContent).toBe('Ada');
    expect(item.querySelector('.answer a')?.getAttribute('href')).toBe('/now');
    const time = item.querySelector('.asked time');
    expect(time?.getAttribute('datetime')).toBe('2026-10-29');
    expect(time?.textContent).toBe('Oct 29, 2026');
  });

  it('renders the question as text, never as HTML', async () => {
    const question = '<img src=x onerror="alert(1)"> <b>bold?</b>';
    const { el } = await mount([letter(1, question)]);
    const quote = el.querySelector('.question p')!;
    expect(quote.textContent).toBe(question);
    expect(quote.querySelector('img, b')).toBeNull();
  });

  it('keeps an external link\'s new tab and rel="noopener noreferrer" through Angular\'s sanitizer', async () => {
    const { el } = await mount([letter(1, 'q?', renderAnswer('[repo](https://github.com/morgan-vanv) <script>x</script>'))]);
    const link = el.querySelector<HTMLAnchorElement>('.answer a')!;
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(el.querySelector('.answer script')).toBeNull();
    expect(el.querySelector('.answer')?.textContent).toContain('<script>x</script>');
  });

  it('stacks every letter as a card, the newest in front and the rest inert', async () => {
    const letters = [1, 2, 3, 4, 5].map(n => letter(n));
    const { el } = await mount(letters);
    expect(el.querySelector('.range-label')?.textContent?.trim()).toBe('5 letters');
    // Every letter is in the page (prerendered); only the front one is live.
    expect(slots(el).length).toBe(5);
    expect(front(el).querySelector('.question')?.textContent).toBe('question 1?');
    expect(front(el).getAttribute('aria-label')).toBe('letter 1 of 5');
    for (const slot of slots(el).slice(1)) {
      expect(slot.querySelector('.note')?.hasAttribute('inert')).toBe(true);
    }
    expect(front(el).querySelector('.note')?.hasAttribute('inert')).toBe(false);
    // Up to SIDE_CARDS fan out to the side, each with a pointer-only target; the rest are out of sight.
    const shown = slots(el).filter(slot => !slot.classList.contains('away'));
    expect(shown.length).toBe(1 + SIDE_CARDS);
    const pick = shown[1].querySelector('button.pick')!;
    expect(pick.getAttribute('tabindex')).toBe('-1');
    expect(pick.getAttribute('aria-hidden')).toBe('true');
    expect(front(el).querySelector('button.pick')).toBeNull();
    expect(slots(el)[4].querySelector('button.pick')).toBeNull();
  });

  it('turns with ‹ ›, says where it is, and stays focusable at either end', async () => {
    const { fixture, el } = await mount([1, 2, 3].map(n => letter(n)));
    expect(position(el)).toBe('1 / 3');
    expect(el.querySelector('.position')?.getAttribute('aria-live')).toBe('polite');
    expect(arrow(el, 'Newer').getAttribute('aria-disabled')).toBe('true');
    expect(arrow(el, 'Older').getAttribute('aria-disabled')).toBe('false');
    expect(arrow(el, 'Older').getAttribute('aria-controls')).toBe('mailbag-letters');

    arrow(el, 'Older').click();
    await fixture.whenStable();
    expect(position(el)).toBe('2 / 3');
    expect(front(el).querySelector('.question')?.textContent).toBe('question 2?');

    arrow(el, 'Older').click();
    arrow(el, 'Older').click(); // already at the oldest: nothing happens
    await fixture.whenStable();
    expect(position(el)).toBe('3 / 3');
    expect(arrow(el, 'Older').getAttribute('aria-disabled')).toBe('true');
    expect(arrow(el, 'Older').disabled).toBe(false);

    arrow(el, 'Newer').click();
    await fixture.whenStable();
    expect(position(el)).toBe('2 / 3');
  });

  it('brings a side card to the front when it is clicked', async () => {
    const { fixture, el } = await mount([1, 2, 3].map(n => letter(n)));
    slots(el)[2].querySelector<HTMLButtonElement>('button.pick')!.click();
    await fixture.whenStable();
    expect(position(el)).toBe('3 / 3');
    expect(slots(el)[2].classList).toContain('front');
  });

  it('turns on a sideways swipe, not on a short or mostly vertical one, and not for a mouse', async () => {
    const { fixture, el } = await mount([1, 2, 3].map(n => letter(n)));
    const stage = el.querySelector<HTMLElement>('.stage')!;
    const swipe = async (dx: number, dy = 0, pointerType = 'touch') => {
      const at = (x: number, y: number) => ({ bubbles: true, pointerId: 1, pointerType, clientX: x, clientY: y });
      stage.dispatchEvent(new PointerEvent('pointerdown', at(200, 100)));
      stage.dispatchEvent(new PointerEvent('pointerup', at(200 + dx, 100 + dy)));
      await fixture.whenStable();
    };
    await swipe(-(SWIPE_PX + 20));
    expect(position(el)).toBe('2 / 3');
    await swipe(SWIPE_PX + 20);
    expect(position(el)).toBe('1 / 3');
    await swipe(-(SWIPE_PX - 10));
    await swipe(-(SWIPE_PX + 20), 80);
    await swipe(-(SWIPE_PX + 20), 0, 'mouse');
    expect(position(el)).toBe('1 / 3');
  });

  it('with one letter, shows just the note: no arrows, no side cards', async () => {
    const { el } = await mount([letter(1)]);
    expect(slots(el).length).toBe(1);
    expect(el.querySelector('.turn')).toBeNull();
    expect(el.querySelector('button.pick')).toBeNull();
  });

  it('folds the answer away until the front note is unfolded, and folds it again on a turn', async () => {
    const { fixture, el } = await mount([1, 2].map(n => letter(n)));
    const button = () => front(el).querySelector<HTMLButtonElement>('button.unfold')!;
    const fold = () => front(el).querySelector<HTMLElement>('.fold')!;

    // Folded: the answer is in the page (prerendered) but inert, and the button says how to open it.
    expect(button().getAttribute('type')).toBe('button');
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().textContent?.trim()).toBe('unfold for my answer');
    expect(fold().hasAttribute('inert')).toBe(true);
    expect(button().getAttribute('aria-controls')).toBe(fold().id);
    expect(fold().querySelector('.answer')?.textContent).toBe('answer 1');

    button().click();
    await fixture.whenStable();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(button().textContent?.trim()).toBe('fold it back up');
    expect(fold().hasAttribute('inert')).toBe(false);
    expect(front(el).querySelector('.note')?.classList).toContain('unfolded');

    arrow(el, 'Older').click();
    await fixture.whenStable();
    expect(el.querySelectorAll('.note.unfolded').length).toBe(0);
    expect(button().getAttribute('aria-expanded')).toBe('false');
  });

  it('poses the cards: the front one flat, the sides fanned toward it, the rest out of sight', () => {
    expect(cardPose(0)).toEqual({ x: 0, rotate: 0, scale: 1, opacity: 1, depth: SIDE_CARDS + 1, shown: true });
    const right = cardPose(1);
    const left = cardPose(-1);
    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBe(-right.x);
    expect(right.rotate).toBeLessThan(0);
    expect(left.rotate).toBe(-right.rotate);
    expect(cardPose(2).x).toBeGreaterThan(right.x);
    expect(cardPose(2).scale).toBeLessThan(right.scale);
    expect(cardPose(2).depth).toBeLessThan(right.depth);
    expect(cardPose(SIDE_CARDS).shown).toBe(true);
    const away = cardPose(SIDE_CARDS + 1);
    expect(away).toMatchObject({ shown: false, opacity: 0, depth: 0 });
    // Everything further out waits in the same spot, so it slides in from there.
    expect(cardPose(SIDE_CARDS + 5)).toEqual(away);
  });

  it('ends with the way to ask, whether or not there are older letters', async () => {
    for (const count of [1, 4]) {
      TestBed.resetTestingModule();
      const { el } = await mount([1, 2, 3, 4].slice(0, count).map(n => letter(n)));
      const ask = el.querySelector<HTMLAnchorElement>('.foot a.ask');
      expect(ask?.getAttribute('href')).toBe('/home');
      expect(ask?.textContent?.trim()).toBe('ask me something on Home ›');
    }
  });

  it('counts letters in words', () => {
    expect(letterCountLabel(0)).toBe('empty, for now');
    expect(letterCountLabel(1)).toBe('1 letter');
    expect(letterCountLabel(12)).toBe('12 letters');
  });
});
