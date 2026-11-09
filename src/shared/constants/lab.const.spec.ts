import { LAB_AROUND_THE_HOUSE, LAB_DEFAULT_MACHINE, LAB_MACHINES, LAB_ON_AIR, LAB_PARKED_MACHINES, LAB_SERVICES, runningSummary } from './lab.const';
import { isPs1ModelKey } from '../../app/lab-page/ps1/ps1-models';

/** Every string in the lab's data, except the icons' SVG paths (numbers and letters by design). */
function strings(value: unknown, key = ''): string[] {
  if (typeof value === 'string') return key === 'icon' ? [] : [value];
  if (Array.isArray(value)) return value.flatMap(item => strings(item));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, k));
  return [];
}

describe('the lab\'s data', () => {
  const all = strings([LAB_MACHINES, LAB_PARKED_MACHINES, LAB_ON_AIR, LAB_SERVICES, LAB_AROUND_THE_HOUSE]);

  it('never says where anything is: no addresses, ports, MACs or local names', () => {
    expect(all.length).toBeGreaterThan(100);
    for (const text of all) {
      expect(text, text).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/); // IPv4
      expect(text, text).not.toMatch(/\b[0-9a-f]{1,4}(:[0-9a-f]{0,4}){2,7}\b/i); // IPv6
      expect(text, text).not.toMatch(/:\d{2,5}\b/); // a port
      expect(text, text).not.toMatch(/\bport\s+\d/i); // "port 8096"
      expect(text, text).not.toMatch(/\b([0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/i); // a MAC address
      expect(text, text).not.toMatch(/\.(local|lan|home|internal|ts\.net)\b|localhost|tailnet/i);
      expect(text, text).not.toMatch(/serial|s\/n\b/i);
    }
  });

  it('links nowhere and names no host: what\'s on the air is for the people Morgan invites', () => {
    for (const text of all) {
      // A URL anywhere in the string (any scheme), or anything shaped like a host name with any suffix.
      expect(text, text).not.toMatch(/[a-z][a-z0-9+.-]*:\/\//i);
      expect(text, text).not.toMatch(/\b[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\b/i);
    }
  });

  it('has one of each machine, and the default among them', () => {
    const ids = [...LAB_MACHINES, ...LAB_PARKED_MACHINES].map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(LAB_DEFAULT_MACHINE);
    expect(LAB_MACHINES.filter(m => m.place === 'edge').map(m => m.label)).toEqual(['THE VPS']);
    for (const machine of [...LAB_MACHINES, ...LAB_PARKED_MACHINES]) {
      expect(machine.specs.length, machine.id).toBeGreaterThan(0);
      expect(machine.runs.length, machine.id).toBeGreaterThan(0);
    }
  });

  it('keeps the Pi parked, its faceplate and model ready to come back', () => {
    expect(LAB_PARKED_MACHINES.map(m => m.id)).toEqual(['pihole']);
    expect(LAB_MACHINES.map(m => m.id)).not.toContain('pihole');
    expect(isPs1ModelKey('pihole')).toBe(true);
  });

  it('gives every machine a PS1 model that exists, the UPSes sharing one', () => {
    for (const machine of [...LAB_MACHINES, ...LAB_PARKED_MACHINES]) expect(isPs1ModelKey(machine.model), machine.id).toBe(true);
    expect(Object.fromEntries(LAB_MACHINES.map(m => [m.id, m.model]))).toEqual({
      hoss: 'hoss', switch: 'switch', jetkvm: 'jetkvm', ups1: 'ups', nas: 'nas', ups2: 'ups', vps: 'vps',
    });
  });

  it('puts the bot on the air by its Discord status, the rest by the status Worker', () => {
    const live = LAB_ON_AIR.filter(item => item.state === 'live');
    expect(live.map(item => [item.name, 'via' in item ? item.via : item.statusId])).toEqual([
      ['Foundry VTT', 'vtt'], ['Jellyfin', 'jellyfin'], ['VideoJoker', 'discord'],
    ]);
  });

  it('keeps BIG HOSS at 64 GB with the 2 TB NVMe', () => {
    const specs = LAB_MACHINES.find(m => m.id === 'hoss')!.specs;
    expect(specs.find(s => s.term === 'memory')?.detail).toBe('64 GB DDR4-2666');
    expect(specs.find(s => s.term === 'storage')?.detail).toContain('2 TB NVMe');
  });

  it('counts what runs, and on how many boxes', () => {
    expect(runningSummary()).toBe('14 things, on three boxes');
    const running = LAB_SERVICES.filter(s => s.state === 'running');
    expect(runningSummary(running.slice(0, 1))).toBe('1 thing, on one box');
    expect(runningSummary(running.filter(s => s.name === 'Tailscale'))).toBe('1 thing, on no boxes');
  });

  it('keeps the icons to plain path data', () => {
    for (const service of LAB_SERVICES) expect(service.icon, service.name).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/);
  });
});
