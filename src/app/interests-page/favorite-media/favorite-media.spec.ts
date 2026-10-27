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
  { id: 'book-a', kind: 'book', title: 'Book A', blurb: 'another' },
];

describe('FAVORITE_MEDIA', () => {
  it('holds four picks per shelf (or none yet): the shelves are 2×2 grids', () => {
    for (const { kind } of MEDIA_SHELVES) {
      const count = FAVORITE_MEDIA.filter(item => item.kind === kind).length;
      expect([0, PICKS_PER_SHELF], `${kind} has ${count} picks`).toContain(count);
    }
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
    expect(headings).toEqual(['Films 2 picks', 'Books 1 pick']);
    expect([...el().querySelectorAll('.shelf-tab')].map(b => b.textContent?.trim())).toEqual(['Films', 'Books']);
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
    expect(tabs().map(t => t.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(active()).toEqual(['media-shelf-film']);
    tabs()[1].click();
    await fixture.whenStable();
    expect(tabs().map(t => t.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(active()).toEqual(['media-shelf-book']);
    expect(tabs()[1].getAttribute('aria-controls')).toBe('media-shelf-book');
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
