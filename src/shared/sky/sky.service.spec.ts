import { TestBed } from '@angular/core/testing';
import { CINCINNATI, LOCATE_GIVE_UP_MS, SKY_LIGHTING_KEY, SKY_LOCATION_KEY, SkyService, parseStoredLocation } from './sky.service';
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

describe('SkyService edge cases', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = TestBed.inject(SkyService);
    expect(service.location()).toEqual(CINCINNATI);
    expect(() => service.showCincinnati()).not.toThrow();
  });

  it('gives up if the browser never answers', () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({ getCurrentPosition: vi.fn() } as unknown as Geolocation);
    const service = TestBed.inject(SkyService);
    service.showMine();
    expect(service.status()).toBe('locating');
    vi.advanceTimersByTime(LOCATE_GIVE_UP_MS);
    expect(service.status()).toBe('failed');
    expect(service.location()).toEqual(CINCINNATI);
  });

  it('cancelling ignores a late answer', () => {
    let answer: PositionCallback = () => undefined;
    const getCurrentPosition = vi.fn((success: PositionCallback) => (answer = success));
    vi.spyOn(navigator, 'geolocation', 'get').mockReturnValue({ getCurrentPosition } as unknown as Geolocation);
    const service = TestBed.inject(SkyService);
    service.showMine();
    service.showCincinnati();
    answer({ coords: { latitude: 10, longitude: 10 } } as GeolocationPosition);
    expect(service.location()).toEqual(CINCINNATI);
    expect(service.status()).toBe('idle');
    expect(localStorage.getItem(SKY_LOCATION_KEY)).toBeNull();
  });
});

describe('SkyService lighting', () => {
  afterEach(() => localStorage.clear());

  it('defaults to darkness and remembers any other choice', () => {
    const service = TestBed.inject(SkyService);
    expect(service.lighting()).toBe('darkness');
    service.setLighting('sunset');
    expect(localStorage.getItem(SKY_LIGHTING_KEY)).toBe('sunset');
    service.setLighting('darkness');
    expect(localStorage.getItem(SKY_LIGHTING_KEY)).toBeNull();
  });

  it('restores a stored choice and ignores junk', () => {
    localStorage.setItem(SKY_LIGHTING_KEY, 'day');
    expect(TestBed.inject(SkyService).lighting()).toBe('day');
    TestBed.resetTestingModule();
    localStorage.setItem(SKY_LIGHTING_KEY, 'noon-ish');
    expect(TestBed.inject(SkyService).lighting()).toBe('darkness');
  });

  describe('look up and name a star', () => {
    const star = (mag: number, ra = mag) => ({ ra, dec: 0, mag, v: [1, 0, 0] as const, near: 'Vega' });
    const [a, b, c] = [star(4.1, 1), star(3.2, 2), star(4.4, 3)];
    const onScreen = [{ star: a, x: 100, y: 100 }, { star: b, x: 200, y: 120 }, { star: c, x: 300, y: 90 }];

    it('looks up and comes back; leaving closes the naming panel too', () => {
      const service = TestBed.inject(SkyService);
      expect(service.lookingUp()).toBe(false);
      service.toggleLookUp();
      expect(service.lookingUp()).toBe(true);
      service.toggleLookUp();
      expect(service.lookingUp()).toBe(false);
      service.startNaming();
      expect(service.lookingUp()).toBe(true);
      expect(service.naming()).toBe(true);
      service.leaveLookUp();
      expect(service.lookingUp()).toBe(false);
      expect(service.naming()).toBe(false);
    });

    it('starting to name closes the ☾ menu and remembers what opened it', () => {
      const service = TestBed.inject(SkyService);
      const opener = document.createElement('button');
      service.menuOpen.set(true);
      service.startNaming(opener);
      expect(service.menuOpen()).toBe(false);
      expect(service.namingOpener).toBe(opener);
    });

    it('selects the brightest candidate, keeps a selection that\'s still on screen, and steps left to right', () => {
      const service = TestBed.inject(SkyService);
      service.startNaming();
      service.setCandidates(onScreen);
      expect(service.selected()).toBe(b);
      service.step(1);
      expect(service.selected()).toBe(c);
      service.setCandidates(onScreen.slice()); // redrawn: still there
      expect(service.selected()).toBe(c);
      service.step(1);
      expect(service.selected()).toBe(a); // wraps
      service.step(-1);
      expect(service.selected()).toBe(c);
      service.setCandidates(onScreen.slice(0, 2)); // gone off screen: back to the brightest
      expect(service.selected()).toBe(b);
    });

    it('picks the candidate nearest a click, within reach', () => {
      const service = TestBed.inject(SkyService);
      service.startNaming();
      service.setCandidates(onScreen);
      expect(service.selectNear(295, 100, 24)).toBe(true);
      expect(service.selected()).toBe(c);
      expect(service.selectNear(600, 600, 24)).toBe(false);
      expect(service.selected()).toBe(c);
    });

    it('a sent name stays sent until another star is picked; closing the panel clears it all', () => {
      const service = TestBed.inject(SkyService);
      service.startNaming();
      service.setCandidates(onScreen);
      service.sent.set(true);
      service.setCandidates(onScreen.slice());
      expect(service.sent()).toBe(true);
      service.step(1);
      expect(service.sent()).toBe(false);
      service.stopNaming();
      expect(service.lookingUp()).toBe(true);
      expect(service.selected()).toBeNull();
      expect(service.candidates()).toEqual([]);
    });
  });
});
