import { TestBed } from '@angular/core/testing';
import { CINCINNATI, SKY_LOCATION_KEY, SkyService, parseStoredLocation } from './sky.service';
import { parseSkyAt } from './sky.component';

describe('SkyService', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to Cincinnati without touching geolocation', () => {
    const getCurrentPosition = vi.fn();
    vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({ getCurrentPosition } as unknown as Geolocation);
    const service = TestBed.inject(SkyService);
    expect(service.location()).toEqual(CINCINNATI);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('restores a remembered location without asking again', () => {
    localStorage.setItem(SKY_LOCATION_KEY, JSON.stringify({ lat: 51.5, lon: -0.1 }));
    const getCurrentPosition = vi.fn();
    vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({ getCurrentPosition } as unknown as Geolocation);
    const service = TestBed.inject(SkyService);
    expect(service.location()).toEqual({ lat: 51.5, lon: -0.1, mine: true });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('show my sky asks once, rounds, remembers; back to Cincinnati forgets', () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: 47.6062, longitude: -122.3321 } } as GeolocationPosition));
    vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({ getCurrentPosition } as unknown as Geolocation);
    const service = TestBed.inject(SkyService);

    service.showMine();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(service.location()).toEqual({ lat: 47.6, lon: -122.3, mine: true });
    expect(JSON.parse(localStorage.getItem(SKY_LOCATION_KEY)!)).toEqual({ lat: 47.6, lon: -122.3 });
    expect(service.status()).toBe('idle');

    service.showCincinnati();
    expect(service.location()).toEqual(CINCINNATI);
    expect(localStorage.getItem(SKY_LOCATION_KEY)).toBeNull();
  });

  it('a refused location leaves Cincinnati and says so', () => {
    const getCurrentPosition = vi.fn((_: PositionCallback, error: PositionErrorCallback) => error({} as GeolocationPositionError));
    vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({ getCurrentPosition } as unknown as Geolocation);
    const service = TestBed.inject(SkyService);
    service.showMine();
    expect(service.location()).toEqual(CINCINNATI);
    expect(service.status()).toBe('failed');
    expect(localStorage.getItem(SKY_LOCATION_KEY)).toBeNull();
  });

  it('ignores malformed stored locations', () => {
    expect(parseStoredLocation(null)).toBeNull();
    expect(parseStoredLocation('not json')).toBeNull();
    expect(parseStoredLocation('{"lat":"39","lon":-84}')).toBeNull();
    expect(parseStoredLocation('{"lat":95,"lon":0}')).toBeNull();
    expect(parseStoredLocation('{"lat":39.1,"lon":-84.5}')).toEqual({ lat: 39.1, lon: -84.5, mine: true });
  });
});

describe('parseSkyAt', () => {
  it('reads ?sky-at= and ignores anything invalid', () => {
    expect(parseSkyAt('?sky-at=2026-01-15T04:00:00Z')?.toISOString()).toBe('2026-01-15T04:00:00.000Z');
    expect(parseSkyAt('?sky-at=tuesday')).toBeNull();
    expect(parseSkyAt('')).toBeNull();
  });
});
