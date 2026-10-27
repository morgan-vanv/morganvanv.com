import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ApiCacheService } from '../../services/api-cache.service';
import { WeatherBadgeComponent, WEATHER_URL } from './weather-badge.component';
import { CurrentWeather, describeWeather, isClear, parseWeather, verdict } from './weather';

describe('WeatherBadgeComponent', () => {
  const clearNight = { current: { temperature_2m: 47.6, cloud_cover: 12, weather_code: 1, is_day: 0 } };

  async function render(response: Observable<unknown>) {
    const get = vi.fn((url: string, ttl: number) => { void url; void ttl; return response; });
    TestBed.configureTestingModule({ providers: [{ provide: ApiCacheService, useValue: { get } }] });
    const fixture = TestBed.createComponent(WeatherBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { get, el, badge: el.querySelector('a.badge') };
  }

  it('asks Open-Meteo about Cincinnati, in Fahrenheit', async () => {
    const { get } = await render(of(clearNight));
    expect(get).toHaveBeenCalledWith(WEATHER_URL, expect.any(Number));
    const url = new URL(WEATHER_URL);
    expect(url.hostname).toBe('api.open-meteo.com');
    expect([url.searchParams.get('latitude'), url.searchParams.get('longitude')]).toEqual(['39.1', '-84.51']);
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit');
  });

  it('shows the temperature and the sky, and says it all in its name', async () => {
    const { el, badge } = await render(of(clearNight));
    expect([...el.querySelectorAll('.value span')].map(s => s.textContent?.trim())).toEqual(['48°F', 'clear']);
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('Cincinnati');
    expect(badge?.getAttribute('aria-label')).toBe(
      'Cincinnati weather right now: mostly clear, 48°F, 12% cloud cover. Opens the National Weather Service forecast in a new tab.',
    );
    expect(el.querySelector('.popover-note')?.textContent).toBe('clear enough to go look up');
    // Clear: stars only, no cloud.
    expect(el.querySelector('svg path')).toBeNull();
  });

  it('draws a cloud when it is not clear', async () => {
    const { el } = await render(of({ current: { ...clearNight.current, cloud_cover: 95, weather_code: 3 } }));
    expect(el.querySelector('.value')?.textContent).toContain('cloudy');
    expect(el.querySelector('svg path')).not.toBeNull();
  });

  it('hides when Open-Meteo fails', async () => {
    expect((await render(throwError(() => new Error('offline')))).badge).toBeNull();
  });
});

describe('the weather helpers', () => {
  const at = (over: Partial<CurrentWeather>): CurrentWeather => ({ temperature_2m: 50, cloud_cover: 0, weather_code: 0, is_day: 0, ...over });

  it('keep only a well-formed current block', () => {
    expect(parseWeather({ current: at({}) })).toEqual(at({}));
    expect(parseWeather({ current: { temperature_2m: 'warm' } })).toBeNull();
    expect(parseWeather({ current: at({ cloud_cover: 140 }) })).toBeNull();
    expect(parseWeather(null)).toBeNull();
  });

  it('put WMO codes into words, long and short', () => {
    expect(describeWeather(0)).toEqual({ long: 'clear', short: 'clear' });
    expect(describeWeather(2)).toEqual({ long: 'partly cloudy', short: 'partly' });
    expect(describeWeather(3)).toEqual({ long: 'overcast', short: 'cloudy' });
    expect(describeWeather(45).short).toBe('fog');
    expect(describeWeather(53).short).toBe('drizzle');
    expect(describeWeather(63).short).toBe('rain');
    expect(describeWeather(81).short).toBe('rain');
    expect(describeWeather(73).short).toBe('snow');
    expect(describeWeather(95).long).toBe('thunderstorms');
    expect(describeWeather(30).short).toBe('mixed');
  });

  it('call it clear only with few clouds and nothing falling, and only give a verdict after dark', () => {
    expect(isClear(at({ cloud_cover: 30, weather_code: 2 }))).toBe(true);
    expect(isClear(at({ cloud_cover: 31 }))).toBe(false);
    expect(isClear(at({ cloud_cover: 5, weather_code: 61 }))).toBe(false);
    expect(verdict(at({ cloud_cover: 90, weather_code: 3 }))).toBe('the clouds win tonight');
    expect(verdict(at({ is_day: 1 }))).toBe('ask again after dark');
  });
});
