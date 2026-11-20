import { toLabStatus } from './lab-status';

describe('toLabStatus', () => {
  const good = { checkedAt: '2026-11-05T19:40:00.000Z', services: { vtt: 'up', jellyfin: 'down' } };

  it('takes the Worker\'s answer as it is', () => {
    expect(toLabStatus(good)).toEqual({ ...good, minecraftOnline: null });
    expect(toLabStatus({ ...good, checkedAt: '2026-11-05T19:40:00Z' })?.checkedAt).toBe('2026-11-05T19:40:00Z');
  });

  it('keeps only the services it knows', () => {
    expect(toLabStatus({ ...good, services: { ...good.services, extra: 'up' } })?.services).toEqual(good.services);
  });

  it('reads the front desk and the server when the Worker has them (lab-status 1.1), and the player count', () => {
    const newer = {
      checkedAt: good.checkedAt,
      services: { vtt: 'up', jellyfin: 'up', desk: 'up', minecraft: 'up' },
      players: { minecraft: 3 },
    };
    expect(toLabStatus(newer)).toEqual({ checkedAt: good.checkedAt, services: newer.services, minecraftOnline: 3 });
    expect(toLabStatus({ ...newer, players: { minecraft: 0 } })?.minecraftOnline).toBe(0);
  });

  it('leaves out a newer check it can\'t trust, and a count that isn\'t a count, without dropping the rest', () => {
    const odd = { checkedAt: good.checkedAt, services: { vtt: 'up', jellyfin: 'up', desk: 'maybe', minecraft: 'up' } };
    for (const players of [undefined, { minecraft: -1 }, { minecraft: 2.5 }, { minecraft: '3' }, { minecraft: null }, []]) {
      const status = toLabStatus({ ...odd, players });
      expect(status?.services).toEqual({ vtt: 'up', jellyfin: 'up', minecraft: 'up' });
      expect(status?.minecraftOnline).toBeNull();
    }
  });

  it('has no count while the server is down, whatever the answer says', () => {
    const down = { checkedAt: good.checkedAt, services: { vtt: 'up', jellyfin: 'up', minecraft: 'down' }, players: { minecraft: 4 } };
    expect(toLabStatus(down)?.minecraftOnline).toBeNull();
  });

  it('rejects anything that is not the whole shape', () => {
    for (const bad of [
      null, undefined, 'up', 42, [], {},
      { services: good.services },
      { checkedAt: good.checkedAt },
      { checkedAt: good.checkedAt, services: [] },
      { checkedAt: good.checkedAt, services: { vtt: 'up' } },
      { checkedAt: good.checkedAt, services: { vtt: 'up', jellyfin: 'unknown' } },
      { checkedAt: good.checkedAt, services: { vtt: true, jellyfin: 'up' } },
      { checkedAt: 'yesterday', services: good.services },
      { checkedAt: '2026-13-45T99:99:99Z', services: good.services },
      { checkedAt: 1730835600000, services: good.services },
    ]) {
      expect(toLabStatus(bad)).toBeNull();
    }
  });
});
