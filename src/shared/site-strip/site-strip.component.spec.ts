import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { SiteStripComponent } from './site-strip.component';

describe('SiteStripComponent', () => {
  async function render() {
    const fixture = TestBed.createComponent(SiteStripComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('links to the Hotline Webring neighbours without hiding where the click came from', async () => {
    const ring = (await render()).querySelector<HTMLElement>('nav.ring');
    expect(ring?.getAttribute('aria-label')).toBe('Hotline Webring');
    const links = [...ring!.querySelectorAll('a')];
    expect(links.map(a => a.getAttribute('href'))).toEqual([
      'https://hotlinewebring.club/morganvanv/previous',
      'https://hotlinewebring.club/',
      'https://hotlinewebring.club/morganvanv/next',
    ]);
    // Accessible names start with the visible words, so voice control can say "prev" and "next".
    const name = (a: Element) => a.textContent?.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
    expect(name(links[0])).toBe('‹ prev site in the Hotline Webring');
    expect(name(links[1])).toBe('hotline webring ↗ (opens in a new tab)');
    expect(name(links[2])).toBe('next site in the Hotline Webring ›');
    expect(links[1].getAttribute('target')).toBe('_blank');
    // The ring registers members from the Referer of the first click through.
    for (const link of links) {
      expect(link.getAttribute('rel') ?? '').not.toContain('noreferrer');
    }
    expect(readFileSync('src/index.html', 'utf8')).toMatch(
      /<meta name="referrer" content="strict-origin-when-cross-origin">/,
    );
  });
});
