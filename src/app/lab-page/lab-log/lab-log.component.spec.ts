import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LabLogComponent } from './lab-log.component';
import { LAB_LOG, LAB_LOG_TAIL } from '../../../shared/constants/lab-log.const';

describe('LabLogComponent', () => {
  let fixture: ComponentFixture<LabLogComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const lines = () => [...el().querySelectorAll<HTMLLIElement>('.lines li')];
  const texts = () => lines().map(li => li.textContent?.trim());
  const more = () => el().querySelector<HTMLButtonElement>('button.more');
  const count = () => el().querySelector('.count')?.textContent?.trim();

  async function render(entries?: readonly string[], tail?: number) {
    await TestBed.configureTestingModule({ imports: [LabLogComponent] }).compileComponents();
    fixture = TestBed.createComponent(LabLogComponent);
    if (entries) fixture.componentRef.setInput('entries', entries);
    if (tail !== undefined) fixture.componentRef.setInput('tail', tail);
    await fixture.whenStable();
  }

  const twelve = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`);

  it('shows the real log\'s tail by default, oldest first and the newest last', async () => {
    await render();
    expect(texts()).toEqual(LAB_LOG.slice(-LAB_LOG_TAIL));
    expect(texts().at(-1)).toBe(LAB_LOG.at(-1));
    expect(count()).toBe(`the last ${LAB_LOG_TAIL} of ${LAB_LOG.length}`);
  });

  it('fades the two oldest lines on screen, like lines scrolled up to', async () => {
    await render(twelve, 8);
    const fades = lines().map(li => li.style.getPropertyValue('--fade'));
    expect(fades.slice(0, 2)).toEqual(['0.4', '0.6']);
    expect(fades.slice(2).every(f => f === '')).toBe(true);
  });

  it('unfolds the whole log in place and folds it again, saying which it is', async () => {
    await render(twelve, 8);
    expect(texts()).toEqual(twelve.slice(4));
    const button = more()!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('lab-log-lines');
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('[ the whole log › ]');

    button.click();
    await fixture.whenStable();
    expect(texts()).toEqual(twelve);
    expect(more()!.getAttribute('aria-expanded')).toBe('true');
    expect(more()!.textContent?.replace(/\s+/g, ' ').trim()).toBe('[ just the latest › ]');
    expect(count()).toBe('12 entries');

    more()!.click();
    await fixture.whenStable();
    expect(texts()).toEqual(twelve.slice(4));
    expect(count()).toBe('the last 8 of 12');
  });

  it('offers no unfolding when the log fits, and counts what there is', async () => {
    await render(['one', 'two', 'three'], 8);
    expect(texts()).toEqual(['one', 'two', 'three']);
    expect(more()).toBeNull();
    expect(count()).toBe('3 entries');
    expect(lines().map(li => li.style.getPropertyValue('--fade'))).toEqual(['0.4', '0.6', '']);

    fixture.componentRef.setInput('entries', ['one']);
    await fixture.whenStable();
    expect(count()).toBe('1 entry');
    expect(lines()[0].style.getPropertyValue('--fade')).toBe('');
  });

  it('keeps the prompt, the resting line and the caret decorative; the entries are a plain list', async () => {
    await render();
    expect(el().querySelector('.cmd')?.getAttribute('aria-hidden')).toBe('true');
    expect(el().querySelector('.resting')?.getAttribute('aria-hidden')).toBe('true');
    expect(el().querySelector('.resting .caret')).not.toBeNull();
    expect(el().querySelector('ol.lines')?.getAttribute('aria-hidden')).toBeNull();
    expect(el().querySelector('h2#lab-log')?.textContent).toContain('Lab log');
    // No dates anywhere in the log: the order carries it.
    expect(el().querySelector('time')).toBeNull();
    expect(el().querySelector('.lines')?.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
