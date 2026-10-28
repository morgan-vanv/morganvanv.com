import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { ShoutboxComponent, clockTime, nickColour } from './shoutbox';
import { CampfireService, ShoutLog } from '../../../shared/services/campfire.service';

describe('nickColour', () => {
  it('is stable per nick, ignores case and stays in range', () => {
    expect(nickColour('Sam')).toBe(nickColour('sam'));
    for (const nick of ['a', 'guest_0421', 'morgan', 'zz_top']) {
      expect(nickColour(nick)).toBeGreaterThanOrEqual(0);
      expect(nickColour(nick)).toBeLessThan(5);
    }
  });
});

describe('clockTime', () => {
  it('reads like an IRC timestamp', () => {
    expect(clockTime(new Date(2026, 9, 27, 7, 5).toISOString())).toBe('07:05');
  });
});

describe('ShoutboxComponent', () => {
  const log = signal<ShoutLog | null>(null);
  const host = signal(false);
  const failed = signal(false);
  const stop = vi.fn();
  const campfire = {
    shoutLog: log,
    isHost: host,
    unreachable: computed(() => failed() && !log()),
    watchShouts: vi.fn(() => stop),
    captureHostKey: vi.fn(),
    savedNick: () => 'guest_0421',
    say: vi.fn(async () => null as string | null),
    remove: vi.fn(async () => null as string | null),
    setOpen: vi.fn(async () => null as string | null),
    clearRecent: vi.fn(async (): Promise<{ removed: number } | { error: string }> => ({ removed: 3 })),
  };

  beforeEach(() => {
    log.set(null);
    host.set(false);
    failed.set(false);
    vi.clearAllMocks();
    TestBed.configureTestingModule({ imports: [ShoutboxComponent], providers: [{ provide: CampfireService, useValue: campfire }] });
  });

  const create = async () => {
    const fixture = TestBed.createComponent(ShoutboxComponent);
    await fixture.whenStable();
    return fixture;
  };

  it('watches the shoutbox while it exists, and fills in a guest nick', async () => {
    const fixture = await create();
    expect(campfire.watchShouts).toHaveBeenCalledTimes(1);
    expect(campfire.captureHostKey).toHaveBeenCalled();
    expect(fixture.componentInstance.nick()).toBe('guest_0421');
    fixture.destroy();
    expect(stop).toHaveBeenCalled();
  });

  it('waits, then says when the campfire can\'t be reached', async () => {
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.status')?.textContent).toContain('Stoking the fire');
    failed.set(true);
    await fixture.whenStable();
    expect(el.querySelector('.status')?.textContent).toContain('Can\'t reach the campfire');
  });

  it('shows the log like an IRC client, Morgan in gold', async () => {
    log.set({ here: 2, open: true, shouts: [
      { id: 1, nick: 'sam', text: 'nice campfire', at: new Date(2026, 9, 27, 23, 41).toISOString(), host: false },
      { id: 2, nick: 'morgan', text: 'thanks', at: new Date(2026, 9, 27, 23, 42).toISOString(), host: true },
    ] });
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    const lines = [...el.querySelectorAll('.log .line')].map(li => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(lines).toEqual(['[23:41] <sam> nice campfire', '[23:42] <@morgan> (the host) thanks']);
    expect(el.querySelector('div.log')?.getAttribute('role')).toBe('log');
    expect(el.querySelector('div.log > ol.lines')).not.toBeNull();
    expect(el.querySelectorAll('.nick')[1].classList).toContain('host');
    expect(el.querySelector('.drop')).toBeNull();
  });

  it('has something to say about an empty log', async () => {
    log.set({ here: 1, open: true, shouts: [] });
    const fixture = await create();
    expect((fixture.nativeElement as HTMLElement).querySelector('.line.system')?.textContent).toContain('nobody\'s said anything yet');
  });

  it('says a trimmed line, then clears it; keeps it on an error', async () => {
    log.set({ here: 1, open: true, shouts: [] });
    const fixture = await create();
    const box = fixture.componentInstance;
    box.text.set('  hello there ');
    await box.say();
    expect(campfire.say).toHaveBeenCalledWith('guest_0421', 'hello there', '');
    expect(box.text()).toBe('');

    campfire.say.mockResolvedValueOnce('Easy there. Give the fire a few seconds.');
    box.text.set('again');
    await box.say();
    expect(box.text()).toBe('again');
    expect(box.error()).toContain('few seconds');
  });

  it('lets arrow keys scroll the log only while it has focus', async () => {
    log.set({ here: 1, open: true, shouts: [] });
    const fixture = await create();
    const box = fixture.nativeElement.querySelector('div.log') as HTMLElement;
    expect(fixture.componentInstance.logFocused()).toBe(false);
    box.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(fixture.componentInstance.logFocused()).toBe(true);
    box.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(fixture.componentInstance.logFocused()).toBe(false);
  });

  it('hides the composer when the campfire can\'t be reached', async () => {
    failed.set(true);
    const fixture = await create();
    expect((fixture.nativeElement as HTMLElement).querySelector('form.composer')).toBeNull();
  });

  it('won\'t send without a nick and a message', async () => {
    const fixture = await create();
    fixture.componentInstance.nick.set(' ');
    fixture.componentInstance.text.set('hi');
    expect(fixture.componentInstance.canSay()).toBe(false);
  });

  it('gives the host a delete button on every line', async () => {
    host.set(true);
    log.set({ here: 1, open: true, shouts: [{ id: 4, nick: 'spam', text: 'buy now', at: new Date().toISOString(), host: false }] });
    const fixture = await create();
    const drop = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.drop')!;
    expect(drop.getAttribute('aria-label')).toBe('Delete spam\'s message');
    const original = window.confirm;
    window.confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    try {
      drop.click();
      expect(campfire.remove).not.toHaveBeenCalled();
      drop.click();
      expect(window.confirm).toHaveBeenCalledWith('Delete spam\'s message?');
      expect(campfire.remove).toHaveBeenCalledWith(4);
    } finally {
      window.confirm = original;
    }
  });

  it('while the fire is banked, guests read the log but get no composer', async () => {
    log.set({ here: 1, open: false, shouts: [{ id: 1, nick: 'sam', text: 'hi', at: new Date().toISOString(), host: false }] });
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.log .line:last-child')?.textContent).toContain('the fire\'s banked for now');
    expect(el.querySelector('form.composer')).toBeNull();
    expect(el.querySelector('.status.banked')?.textContent).toContain('banked');
    expect(fixture.componentInstance.canSay()).toBe(false);
    expect(el.querySelector('button.bank')).toBeNull();
  });

  it('lets the host bank the fire, post while it\'s banked, and light it again', async () => {
    host.set(true);
    log.set({ here: 1, open: true, shouts: [] });
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    const bank = el.querySelector<HTMLButtonElement>('button.bank')!;
    expect(bank.getAttribute('type')).toBe('button');
    expect(bank.textContent?.trim()).toBe('bank the fire');
    await fixture.componentInstance.toggleFire();
    expect(campfire.setOpen).toHaveBeenCalledWith(false);

    log.set({ here: 1, open: false, shouts: [] });
    await fixture.whenStable();
    expect(el.querySelector('form.composer')).not.toBeNull();
    expect(el.querySelector('button.bank')?.textContent?.trim()).toBe('light it again');
    await fixture.componentInstance.toggleFire();
    expect(campfire.setOpen).toHaveBeenLastCalledWith(true);

    campfire.setOpen.mockResolvedValueOnce('That\'s not the host key.');
    await fixture.componentInstance.toggleFire();
    expect(fixture.componentInstance.error()).toBe('That\'s not the host key.');
  });

  it('lets the host clear the last hour of guest messages in one go, after a confirm', async () => {
    const original = window.confirm;
    window.confirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    try {
      host.set(true);
      log.set({ here: 1, open: true, shouts: [] });
      const fixture = await create();
      const el = fixture.nativeElement as HTMLElement;
      const clear = el.querySelector<HTMLButtonElement>('button.clear')!;
      expect(clear.getAttribute('type')).toBe('button');
      expect(clear.textContent?.trim()).toBe('clear the last hour');

      await fixture.componentInstance.clearHour();
      expect(campfire.clearRecent).not.toHaveBeenCalled();

      await fixture.componentInstance.clearHour();
      expect(campfire.clearRecent).toHaveBeenCalledWith(60);
      await fixture.whenStable();
      expect(el.querySelector('.notice[role="status"]')?.textContent).toBe('Took down 3 messages.');

      campfire.clearRecent.mockResolvedValueOnce({ error: 'Only the host can do that.' });
      await fixture.componentInstance.clearHour();
      expect(fixture.componentInstance.error()).toBe('Only the host can do that.');
    } finally {
      window.confirm = original;
    }
  });

  it('shows guests no clear-up button and no host notice', async () => {
    log.set({ here: 1, open: true, shouts: [] });
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('button.clear')).toBeNull();
    expect(el.querySelector('.notice')).toBeNull();
  });
});
