import { toLabStatus } from './lab-status';

describe('toLabStatus', () => {
  const good = { checkedAt: '2026-11-05T19:40:00.000Z', services: { vtt: 'up', jellyfin: 'down' } };

  it('takes the Worker\'s answer as it is', () => {
    expect(toLabStatus(good)).toEqual(good);
    expect(toLabStatus({ ...good, checkedAt: '2026-11-05T19:40:00Z' })?.checkedAt).toBe('2026-11-05T19:40:00Z');
  });

  it('keeps only the services it knows', () => {
    expect(toLabStatus({ ...good, services: { ...good.services, extra: 'up' } })?.services).toEqual(good.services);
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
