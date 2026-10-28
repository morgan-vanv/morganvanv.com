import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SiteStripComponent, odometer } from './site-strip.component';
import { CampfireService } from '../services/campfire.service';

describe('odometer', () => {
  it('pads to six wheels and grows past them', () => {
    expect(odometer(4213)).toEqual(['0', '0', '4', '2', '1', '3']);
    expect(odometer(1234567)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });
});

describe('SiteStripComponent', () => {
  const visitors = signal<number | null>(null);

  beforeEach(() => {
    visitors.set(null);
    TestBed.configureTestingModule({ providers: [{ provide: CampfireService, useValue: { visitors, configured: true } }] });
  });

  async function render() {
    const fixture = TestBed.createComponent(SiteStripComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('says nothing about visitors until the campfire has the count', async () => {
    expect((await render()).querySelector('.visitors')).toBeNull();
  });

  it('then says which visitor you are, as odometer wheels, give or take', async () => {
    visitors.set(4213);
    const el = await render();
    const line = el.querySelector('.visitors')!;
    expect(line.querySelector('.visually-hidden')?.textContent?.trim()).toBe('You are visitor 4,213, give or take.');
    expect([...line.querySelectorAll('.wheel')].map(w => w.textContent)).toEqual(['0', '0', '4', '2', '1', '3']);
    expect(line.querySelector('.wheel.last')?.textContent).toBe('3');
    // The counter isn't part of the webring's navigation.
    expect(el.querySelector('nav.ring .visitors')).toBeNull();
  });

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
