import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CopyButtonComponent } from './copy-button.component';
import { COPIED_FOR_MS } from './copy-text';

describe('CopyButtonComponent', () => {
  let fixture: ComponentFixture<CopyButtonComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await new Promise(resolve => setTimeout(resolve));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    fixture = TestBed.createComponent(CopyButtonComponent);
    fixture.componentRef.setInput('value', 'mc.example');
    fixture.componentRef.setInput('label', 'Copy the address mc.example');
    await fixture.whenStable();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
    vi.useRealTimers();
  });

  it('is a real button, named for what it copies, saying "copy" at rest', () => {
    const button = el().querySelector('button')!;
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Copy the address mc.example');
    expect(button.textContent?.trim()).toBe('copy');
    expect(el().querySelector('[role=status]')?.textContent).toBe('');
  });

  it('is normal size unless asked to be small', async () => {
    expect(el().querySelector('button')?.classList.contains('small')).toBe(false);
    fixture.componentRef.setInput('size', 'small');
    await fixture.whenStable();
    expect(el().querySelector('button')?.classList.contains('small')).toBe(true);
  });

  it('copies the value, says so for a moment, then goes back to its words', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    el().querySelector('button')!.click();
    await settle();
    expect(writeText).toHaveBeenCalledWith('mc.example');
    expect(el().querySelector('button')?.textContent?.trim()).toBe('copied');
    expect(el().querySelector('[role=status]')?.textContent).toBe('Copied mc.example.');
    await new Promise(resolve => setTimeout(resolve, COPIED_FOR_MS + 50));
    await fixture.whenStable();
    expect(el().querySelector('button')?.textContent?.trim()).toBe('copy');
    expect(el().querySelector('[role=status]')?.textContent).toBe('');
  });

  it('says to copy it by hand, and gives the value, when the browser won\'t', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
    el().querySelector('button')!.click();
    await settle();
    expect(el().querySelector('button')?.textContent?.trim()).toBe('copy it by hand');
    expect(el().querySelector('[role=status]')?.textContent).toBe('Couldn\'t copy. The address is mc.example.');
  });
});
