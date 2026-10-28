import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ColophonPageComponent } from './colophon-page.component';
import { SITE_CONFIG } from '../../shared/config/site.config';

describe('ColophonPageComponent', () => {
  let fixture: ComponentFixture<ColophonPageComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColophonPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ColophonPageComponent);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('has one h1, from the page header', () => {
    const headings = el.querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent?.trim()).toBe('Colophon');
  });

  it('covers the stack, the live sources, the sky, the browser and thanks', () => {
    const sections = [...el.querySelectorAll('section h2')].map(h => h.textContent?.trim());
    expect(sections).toEqual(['Built with', "What's live", 'The sky', 'What stays in your browser', 'Thanks']);
  });

  it('links the source, humans.txt and the way back to Projects, and opens outside links in a new tab', () => {
    const links = [...el.querySelectorAll('.colophon-panels a, app-page-header a')];
    const hrefs = links.map(a => a.getAttribute('href'));
    expect(hrefs).toContain(SITE_CONFIG.repoUrl);
    expect(hrefs).toContain('/humans.txt');
    expect(hrefs).toContain('/projects');
    for (const a of links) {
      if (a.getAttribute('href')?.startsWith('http')) {
        expect(a.getAttribute('target'), a.getAttribute('href') ?? '').toBe('_blank');
        expect(a.getAttribute('rel'), a.getAttribute('href') ?? '').toContain('noopener');
      }
    }
  });
});
