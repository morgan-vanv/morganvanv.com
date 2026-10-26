import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { ApiCacheService } from '../../services/api-cache.service';
import { SITE_CONFIG } from '../../config/site.config';
import { CINCINNATI } from '../../sky/sky.service';
import { CurrentWeather, describeWeather, isClear, isCurrentWeather, verdict } from './weather';

export const WEATHER_URL = `${SITE_CONFIG.weatherApiUrl}?latitude=${CINCINNATI.lat}&longitude=${CINCINNATI.lon}` +
  '&current=temperature_2m,cloud_cover,weather_code,is_day&temperature_unit=fahrenheit&timezone=America%2FNew_York';
const WEATHER_TTL_MS = 30 * 60 * 1000;

/**
 * The weather in Cincinnati right now, with an eye on the sky: is it clear enough to go look up?
 * Open-Meteo, cached for half an hour. Hides if it doesn't answer.
 */
@Component({
  selector: 'app-weather-badge',
  imports: [BadgeComponent],
  templateUrl: './weather-badge.component.html',
  styleUrl: './weather-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeatherBadgeComponent {
  private readonly api = inject(ApiCacheService);
  readonly href = SITE_CONFIG.forecastPageUrl;

  private readonly current = toSignal(
    this.api.get<{ current?: unknown }>(WEATHER_URL, WEATHER_TTL_MS).pipe(
      map(response => (isCurrentWeather(response?.current) ? response.current : null)),
      catchError(() => of(null)),
    ),
    { initialValue: null as CurrentWeather | null },
  );

  readonly weather = computed(() => {
    const now = this.current();
    if (!now) return null;
    const temp = `${Math.round(now.temperature_2m)}°F`;
    const sky = describeWeather(now.weather_code);
    const clouds = `${Math.round(now.cloud_cover)}%`;
    return {
      value: [temp, sky.short],
      clear: isClear(now),
      popover: {
        title: 'Clear skies?',
        rows: [
          { label: 'Sky', value: sky.long },
          { label: 'Cloud cover', value: clouds },
          { label: 'Temperature', value: temp },
        ],
        note: verdict(now),
        cta: 'the full forecast ↗',
      } satisfies BadgePopover,
      label: `The weather in Cincinnati right now: ${sky.long}, ${temp}, ${clouds} cloud cover. ` +
        'Opens the National Weather Service forecast in a new tab.',
    };
  });
}
