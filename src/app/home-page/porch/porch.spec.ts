import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HomePorchComponent } from './porch';
import { moonLine, onAirLines, planetLine } from './porch-lines';
import { DiscordService } from '../../../shared/discord/discord.service';
import { DISCORD_TAGLINE, DiscordSummary, toDiscordSummary } from '../../../shared/discord/discord';
import { DISCORD_FEED_FIXTURE } from '../../../shared/discord/discord-feed.fixture';
import { LabStatusService } from '../../lab-page/lab-status.service';
import { LabStatusId } from '../../../shared/constants/lab.const';
import { LastListened, RecentStreamService } from '../../../shared/services/recent-stream.service';
import { SkyService } from '../../../shared/sky/sky.service';
import { Tonight, TonightPlanet } from '../../../shared/sky/sky-tonight';
import { UpNow } from '../../../shared/sky/sky-up-now';

const at = (iso: string) => new Date(iso);

/** 27 October 2026 over Cincinnati, by day: dusk 7:10 pm EDT, dawn 7:35 am (as the Up tonight badge's spec). */
const DUSK = at('2026-10-27T23:10:00Z');
const DAWN = at('2026-10-28T11:35:00Z');
const planet = (over: Partial<TonightPlanet> & Pick<TonightPlanet, 'name'>): TonightPlanet => ({
  mag: 0, from: DUSK, until: DAWN, upAtStart: true, upAtEnd: true, altAtStart: 20, peak: at('2026-10-28T02:00:00Z'), peakAlt: 40, ...over,
});
const SATURN = planet({ name: 'Saturn', until: at('2026-10-28T09:50:00Z'), upAtEnd: false });
const JUPITER = planet({ name: 'Jupiter', from: at('2026-10-28T06:10:00Z'), upAtStart: false });
const NIGHT: Tonight = {
  dark: false, start: DUSK, end: DAWN, primeTime: at('2026-10-28T01:10:00Z'), moon: null,
  planets: [SATURN, JUPITER], stars: [], constellations: [], shower: null,
};
const ZONE = 'America/New_York';

describe('porch lines', () => {
  it('names the Moon\'s phase and how lit it is', () => {
    expect(moonLine({ illuminated: 0.812, phase: 130 })).toBe('waxing gibbous · 81% lit');
    expect(moonLine({ illuminated: 1, phase: 180 })).toBe('full moon · 100% lit');
  });

  it('gives the night\'s first planet and its hours on the sky\'s clock, counting the rest', () => {
    expect(planetLine(NIGHT, ZONE)).toBe('Saturn up dusk–5:50 am · +1');
    expect(planetLine({ ...NIGHT, planets: [JUPITER] }, ZONE)).toBe('Jupiter up 2:10 am–dawn');
    expect(planetLine({ ...NIGHT, planets: [planet({ name: 'Mars' })] }, ZONE)).toBe('Mars up all night');
    expect(planetLine({ ...NIGHT, dark: true, planets: [SATURN] }, ZONE)).toBe('Saturn up now, until 5:50 am');
  });

  it('says so when there are no planets, or no dark sky', () => {
    expect(planetLine({ ...NIGHT, planets: [] }, ZONE)).toBe('no planets up tonight');
    expect(planetLine({ ...NIGHT, start: null }, ZONE)).toBe('no dark sky tonight');
  });

  it('lists what\'s live on the air, each lit by its own source: the status Worker, or Discord for the bot', () => {
    const states: Record<LabStatusId, 'up' | 'down'> = { vtt: 'up', jellyfin: 'down' };
    expect(onAirLines(id => states[id], true)).toEqual([
      { name: 'Foundry VTT', state: 'up' },
      { name: 'Jellyfin', state: 'down' },
      { name: 'VideoJoker', state: 'up' },
    ]);
    expect(onAirLines(() => null, null).map(line => line.state)).toEqual([null, null, null]);
    expect(onAirLines(() => null, false).at(-1)).toEqual({ name: 'VideoJoker', state: 'down' });
  });
});

describe('HomePorchComponent', () => {
  let fixture: ComponentFixture<HomePorchComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => [...el().querySelectorAll(selector)].map(node => node.textContent?.replace(/\s+/g, ' ').trim());

  const lastListened = signal<LastListened | null>(null);
  const when = signal<string | null>(null);
  const summary = signal<DiscordSummary | null>(null);
  const states = signal<Partial<Record<LabStatusId, 'up' | 'down'>>>({});

  beforeEach(async () => {
    lastListened.set(null);
    when.set(null);
    summary.set(null);
    states.set({});
    TestBed.configureTestingModule({
      imports: [HomePorchComponent],
      providers: [provideRouter([]), { provide: RecentStreamService, useValue: { lastListened, when } }],
    });
    TestBed.overrideComponent(HomePorchComponent, {
      set: {
        providers: [
          { provide: DiscordService, useValue: { summary } },
          { provide: LabStatusService, useValue: { stateOf: (id: LabStatusId) => states()[id] ?? null } },
        ],
      },
    });
    fixture = TestBed.createComponent(HomePorchComponent);
    await fixture.whenStable();
  });

  it('has four spots in Morgan\'s order, each leading somewhere', () => {
    expect(text('.label')).toEqual(['on the record player', 'tonight over Cincinnati', 'hanging out', 'on the air']);
    const links = [...el().querySelectorAll('.go')];
    expect(links.map(go => go.getAttribute('href'))).toEqual(['/interests', null, '/social', '/lab']);
    expect(links.map(go => go.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['[interests ›]', '[look up ☾]', '[tap in ›]', '[the lab ›]']);
    expect(links[1].tagName).toBe('BUTTON');
  });

  it('looks finished before any feed answers: resting lines, and the lab\'s names without lights', () => {
    expect(text('.record .title')).toEqual(['the needle\'s up']);
    expect(text('.sky .title')).toEqual(['the sky behind this page']);
    expect(text('.discord .detail')).toEqual([DISCORD_TAGLINE]);
    expect(text('.air li')).toEqual(['Foundry VTT', 'Jellyfin', 'VideoJoker']);
    expect(el().querySelectorAll('.led.up, .led.down').length).toBe(0);
    expect(el().querySelector('.dot')).toBeNull();
  });

  it('shows the last track, with a live dot while it\'s playing', async () => {
    lastListened.set({ trackName: 'Song', artistName: 'Band', imageUrl: 'https://example.com/cover.jpg', trackUrl: 'https://example.com', isPlaying: false, at: 0 });
    when.set('12 minutes ago');
    await fixture.whenStable();
    expect(text('.record .title')).toEqual(['Song']);
    expect(text('.record .detail')).toEqual(['Band · 12 minutes ago']);
    expect(el().querySelector('.record img')?.getAttribute('src')).toBe('https://example.com/cover.jpg');
    expect(el().querySelector('.record .dot')).toBeNull();

    lastListened.update(item => item && { ...item, isPlaying: true });
    await fixture.whenStable();
    expect(text('.record .detail')).toEqual(['Band · right now']);
    expect(el().querySelector('.record .dot')).toBeTruthy();
  });

  it('shows tonight\'s Moon and first planet from the sky\'s own numbers', async () => {
    const sky = TestBed.inject(SkyService);
    sky.upNow.set({ planets: [], moon: null, constellations: [], detail: { moon: { illuminated: 0.81, phase: 130, alt: 20 }, sunAlt: -20, planets: [] } } as UpNow);
    sky.tonight.set(NIGHT);
    await fixture.whenStable();
    expect(text('.sky .title')).toEqual(['waxing gibbous · 81% lit']);
    expect(text('.sky .detail')).toEqual(['Saturn up dusk–5:50 am · +1']);
    expect(el().querySelector('.sky path.moon-lit')).toBeTruthy();
  });

  it('shows the Discord as /now does: the server and its counts, never people', async () => {
    const fromFeed = toDiscordSummary(DISCORD_FEED_FIXTURE)!;
    summary.set(fromFeed);
    await fixture.whenStable();
    expect(text('.discord .label')).toEqual(['hanging out · right now']);
    expect(text('.discord .title')).toEqual(['Ugandan Commandos']);
    expect(text('.discord .detail')[0]).toMatch(/^7 online/);
    expect(el().querySelector('.discord .dot')).toBeTruthy();
  });

  it('lights what\'s on the air once its source answers, and says it in words', async () => {
    states.set({ vtt: 'up', jellyfin: 'down' });
    summary.set({ ...toDiscordSummary(DISCORD_FEED_FIXTURE)!, botOnline: true });
    await fixture.whenStable();
    const leds = [...el().querySelectorAll('.air .led')].map(led => led.className.replace('led', '').trim());
    expect(leds).toEqual(['up', 'down', 'up']);
    expect(text('.air li')).toEqual(['Foundry VTT, up', 'Jellyfin, down', 'VideoJoker, up']);
  });

  it('looks up from the sky button', async () => {
    const sky = TestBed.inject(SkyService);
    el().querySelector<HTMLButtonElement>('button.go')!.click();
    await fixture.whenStable();
    expect(sky.lookingUp()).toBe(true);
  });
});
