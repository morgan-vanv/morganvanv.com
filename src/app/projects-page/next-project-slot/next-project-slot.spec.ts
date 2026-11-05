import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NextProjectSlotComponent, nextSlotSpan } from './next-project-slot';

describe('nextSlotSpan', () => {
  it('fills the rest of the last row of three, or the whole row when the projects fill theirs', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(n => nextSlotSpan(n, 3))).toEqual([2, 1, 3, 2, 1, 3, 2]);
  });
});

describe('NextProjectSlotComponent', () => {
  let fixture: ComponentFixture<NextProjectSlotComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NextProjectSlotComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(NextProjectSlotComponent);
    await fixture.whenStable();
  });

  it('is an empty poster, not a project: no heading, a decorative sign, a way to suggest one', () => {
    expect(el().querySelector('h2, h3')).toBeNull();
    expect(el().querySelector('.plate .name')?.textContent?.trim()).toBe('[ next project ]');
    expect(el().querySelector('.plate .subtitle')?.textContent?.trim()).toBe('not started');
    const sign = el().querySelector('.art img');
    expect(sign?.getAttribute('src')).toBe('/under-construction.gif');
    expect(sign?.getAttribute('alt')).toBe('');
    const link = el().querySelector('a.link');
    expect(link?.getAttribute('href')).toBe('/home#home-contact');
    expect(link?.textContent?.trim()).toBe('[ suggest one › ] (on the contact form)');
  });

  it('spans the columns it is given, and lies down as a strip across a whole row', async () => {
    fixture.componentRef.setInput('span', 1);
    await fixture.whenStable();
    expect(el().style.getPropertyValue('--slot-span')).toBe('1');
    expect(el().classList.contains('strip')).toBe(false);

    fixture.componentRef.setInput('span', 3);
    await fixture.whenStable();
    expect(el().style.getPropertyValue('--slot-span')).toBe('3');
    expect(el().classList.contains('strip')).toBe(true);
  });
});
