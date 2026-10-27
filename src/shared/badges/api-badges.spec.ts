import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ApiCacheService } from '../services/api-cache.service';
import { WeatherBadgeComponent, WEATHER_URL } from './weather-badge/weather-badge.component';
import { VinylBadgeComponent, VINYL_URL, toShelf } from './vinyl-badge/vinyl-badge.component';
import { describeWeather, verdict } from './weather-badge/weather';

async function render<T>(component: Type<T>, response: Observable<unknown>) {
  const get = vi.fn((url: string, ttl: number) => { void url; void ttl; return response; });
  TestBed.configureTestingModule({ imports: [component], providers: [{ provide: ApiCacheService, useValue: { get } }] });
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { get, el, badge: el.querySelector('a.badge') };
}

describe('the weather badge', () => {
  const night = { current: { temperature_2m: 47.6, cloud_cover: 12, weather_code: 1, is_day: 0 } };

  it('asks Open-Meteo about Cincinnati, in Fahrenheit', async () => {
    const { get } = await render(WeatherBadgeComponent, of(night));
    const url = new URL(get.mock.calls[0][0]);
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('39.1');
    expect(url.searchParams.get('longitude')).toBe('-84.51');
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit');
    expect(get).toHaveBeenCalledWith(WEATHER_URL, expect.any(Number));
  });

  it('shows the temperature and the sky, and says it all in its name', async () => {
    const { el, badge } = await render(WeatherBadgeComponent, of(night));
    expect([...el.querySelectorAll('.value span')].map(s => s.textContent?.trim())).toEqual(['48°F', 'clear']);
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('Cincinnati');
    expect(badge?.getAttribute('aria-label')).toBe(
      'Cincinnati weather right now: mostly clear, 48°F, 12% cloud cover. Opens the National Weather Service forecast in a new tab.',
    );
    expect(el.querySelector('.popover-note')?.textContent).toBe('clear enough to go look up');
  });

  it('hides when Open-Meteo fails or answers nonsense', async () => {
    expect((await render(WeatherBadgeComponent, throwError(() => new Error('offline')))).badge).toBeNull();
    TestBed.resetTestingModule();
    expect((await render(WeatherBadgeComponent, of({ current: { temperature_2m: 'warm' } }))).badge).toBeNull();
  });

  it('describes the sky in words and gives a verdict', () => {
    expect(describeWeather(3)).toEqual({ long: 'overcast', short: 'cloudy' });
    expect(describeWeather(63).short).toBe('rain');
    expect(describeWeather(95).long).toBe('thunderstorms');
    expect(verdict({ temperature_2m: 50, cloud_cover: 90, weather_code: 3, is_day: 0 })).toBe('the clouds win tonight');
    expect(verdict({ temperature_2m: 50, cloud_cover: 0, weather_code: 0, is_day: 1 })).toBe('ask again after dark');
  });
});

describe('the vinyl badge', () => {
  const page = {
    pagination: { items: 312 },
    releases: [{ basic_information: { title: 'Things We Lost in the Fire', artists: [{ name: 'Low (2)' }] } }],
  };

  it('counts the collection and names the newest record, from one request', async () => {
    const { get, el, badge } = await render(VinylBadgeComponent, of(page));
    expect(get).toHaveBeenCalledWith(VINYL_URL, expect.any(Number));
    expect(new URL(VINYL_URL).searchParams.get('sort')).toBe('added');
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('Vinyl Collection');
    expect(el.querySelector('.name')?.classList).toContain('long');
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('312 records');
    expect(badge?.getAttribute('aria-label')).toContain('newest: Things We Lost in the Fire — Low');
    expect(badge?.getAttribute('href')).toBe('https://www.discogs.com/user/morganvanv/collection');
  });

  it('hides when Discogs says no (a private collection) or has nothing', async () => {
    expect((await render(VinylBadgeComponent, throwError(() => new Error('403')))).badge).toBeNull();
    expect(toShelf({ pagination: { items: 0 }, releases: [] })).toBeNull();
    expect(toShelf(null)).toBeNull();
    expect(toShelf({ pagination: { items: 3 } })).toEqual({ count: 3, newest: null });
  });
});
