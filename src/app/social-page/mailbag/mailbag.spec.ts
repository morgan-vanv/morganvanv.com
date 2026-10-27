import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MAILBAG_TOKEN, MailbagComponent, NEWEST_SHOWN, letterCountLabel } from './mailbag';
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

const visible = (el: HTMLElement) => [...el.querySelectorAll<HTMLLIElement>('.letter')].filter(li => !li.hidden);

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
    expect(el.querySelector('.older-toggle')).toBeNull();
  });

  it('shows each letter: the question as a quote, the answer, the date asked', async () => {
    const { el } = await mount([letter(1, 'why the cat?\nreally?', renderAnswer('Because *Ada*. See [now](/now).'))]);
    expect(el.querySelector('.range-label')?.textContent?.trim()).toBe('1 letter');
    const item = el.querySelector('.letter')!;
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

  it(`shows the newest ${NEWEST_SHOWN}, with the rest behind "older letters"`, async () => {
    const letters = [1, 2, 3, 4, 5].map(n => letter(n));
    const { fixture, el } = await mount(letters);
    expect(el.querySelector('.range-label')?.textContent?.trim()).toBe('5 letters');
    // Every letter is in the page (prerendered), the older ones hidden.
    expect(el.querySelectorAll('.letter').length).toBe(5);
    expect(visible(el).map(li => li.querySelector('.question')?.textContent)).toEqual(['question 1?', 'question 2?', 'question 3?']);

    const toggle = el.querySelector<HTMLButtonElement>('.older-toggle')!;
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.getAttribute('aria-controls')).toBe('mailbag-letters');
    expect(el.querySelector('#mailbag-letters')).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent?.trim()).toBe('older letters (2)');

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent?.trim()).toBe('fewer letters');
    expect(visible(el).length).toBe(5);

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(visible(el).length).toBe(3);
  });

  it(`has no toggle with ${NEWEST_SHOWN} letters or fewer`, async () => {
    const { el } = await mount([1, 2, 3].map(n => letter(n)));
    expect(visible(el).length).toBe(3);
    expect(el.querySelector('.older-toggle')).toBeNull();
  });

  it('counts letters in words', () => {
    expect(letterCountLabel(0)).toBe('empty, for now');
    expect(letterCountLabel(1)).toBe('1 letter');
    expect(letterCountLabel(12)).toBe('12 letters');
  });
});
