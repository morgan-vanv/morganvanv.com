import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DiscordPanelComponent, DISCORD_TAGLINE, statusShares, voiceLabel } from './discord-panel';
import { DiscordService } from '../../../shared/discord/discord.service';
import { DiscordSummary, toDiscordSummary } from '../../../shared/discord/discord';
import { DISCORD_FEED_FIXTURE } from '../../../shared/discord/discord-feed.fixture';

describe('DiscordPanelComponent', () => {
  let fixture: ComponentFixture<DiscordPanelComponent>;
  const summary = signal<DiscordSummary | null>(null);
  const el = () => fixture.nativeElement as HTMLElement;
  const fromFeed = toDiscordSummary(DISCORD_FEED_FIXTURE)!;

  beforeEach(async () => {
    summary.set(null);
    await TestBed.configureTestingModule({
      imports: [DiscordPanelComponent],
      providers: [{ provide: DiscordService, useValue: { summary } }],
    }).compileComponents();
    fixture = TestBed.createComponent(DiscordPanelComponent);
    await fixture.whenStable();
  });

  it('shows nothing until Discord has answered', () => {
    expect(el().querySelector('section')).toBeNull();
  });

  it('shows the server, the count and the split, with the split in words for screen readers', async () => {
    summary.set(fromFeed);
    await fixture.whenStable();
    expect(el().querySelector('h2')?.textContent).toContain('The Discord');
    expect(el().querySelector('.server')?.textContent?.trim()).toBe('Ugandan Commandos');
    expect(el().querySelector('.big')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('7 online right now');
    expect(el().querySelector('.bar')?.getAttribute('aria-label')).toBe('4 around, 2 idle, 1 busy');
    expect(el().querySelector('.voice')?.textContent?.trim()).toBe('1 in voice');
  });

  it('lists the games, RuneLite in OSRS gold, and counts the rest', async () => {
    summary.set({
      ...fromFeed,
      games: ['RuneLite', 'A', 'B', 'C', 'D', 'E'].map((name, i) => ({ name, count: 6 - i })),
    });
    await fixture.whenStable();
    const rows = [...el().querySelectorAll('.games li')];
    expect(rows.map(li => li.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['RuneLite6', 'A5', 'B4', 'C3', '+ 2 more']);
    expect(rows[0].classList.contains('osrs')).toBe(true);
  });

  it('says so when nobody is playing anything', async () => {
    summary.set({ ...fromFeed, games: [] });
    await fixture.whenStable();
    expect(el().querySelector('.games')).toBeNull();
    expect(el().querySelector('.quiet')).not.toBeNull();
  });

  it("joins through the widget's invite in a new tab, and carries Morgan's line", async () => {
    summary.set(fromFeed);
    await fixture.whenStable();
    const join = el().querySelector<HTMLAnchorElement>('a.join')!;
    expect(join.getAttribute('href')).toBe('https://discord.com/invite/jUwYdRCy');
    expect(join.getAttribute('target')).toBe('_blank');
    expect(join.getAttribute('rel')).toBe('noopener noreferrer');
    expect(join.getAttribute('aria-label')).toMatch(/^Pull up a chair/);
    expect(el().querySelector('.tagline')?.textContent?.trim()).toBe(DISCORD_TAGLINE);
    expect(DISCORD_TAGLINE).toBe("home to the world's greatest gaming prodigies");
  });

  it('has no join link without an invite', async () => {
    summary.set({ ...fromFeed, invite: null });
    await fixture.whenStable();
    expect(el().querySelector('a.join')).toBeNull();
    expect(el().querySelector('.tagline')).not.toBeNull();
  });
});

describe('the panel helpers', () => {
  it('says who is in voice', () => {
    expect(voiceLabel(0)).toBe('nobody in voice');
    expect(voiceLabel(3)).toBe('3 in voice');
  });

  it('turns the split into bar widths', () => {
    const summary = toDiscordSummary(DISCORD_FEED_FIXTURE)!;
    expect(statusShares({ ...summary, status: { online: 42, idle: 17, dnd: 10 } })).toEqual({ online: 60.9, idle: 24.6, dnd: 14.5 });
    expect(statusShares({ ...summary, status: { online: 0, idle: 0, dnd: 0 } })).toEqual({ online: 0, idle: 0, dnd: 0 });
  });
});
