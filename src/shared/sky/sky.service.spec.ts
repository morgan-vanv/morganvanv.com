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
    /** All the way round: the three on screen (facing south) and one in the north, behind you. */
    const d = star(3.9, 4);
    const around = [{ star: d, alt: 30, az: 10 }, { star: a, alt: 40, az: 150 }, { star: b, alt: 20, az: 180 }, { star: c, alt: 50, az: 210 }];

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

    it('selects the brightest candidate, and keeps a selection that\'s still on screen', () => {
      const service = TestBed.inject(SkyService);
      service.startNaming();
      service.setCandidates(onScreen);
      expect(service.selected()).toBe(b);
      service.select(c);
      service.setCandidates(onScreen.slice()); // redrawn: still there
      expect(service.selected()).toBe(c);
      // No longer pickable (under the panel, say): the selection stays put; the sky clears it once the star has gone.
      service.setCandidates(onScreen.slice(0, 2));
      expect(service.selected()).toBe(c);
      service.select(null);
      service.setCandidates(onScreen.slice(0, 2));
      expect(service.selected()).toBe(b);
    });

    it('‹ › step all the way round by azimuth, past north, and ask the sky to bring each star into view', () => {
      const service = TestBed.inject(SkyService);
      service.startNaming();
      service.around.set(around);
      service.select(b);
      const shown = service.showSelected();
      service.step(1);
      expect(service.selected()).toBe(c);
      expect(service.showSelected()).toBe(shown + 1);
      service.step(1);
      expect(service.selected()).toBe(d); // round past north, off screen
      service.step(-1);
      expect(service.selected()).toBe(c);
      // Nothing selected: from where the visitor is facing.
      service.select(null);
      service.view.set({ facing: 100, tilt: 0 });
      service.step(1);
      expect(service.selected()).toBe(a);
      service.select(null);
      service.step(-1);
      expect(service.selected()).toBe(d);
    });

    it('‹ › pass over stars no view can show (under a phone\'s sheet, behind the hills), and give up after a lap', () => {
      const service = TestBed.inject(SkyService);
      service.startNaming();
      service.around.set(around);
      service.select(d);
      // Only b can be shown.
      service.showable = s => s.star === b;
      service.step(1);
      expect(service.selected()).toBe(b); // a passed over
      service.step(1);
      expect(service.selected()).toBe(b); // all the way round to itself
      service.step(-1);
      expect(service.selected()).toBe(b);
      // None can: nothing changes, and it stops after one lap.
      const asked: unknown[] = [];
      service.showable = s => (asked.push(s), false);
      const shown = service.showSelected();
      service.step(1);
      expect(service.selected()).toBe(b);
      expect(service.showSelected()).toBe(shown);
      expect(asked.length).toBe(around.length);
      service.showable = null;
    });

    it('looking up closes the ☾ menu, so the first touch lands on the sky', () => {
      const service = TestBed.inject(SkyService);
      service.menuOpen.set(true);
      service.enterLookUp();
      expect(service.menuOpen()).toBe(false);
      service.leaveLookUp();
    });

    it('the compass turns from where the last turn was heading, clamps the tilt, and says where it leaves you', () => {
      const service = TestBed.inject(SkyService);
      service.enterLookUp();
      expect(service.view()).toEqual({ facing: 180, tilt: 0 });
      service.turn(-45);
      expect(service.viewRequest()?.view).toEqual({ facing: 135, tilt: 0 });
      service.turn(-45); // before the sky got there: from where it was heading
      expect(service.viewRequest()?.view).toEqual({ facing: 90, tilt: 0 });
      expect(service.viewAnnouncement()).toBe('facing east, 90°, at the horizon');
      service.turn(-135);
      expect(service.viewRequest()?.view.facing).toBe(315); // wraps past north
      service.tilt(-15);
      expect(service.viewRequest()?.view.tilt).toBe(0); // not below the horizon
      for (let i = 0; i < 8; i++) service.tilt(15);
      expect(service.viewRequest()?.view.tilt).toBe(90); // nor past the zenith
      expect(service.viewAnnouncement()).toBe('facing northwest, 315°, straight up');
      const count = service.viewRequest()!.count;
      service.faceSouth();
      expect(service.viewRequest()).toEqual({ view: { facing: 180, tilt: 0 }, count: count + 1 });
      // The same words twice still get said.
      const said = service.viewAnnouncement();
      service.faceSouth();
      expect(service.viewAnnouncement()).not.toBe(said);
      expect(service.viewAnnouncement().trim()).toBe(said.trim());
    });

    it('leaving look-up faces south again, and so does coming back', () => {
      const service = TestBed.inject(SkyService);
      service.enterLookUp();
      service.view.set({ facing: 338, tilt: 40 });
      service.turn(45);
      service.leaveLookUp();
      expect(service.view()).toEqual({ facing: 180, tilt: 0 });
      expect(service.viewRequest()).toBeNull();
      service.view.set({ facing: 20, tilt: 10 }); // (as if left over)
      service.startNaming();
      expect(service.view()).toEqual({ facing: 180, tilt: 0 });
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
      service.around.set(around);
      service.sent.set(true);
      service.setCandidates(onScreen.slice());
      expect(service.sent()).toBe(true);
      service.step(1);
      expect(service.sent()).toBe(false);
      service.stopNaming();
      expect(service.lookingUp()).toBe(true);
      expect(service.selected()).toBeNull();
      expect(service.candidates()).toEqual([]);
      expect(service.around()).toEqual([]);
    });
  });
});
