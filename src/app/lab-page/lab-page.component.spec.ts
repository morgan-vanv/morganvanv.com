import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Observable, NEVER, of, throwError } from 'rxjs';
import { LabPageComponent } from './lab-page.component';
import { SIDE_ROUTES } from '../../shared/main-routes';
import { ApiCacheService } from '../../shared/services/api-cache.service';
import { SITE_CONFIG } from '../../shared/config/site.config';
import { LAB_MACHINES, LAB_SERVICES } from '../../shared/constants/lab.const';
import { LAB_LOG, LAB_LOG_TAIL } from '../../shared/constants/lab-log.const';
import { isUnderConstruction } from '../../shared/constants/under-construction.const';
import { LAB_STATUS_POLL_MS } from './lab-status';
import { Ps1StageComponent } from './ps1/ps1-stage.component';
import { DISCORD_FEED_FIXTURE } from '../../shared/discord/discord-feed.fixture';

describe('LabPageComponent', () => {
  let fixture: ComponentFixture<LabPageComponent>;
  let get: ReturnType<typeof vi.fn>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const rackButtons = () => [...el().querySelectorAll<HTMLButtonElement>('.hardware button.unit')];
  const listButtons = () => [...el().querySelectorAll<HTMLButtonElement>('.machine-list button.unit')];
  const button = (buttons: HTMLButtonElement[], label: string) => buttons.find(b => b.querySelector('.unit-name')?.firstChild?.textContent?.trim() === label)!;
  /** The PS1 stages on the page, as [where, model, size, the canvas's name]. */
  const stages = () => fixture.debugElement.queryAll(By.directive(Ps1StageComponent)).map(stage => {
    const instance = stage.componentInstance as Ps1StageComponent;
    const where = (stage.nativeElement as HTMLElement).closest('.sheet') ? 'sheet' : (stage.nativeElement as HTMLElement).closest('.fold')?.id;
    return [where, instance.model(), instance.size(), (stage.nativeElement as HTMLElement).querySelector('canvas')?.getAttribute('aria-label')];
  });
  const pills = () => [...el().querySelectorAll('.air .state')].map(p => p.textContent?.trim());
  const statusCalls = () => get.mock.calls.filter(([url]) => url === SITE_CONFIG.labStatusUrl);

  /** The bot's account, as the widget lists any member; nothing else about it is real. */
  const bot = { id: '7', username: SITE_CONFIG.discord.botName, discriminator: '0000', avatar: null, status: 'online', avatar_url: 'https://cdn.discordapp.com/widget-avatars/o/p' };

  /** The page with the status Worker's answer and the Discord widget's (each NEVER answers by default). */
  async function render(response: Observable<unknown> = NEVER, widget: Observable<unknown> = NEVER) {
    get = vi.fn((url: string, ttl: number) => { void ttl; return url === SITE_CONFIG.discord.widgetUrl ? widget : response; });
    await TestBed.configureTestingModule({
      imports: [LabPageComponent],
      providers: [provideRouter([]), { provide: ApiCacheService, useValue: { get } }],
    }).compileComponents();
    fixture = TestBed.createComponent(LabPageComponent);
    await fixture.whenStable();
  }

  async function click(target: HTMLElement) {
    target.click();
    await fixture.whenStable();
  }

  it('has one h1, from the page header', async () => {
    await render();
    const headings = el().querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent?.trim()).toBe('Lab');
  });

  it('is no longer under construction', async () => {
    await render();
    expect(el().querySelector('app-under-construction')).toBeNull();
    expect(isUnderConstruction('blog')).toBe(true);
  });

  it('is a side page off Projects', () => {
    expect(SIDE_ROUTES.find(r => r.path === 'lab')).toEqual(expect.objectContaining({ title: 'Lab', parent: 'projects' }));
  });

  it('draws every machine as a faceplate button, in the rack, the closet and out front', async () => {
    await render();
    const groups = [...el().querySelectorAll('.hardware [role=group]')].map(g => [
      g.getAttribute('aria-labelledby'),
      [...g.querySelectorAll('.unit-name')].map(n => n.firstChild?.textContent?.trim()),
    ]);
    expect(groups).toEqual([
      ['lab-group-rack', ['BIG HOSS', 'FLEX MINI', 'JETKVM', 'UPS']],
      ['lab-group-closet', ['FALKENBURGHNAS', 'UPS']],
      ['lab-group-edge', ['THE VPS']],
    ]);
    expect(rackButtons().every(b => b.type === 'button')).toBe(true);
    expect(el().querySelectorAll('.hardware .vent').length).toBe(1);
    expect(el().querySelectorAll('.hardware .bays i').length).toBe(4);
    expect(el().querySelectorAll('.hardware .ports i').length).toBe(5);
    expect(el().querySelectorAll('.hardware .screen').length).toBe(1);
    expect(el().querySelectorAll('.hardware .led.amber').length).toBe(2);
    // The Pi is parked, not drawn: its button is kept for when it's back.
    expect(text('.hardware')).not.toContain('PI-HOLE');
  });

  it('selects BIG HOSS by default, before any data arrives', async () => {
    await render();
    expect(rackButtons().map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false']);
    expect(text('#lab-sheet-title')).toBe('BIG HOSS the Proxmox host');
    const specs = [...el().querySelectorAll('.sheet dt')].map(dt => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(specs).toContainEqual(['memory', '64 GB DDR4-2666']);
    expect(specs).toContainEqual(['storage', '2 × 12 TB HGST in a ZFS mirror; 512 GB + 2 TB NVMe']);
    // The machine turning on its stage, in place of a photo; the phone list's open fold has a smaller one.
    expect(el().querySelector('.photo')).toBeNull();
    expect(stages()).toEqual([
      ['sheet', 'hoss', 'large', 'BIG HOSS, a low-poly model turning slowly'],
      ['lab-fold-hoss', 'hoss', 'small', 'BIG HOSS, a low-poly model turning slowly'],
    ]);
    expect([...el().querySelectorAll('.sheet .chip')].map(c => c.textContent)).toEqual(LAB_MACHINES[0].runs);
  });

  it('shows the sheet of the machine picked', async () => {
    await render();
    await click(button(rackButtons(), 'FALKENBURGHNAS'));
    expect(button(rackButtons(), 'FALKENBURGHNAS').getAttribute('aria-pressed')).toBe('true');
    expect(button(rackButtons(), 'BIG HOSS').getAttribute('aria-pressed')).toBe('false');
    expect(text('#lab-sheet-title')).toBe('FalkenburghNAS storage, backups, the media house');
    expect(text('.sheet dl')).toContain('2 × 8 TB IronWolf, 2 × 14 TB Exos (SHR-1)');
    expect(stages()[0]).toEqual(['sheet', 'nas', 'large', 'FalkenburghNAS, a low-poly model turning slowly']);

    await click(button(rackButtons(), 'THE VPS'));
    expect(text('#lab-sheet-title')).toBe('The VPS the front door');
    expect(stages()[0]).toEqual(['sheet', 'vps', 'large', 'The VPS, a low-poly model turning slowly']);
    expect([...el().querySelectorAll('.sheet .chip')].map(c => c.textContent)).toEqual(['Caddy', 'CrowdSec', 'a game relay, later']);
    await click(button(rackButtons(), 'UPS'));
    expect(stages()[0]).toEqual(['sheet', 'ups', 'large', 'CyberPower CP1500, a low-poly model turning slowly']);
  });

  it('on phones, opens the selected machine beneath it, and folds it again', async () => {
    await render();
    const hoss = button(listButtons(), 'BIG HOSS');
    expect(hoss.getAttribute('aria-expanded')).toBe('true');
    expect(hoss.getAttribute('aria-controls')).toBe('lab-fold-hoss');
    expect(hoss.nextElementSibling?.id).toBe('lab-fold-hoss');
    expect(listButtons().filter(b => b.getAttribute('aria-expanded') === 'true').length).toBe(1);

    await click(button(listButtons(), 'JETKVM'));
    expect(button(listButtons(), 'JETKVM').getAttribute('aria-expanded')).toBe('true');
    expect(button(listButtons(), 'BIG HOSS').getAttribute('aria-expanded')).toBe('false');
    expect(text('#lab-fold-jetkvm')).toContain('HDMI from the GPU, USB to the host');
    expect(el().querySelector('#lab-fold-hoss')).toBeNull();
    expect(stages()).toEqual([
      ['sheet', 'jetkvm', 'large', 'JetKVM, a low-poly model turning slowly'],
      ['lab-fold-jetkvm', 'jetkvm', 'small', 'JetKVM, a low-poly model turning slowly'],
    ]);
    // The same selection as the rack's.
    expect(text('#lab-sheet-title')).toBe('JetKVM the console, from anywhere');

    await click(button(listButtons(), 'JETKVM'));
    expect(button(listButtons(), 'JETKVM').getAttribute('aria-expanded')).toBe('false');
    expect(el().querySelector('.fold')).toBeNull();
    expect(stages().map(([where]) => where)).toEqual(['sheet']);
    // The sheet beside the rack keeps it.
    expect(text('#lab-sheet-title')).toBe('JetKVM the console, from anywhere');
  });

  it('lists everything running, counted, and what is still under construction', async () => {
    await render();
    expect(text('#lab-running')).toBe('Everything I\'m running 14 things, on three boxes');
    const rows = [...el().querySelectorAll('.runs li')];
    expect(rows.length).toBe(LAB_SERVICES.length);
    expect(rows.filter(r => !r.classList.contains('later')).map(r => r.querySelector('.where')?.textContent)).toContain('everywhere');
    const later = rows.filter(r => r.classList.contains('later'));
    expect(later.map(r => r.querySelector('b')?.textContent)).toEqual(['Minecraft', 'RomM']);
    const where = (name: string) => rows.find(r => r.querySelector('b')?.textContent === name)?.querySelector('.where')?.textContent;
    // Foundry, the bot, Authentik and Pi-hole all live on BIG HOSS now; nothing names a guest or an address.
    for (const name of ['Foundry VTT', 'VideoJoker', 'Authentik', 'Pi-hole']) expect(where(name), name).toBe('BIG HOSS');
    expect(later.every(r => r.querySelector('.wip')?.textContent === 'under construction' && !r.querySelector('.where'))).toBe(true);
    expect(rows.every(r => r.querySelector('svg path')?.getAttribute('d'))).toBe(true);
  });

  it('puts the table, Jellyfin and the bot on the air with no links or addresses, and the rest under construction', async () => {
    await render();
    expect(el().querySelector('.air a')).toBeNull();
    expect(el().querySelectorAll('.air .wip').length).toBe(2);
    const rows = [...el().querySelectorAll('.air-row')].map(r => [r.querySelector('.air-name')?.textContent, r.querySelector('.air-what')?.textContent]);
    expect(rows[0]).toEqual(['Foundry VTT', 'my Vampire: The Masquerade table']);
    expect(rows[1]).toEqual(['Jellyfin', 'my movies and shows']);
    expect(rows[2]).toEqual(['VideoJoker', 'the Discord bot, always on']);
    expect(rows[4]).toEqual(['my retro library', 'my collection of old games, dumped, and playable via browser']);
    expect(rows.length).toBe(5);
  });

  it('shows no status pills and no "checked" line until the status arrives', async () => {
    await render();
    expect(get).toHaveBeenCalledWith(SITE_CONFIG.labStatusUrl, expect.any(Number));
    expect(pills()).toEqual([]);
    expect(el().querySelector('.air .note')).toBeNull();
  });

  it('shows up and down from the status Worker, in words', async () => {
    const checkedAt = new Date(Date.now() - 3 * 60_000).toISOString();
    await render(of({ checkedAt, services: { vtt: 'up', jellyfin: 'down' } }));
    expect(pills()).toEqual(['up', 'down']);
    expect(el().querySelector('.air-row .state')?.classList.contains('down')).toBe(false);
    expect(el().querySelectorAll('.air .state.down').length).toBe(1);
    expect(text('.air .note')).toBe("Up or down is checked from outside every few minutes (the bot, by whether it's on Discord); last 3 minutes ago.");
  });

  it('shows nothing for a status it cannot trust, or a failed request', async () => {
    await render(of({ checkedAt: '2026-11-05T19:40:00.000Z', services: { vtt: 'up', jellyfin: 'sideways' } }));
    expect(pills()).toEqual([]);
    expect(el().querySelector('.air .note')).toBeNull();

    TestBed.resetTestingModule();
    await render(throwError(() => new Error('offline')));
    expect(pills()).toEqual([]);
    expect(el().querySelector('.air .note')).toBeNull();
  });

  it('asks again every couple of minutes while it stays open, and the "checked" time keeps up', async () => {
    // Only the intervals: Angular's own scheduling keeps real timers.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      let checkedAt = new Date(Date.now() - 60_000).toISOString();
      await render(new Observable(subscriber => {
        subscriber.next({ checkedAt, services: { vtt: 'up', jellyfin: 'up' } });
        subscriber.complete();
      }));
      expect(statusCalls().length).toBe(1);
      expect(get).toHaveBeenCalledWith(SITE_CONFIG.labStatusUrl, 0);
      expect(pills()).toEqual(['up', 'up']);

      checkedAt = new Date(Date.now() + LAB_STATUS_POLL_MS).toISOString();
      vi.advanceTimersByTime(LAB_STATUS_POLL_MS);
      await fixture.whenStable();
      expect(statusCalls().length).toBe(2);
      expect(text('.air .note')).toContain('just now');
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the bot up when its account is online in the Discord widget, and nothing else from the feed", async () => {
    await render(NEVER, of({ ...DISCORD_FEED_FIXTURE, members: [...DISCORD_FEED_FIXTURE.members, bot], presence_count: 8 }));
    expect(get).toHaveBeenCalledWith(SITE_CONFIG.discord.widgetUrl, 0);
    expect(pills()).toEqual(['up']);
    const botRow = [...el().querySelectorAll('.air-row')].find(r => r.querySelector('.air-name')?.textContent === 'VideoJoker')!;
    expect(botRow.querySelector('.state')?.textContent?.trim()).toBe('up');
    expect(el().textContent).not.toContain(SITE_CONFIG.discord.botName);
    for (const member of DISCORD_FEED_FIXTURE.members) expect(el().textContent).not.toContain(member.username);
    // The Worker hasn't answered: no "checked" line yet, and no pills for the table or Jellyfin.
    expect(el().querySelector('.air .note')).toBeNull();
  });

  it('shows the bot down when the whole list is in and it is not there', async () => {
    await render(NEVER, of(DISCORD_FEED_FIXTURE));
    expect(pills()).toEqual(['down']);
    expect(el().querySelectorAll('.air .state.down').length).toBe(1);
  });

  it('shows no pill for the bot when Discord capped the list and it is missing', async () => {
    await render(NEVER, of({ ...DISCORD_FEED_FIXTURE, presence_count: 150 }));
    expect(pills()).toEqual([]);
  });

  it('keeps the lab log under the services, its last lines showing, then ends with the other computers around the house', async () => {
    await render();
    const log = el().querySelector('app-lab-log')!;
    expect(log.previousElementSibling?.classList.contains('lower')).toBe(true);
    expect(log.nextElementSibling?.classList.contains('house')).toBe(true);
    expect([...log.querySelectorAll('.lines li')].map(li => li.textContent?.trim())).toEqual(LAB_LOG.slice(-LAB_LOG_TAIL));
    expect([...el().querySelectorAll('.house .chip')].map(c => c.textContent)).toEqual([
      'battlestation · Ryzen 7, RTX 3070', 'Bambu Lab P1S', 'ThinkPad X220, waiting for a job', '4 × Pi Zero',
    ]);
  });
});
