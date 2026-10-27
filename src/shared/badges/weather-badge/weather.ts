/** What Open-Meteo's `current` block holds, for the fields the weather badge asks for. */
export interface CurrentWeather {
  temperature_2m: number;
  cloud_cover: number;
  weather_code: number;
  is_day: number;
}

/** Open-Meteo's answer down to its `current` block, or null if it isn't one. */
export function parseWeather(response: unknown): CurrentWeather | null {
  const c = (response as { current?: CurrentWeather } | null)?.current;
  const numbers = !!c && [c.temperature_2m, c.cloud_cover, c.weather_code, c.is_day].every(n => typeof n === 'number' && Number.isFinite(n));
  return numbers && c.cloud_cover >= 0 && c.cloud_cover <= 100 ? c : null;
}

/** A WMO weather code (what Open-Meteo reports) as words: the long form, and a short one for the face. */
export function describeWeather(code: number): { long: string; short: string } {
  if (code <= 1) return { long: code === 0 ? 'clear' : 'mostly clear', short: 'clear' };
  if (code === 2) return { long: 'partly cloudy', short: 'partly' };
  if (code === 3) return { long: 'overcast', short: 'cloudy' };
  if (code === 45 || code === 48) return { long: 'fog', short: 'fog' };
  if (code >= 51 && code <= 57) return { long: 'drizzle', short: 'drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { long: 'rain', short: 'rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { long: 'snow', short: 'snow' };
  if (code >= 95) return { long: 'thunderstorms', short: 'storms' };
  return { long: 'mixed', short: 'mixed' };
}

/** Clear enough to bother with a telescope: few clouds and nothing falling. */
export function isClear(weather: CurrentWeather): boolean {
  return weather.cloud_cover <= 30 && weather.weather_code <= 2;
}

/** The popover's one-line verdict. Drafts in Morgan's voice. */
export function verdict(weather: CurrentWeather): string {
  if (weather.is_day) return 'ask again after dark';
  return isClear(weather) ? 'clear enough to go look up' : 'the clouds win tonight';
}
