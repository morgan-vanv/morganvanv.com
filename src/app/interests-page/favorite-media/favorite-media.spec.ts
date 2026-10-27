import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FavoriteMediaComponent } from './favorite-media';
import { FAVORITE_MEDIA, FavoriteMedia, MEDIA_SHELVES, PICKS_PER_SHELF } from '../../../shared/constants/favorite-media.const';
import { LETTERBOXD_DIARY_URL } from '../../../shared/letterboxd/letterboxd.service';

// Placeholders in the shape Morgan's picks will take; the real ones live in the constant.
const PICKS: FavoriteMedia[] = [
  { id: 'film-a', kind: 'film', title: 'Film A', blurb: 'a short blurb', cover: '/media/film-a.webp', href: 'https://letterboxd.com/film/a/' },
  { id: 'film-b', kind: 'film', title: 'Film B' },
  { id: 'book-a', kind: 'book', title: 'Book A', by: 'An Author', blurb: 'another' },
  { id: 'album-a', kind: 'album', title: 'Album A', by: 'An Artist', cover: '/media/album-a.webp' },
];

/** A webp's [width, height], from its VP8/VP8L/VP8X header. */
function webpSize(data: Uint8Array): [number, number] | null {
  const tag = String.fromCharCode(...data.slice(12, 16));
  const u24 = (at: number) => data[at] | data[at + 1] << 8 | data[at + 2] << 16;
  if (tag === 'VP8X') return [u24(24) + 1, u24(27) + 1];
  if (tag === 'VP8L') {
    const bits = data[21] | data[22] << 8 | data[23] << 16 | data[24] << 24;
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  if (tag === 'VP8 ') return [(data[26] | data[27] << 8) & 0x3fff, (data[28] | data[29] << 8) & 0x3fff];
  return null;
}

describe('FAVORITE_MEDIA', () => {
  it('holds at most four picks per shelf', () => {
    for (const { kind } of MEDIA_SHELVES) {
      const count = FAVORITE_MEDIA.filter(item => item.kind === kind).length;
      expect(count, `${kind} has ${count} picks`).toBeLessThanOrEqual(PICKS_PER_SHELF);
    }
  });

  it('names who made every book and album', () => {
    for (const item of FAVORITE_MEDIA.filter(pick => pick.kind === 'book' || pick.kind === 'album')) {
      expect(item.by, item.title).toBeTruthy();
    }
  });

  it('has every cover it names in public/media, at its shelf\'s size, and no orphaned files', () => {
    const files = existsSync('public/media') ? readdirSync('public/media') : [];
    for (const item of FAVORITE_MEDIA.filter(pick => pick.cover)) {
      const file = `public${item.cover}`;
      expect(existsSync(file), `${file} is missing (scripts/build-media-covers.py)`).toBe(true);
      expect(webpSize(readFileSync(file)), item.id).toEqual(item.kind === 'album' ? [400, 400] : [400, 600]);
    }
    const named = new Set(FAVORITE_MEDIA.map(pick => pick.cover?.replace('/media/', '')));
    expect(files.filter(file => !named.has(file)), 'covers no pick uses').toEqual([]);
  });

  it('gives every pick a unique id, and covers where the id says', () => {
    const ids = FAVORITE_MEDIA.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of FAVORITE_MEDIA) {
      if (item.cover) expect(item.cover).toBe(`/media/${item.id}.webp`);
    }
  });
});

describe('FavoriteMediaComponent', () => {
  let fixture: ComponentFixture<FavoriteMediaComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(FavoriteMediaComponent);
    http = TestBed.inject(HttpTestingController);
  });

  async function render(items: readonly FavoriteMedia[]) {
    fixture.componentRef.setInput('items', items);
    await fixture.whenStable();
  }

  it('reads the constant by default', () => {
    expect(fixture.componentInstance.items()).toBe(FAVORITE_MEDIA);
  });

  it('shows only the shelves that have something on them, in order, with counts', async () => {
    await render(PICKS);
    const headings = [...el().querySelectorAll('.shelf h3')].map(h => h.textContent?.replace(/\s+/g, ' ').trim());
    expect(headings).toEqual(['Films 2 picks', 'Books 1 pick', 'Albums 1 pick']);
    expect([...el().querySelectorAll('.shelf-tab')].map(b => b.textContent?.trim())).toEqual(['Films', 'Books', 'Albums']);
  });

  it('is a cover, a title and a short blurb; linked when it has somewhere to go', async () => {
    await render(PICKS);
    const cards = [...el().querySelectorAll('.media-card')];
    expect(cards[0].tagName).toBe('A');
    expect(cards[0].getAttribute('href')).toBe('https://letterboxd.com/film/a/');
    expect(cards[0].getAttribute('target')).toBe('_blank');
    const cover = cards[0].querySelector('img.cover');
    expect(cover?.getAttribute('loading')).toBe('lazy');
    expect(cover?.getAttribute('alt')).toBe('');
    expect([...cards[0].children].map(c => c.className)).toEqual(['cover', 'media-title', 'media-blurb']);
    expect(cards[0].querySelector('.media-blurb')?.textContent).toBe('a short blurb');
  });

  it('names who made a book or album under its title, and draws albums square', async () => {
    await render(PICKS);
    const book = [...el().querySelectorAll('.media-card')].find(c => c.textContent?.includes('Book A'))!;
    expect([...book.children].map(c => c.className)).toEqual(['cover cover--type', 'media-title', 'media-by', 'media-blurb']);
    expect(book.querySelector('.media-by')?.textContent).toBe('An Author');
    expect(el().querySelector('#media-shelf-album')?.classList).toContain('shelf--square');
    expect(el().querySelector('#media-shelf-album img.cover')?.getAttribute('height')).toBe('400');
    expect(el().querySelector('#media-shelf-film img.cover')?.getAttribute('height')).toBe('600');
  });

  it('keeps the rest of a short shelf as blank slots, hidden from screen readers', async () => {
    await render(PICKS);
    const slots = (kind: string) => el().querySelectorAll(`#media-shelf-${kind} .media-slot`);
    expect(slots('film').length).toBe(2);
    expect(slots('book').length).toBe(3);
    expect([...slots('book')].every(slot => slot.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(el().querySelectorAll('#media-shelf-book li').length).toBe(4);
  });

  it('sets the title in type when there is no cover, and skips a missing blurb', async () => {
    await render(PICKS);
    const card = el().querySelectorAll('.media-card')[1];
    expect(card.tagName).toBe('DIV');
    expect(card.querySelector('.cover--type')?.getAttribute('aria-hidden')).toBe('true');
    expect(card.querySelector('.media-blurb')).toBeNull();
  });

  it('switches the shelf shown on small screens with toggle buttons', async () => {
    await render(PICKS);
    const tabs = () => [...el().querySelectorAll<HTMLButtonElement>('.shelf-tab')];
    const active = () => [...el().querySelectorAll('.shelf.is-active')].map(s => s.id);
    expect(tabs().map(t => t.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(active()).toEqual(['media-shelf-film']);
    tabs()[1].click();
    await fixture.whenStable();
    expect(tabs().map(t => t.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(active()).toEqual(['media-shelf-book']);
    expect(tabs()[1].getAttribute('aria-controls')).toBe('media-shelf-book');
  });

  it('lays shelves out two across at most', async () => {
    await render(PICKS);
    expect((el().querySelector('.shelves') as HTMLElement).style.getPropertyValue('--shelf-columns')).toBe('2');
    await render([PICKS[2]]);
    expect((el().querySelector('.shelves') as HTMLElement).style.getPropertyValue('--shelf-columns')).toBe('1');
  });

  it('needs no toggles for one shelf, and shows no wall at all with no picks', async () => {
    await render([PICKS[2]]);
    expect(el().querySelector('.shelf-tabs')).toBeNull();
    expect(el().querySelectorAll('.shelf').length).toBe(1);
    await render([]);
    expect(el().querySelector('.shelves')).toBeNull();
  });

  it('asks for the Letterboxd diary once, for the feed below the wall', async () => {
    await render(PICKS);
    expect(http.match(r => r.url === LETTERBOXD_DIARY_URL).length).toBe(1);
  });
});
