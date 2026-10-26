import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { existsSync } from 'node:fs';
import { BackgroundPageComponent } from './background-page.component';

describe('BackgroundPageComponent', () => {
  let fixture: ComponentFixture<BackgroundPageComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackgroundPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BackgroundPageComponent);
    await fixture.whenStable();
  });

  it('has exactly one h1, from the page header', () => {
    const headings = el().querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent?.trim()).toBe('Background');
  });

  it('captions the Ada image with the cat sentence', () => {
    const figure = el().querySelector('figure');
    expect(figure?.querySelector('img')?.getAttribute('alt')).toBe('Ada the cat, with the caption: Do it for her');
    expect(figure?.querySelector('figcaption')?.textContent?.trim())
      .toBe('Also I have a cat named Ada! She is both the light of my life, as well as the bane of my existence.');
  });

  it('every image in the srcset exists in public/', () => {
    const srcset = el().querySelector('figure img')?.getAttribute('srcset') ?? '';
    const files = srcset.split(',').map(entry => entry.trim().split(/\s+/)[0]);
    expect(files.length).toBe(2);
    for (const file of files) {
      expect(existsSync(`public/${file}`), file).toBe(true);
    }
  });

  it('lists the other notable experiences', () => {
    expect(el().querySelectorAll('.experiences li').length).toBe(5);
  });
});
