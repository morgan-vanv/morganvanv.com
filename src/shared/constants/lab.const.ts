/**
 * The homelab, for /lab: the machines in the office rack and the closet, the VPS out front, and what
 * they run. Facts only (names, models, specs). Never an address, a port, a serial, a hostname inside the
 * house or anything else that locates a machine; `lab.const.spec.ts` looks for the obvious shapes.
 * From the approved Lab A2 mockup (2026-11-05); `[TODO: Morgan]` where he hasn't said yet.
 */

export type LabMachineId = 'hoss' | 'switch' | 'ups1' | 'nas' | 'pihole' | 'ups2' | 'vps';

/** Where a machine lives: the office rack, the closet shelf, or out front (the one public door). */
export type LabPlace = 'rack' | 'closet' | 'edge';

export interface LabSpec {
  term: string;
  detail: string;
}

export interface LabMachine {
  id: LabMachineId;
  place: LabPlace;
  /** The faceplate: its name in caps and a short line under it. */
  label: string;
  sub: string;
  /** Rack units, roughly: a 2U faceplate is taller. */
  height: 1 | 2;
  /** What's drawn on the faceplate's right end. */
  face?: 'vent' | 'bays' | 'ports';
  /** Power gear shows amber, everything else green. */
  led: 'green' | 'amber';
  /** The spec sheet. */
  name: string;
  role: string;
  specs: readonly LabSpec[];
  runs: readonly string[];
}

export const LAB_MACHINES: readonly LabMachine[] = [
  {
    id: 'hoss', place: 'rack', label: 'BIG HOSS', sub: 'Proxmox host', height: 2, face: 'vent', led: 'green',
    name: 'BIG HOSS', role: 'the Proxmox host',
    specs: [
      { term: 'cpu', detail: 'AMD Threadripper 1920X, 12 cores' },
      { term: 'memory', detail: '64 GB DDR4-2666' },
      { term: 'gpu', detail: 'GTX 1660' },
      { term: 'storage', detail: '2 × 12 TB HGST in a ZFS mirror; 512 GB + 2 TB NVMe' },
      { term: 'board', detail: 'Gigabyte X399 Designare EX' },
      { term: 'extras', detail: 'an LSI SAS HBA in IT mode' },
      { term: 'power', detail: 'the rack UPS, shuts down in order' },
    ],
    runs: ['a handful of VMs and containers', 'nightly guest backups', 'the subnet route', 'Uptime Kuma'],
  },
  {
    id: 'switch', place: 'rack', label: 'FLEX MINI', sub: 'the office switch', height: 1, face: 'ports', led: 'green',
    name: 'UniFi Flex Mini', role: 'the office switch',
    specs: [
      { term: 'ports', detail: '5 × gigabit' },
      { term: 'joins', detail: 'BIG HOSS and battlestation to the house' },
      { term: 'since', detail: 'October 2026' },
    ],
    runs: ['the office end of the network'],
  },
  {
    id: 'ups1', place: 'rack', label: 'UPS', sub: 'CyberPower 1500', height: 1, led: 'amber',
    name: 'CyberPower CP1500', role: 'the rack UPS',
    specs: [
      { term: 'keeps up', detail: 'BIG HOSS, the switch, a Wi-Fi node' },
      { term: 'talks to', detail: 'BIG HOSS over USB (NUT)' },
      { term: 'on outage', detail: 'guests stop in order, then the host' },
    ],
    runs: ['an ordered shutdown'],
  },
  {
    id: 'nas', place: 'closet', label: 'FALKENBURGHNAS', sub: 'Synology DS918+', height: 2, face: 'bays', led: 'green',
    name: 'FalkenburghNAS', role: 'storage, backups, the media house',
    specs: [
      { term: 'model', detail: 'Synology DS918+, 16 GB' },
      { term: 'drives', detail: '2 × 8 TB IronWolf, 2 × 14 TB Exos (SHR-1)' },
      { term: 'cache', detail: '2 × 250 GB WD Red NVMe' },
      { term: 'backups', detail: 'snapshots, a nightly USB drive, and off-site' },
      { term: 'power', detail: 'the closet UPS' },
    ],
    runs: ['Jellyfin', 'Foundry VTT (for now)', 'the backup hub'],
  },
  {
    id: 'pihole', place: 'closet', label: 'PI-HOLE', sub: 'Raspberry Pi 2', height: 1, led: 'green',
    name: 'Pi-hole', role: 'DNS for my devices',
    specs: [
      { term: 'board', detail: 'Raspberry Pi 2' },
      { term: 'does', detail: 'DNS and ad blocking for my own devices' },
    ],
    runs: ['Pi-hole'],
  },
  {
    id: 'ups2', place: 'closet', label: 'UPS', sub: 'APC 600', height: 1, led: 'amber',
    name: 'APC Back-UPS 600', role: 'the closet UPS',
    specs: [
      { term: 'keeps up', detail: 'the NAS, the modem, a Wi-Fi node, the Pi-hole' },
      { term: 'talks to', detail: 'the NAS over USB' },
    ],
    runs: ['an ordered shutdown'],
  },
  {
    id: 'vps', place: 'edge', label: 'THE VPS', sub: 'one small droplet, the only public door', height: 1, led: 'green',
    name: 'The VPS', role: 'the front door',
    specs: [
      { term: 'size', detail: '1 GB RAM, 25 GB disk' },
      { term: 'runs', detail: 'Caddy and CrowdSec' },
      { term: 'reaches home', detail: 'over Tailscale, nothing else' },
    ],
    runs: ['Caddy', 'CrowdSec', 'a game relay, later'],
  },
];

/** The machine selected when the page loads (and in the prerendered HTML). */
export const LAB_DEFAULT_MACHINE: LabMachineId = 'hoss';

/** What the status Worker reports on (`SITE_CONFIG.labStatusUrl`). */
export type LabStatusId = 'vtt' | 'jellyfin';

/** "On the air": what friends and family can reach. A live one gets an up/down pill from the status Worker. */
export type LabOnAir = {
  name: string;
  what: string;
  /** Where it opens, for the ones a visitor can open. */
  url?: string;
} & ({ state: 'live'; statusId: LabStatusId } | { state: 'under-construction' });

export const LAB_ON_AIR: readonly LabOnAir[] = [
  { name: 'Foundry VTT', what: 'my Vampire: The Masquerade table', state: 'live', statusId: 'vtt' },
  { name: 'Jellyfin', what: 'my movies and shows', state: 'live', statusId: 'jellyfin' },
  { name: 'VideoJoker', what: 'the Discord bot, always on', state: 'under-construction' },
  { name: 'a forever world', what: 'an always-on Minecraft server', state: 'under-construction' },
  { name: 'my retro library', what: 'my collection of old games, dumped, and playable via browser', state: 'under-construction' },
];

/**
 * "Everything I'm running": one row each, with a line icon (an SVG path on a 24-unit grid, stroked).
 * A running one says where (`where`, and `box`, the machine it counts towards; none for what runs everywhere).
 */
export type LabService = {
  name: string;
  what: string;
  icon: string;
} & ({ state: 'running'; where: string; box: LabMachineId | null } | { state: 'under-construction' });

export const LAB_SERVICES: readonly LabService[] = [
  { name: 'Proxmox VE', what: 'one job per guest, each with its own firewall', state: 'running', where: 'BIG HOSS', box: 'hoss',
    icon: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01' },
  { name: 'Jellyfin', what: 'movies and shows for friends and family', state: 'running', where: 'the NAS', box: 'nas',
    icon: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM10 8.5l5 3.5l-5 3.5z' },
  { name: 'Foundry VTT', what: 'my Vampire: The Masquerade table', state: 'running', where: 'the NAS', box: 'nas',
    icon: 'M12 2l9 5v10l-9 5l-9-5V7zM12 22V12M21 7l-9 5L3 7' },
  { name: 'Pi-hole', what: 'DNS and ad blocking for my devices', state: 'running', where: 'a Pi 2', box: 'pihole',
    icon: 'M12 3l8 3v6c0 4.5-3.4 8.2-8 9c-4.6-.8-8-4.5-8-9V6z' },
  { name: 'Syncthing', what: 'my notes, synced between my devices', state: 'running', where: 'BIG HOSS', box: 'hoss',
    icon: 'M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18 3v4h-4M6 21v-4h4' },
  { name: 'Uptime Kuma', what: 'watches everything, pings my Discord', state: 'running', where: 'BIG HOSS', box: 'hoss',
    icon: 'M3 12h4l2-6l4 12l2-6h6' },
  { name: 'Tailscale', what: 'the private network between it all', state: 'running', where: 'everywhere', box: null,
    icon: 'M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01' },
  { name: 'Caddy', what: 'the front door, HTTPS included', state: 'running', where: 'the VPS', box: 'vps',
    icon: 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12h.01' },
  { name: 'CrowdSec', what: 'turns away whoever is knocking too hard', state: 'running', where: 'the VPS', box: 'vps',
    icon: 'M12 3l8 3v6c0 4.5-3.4 8.2-8 9c-4.6-.8-8-4.5-8-9V6zM9.5 9.5l5 5M14.5 9.5l-5 5' },
  { name: 'Backups', what: 'snapshots, a nightly drive, and off-site', state: 'running', where: 'the NAS', box: 'nas',
    icon: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4' },
  { name: 'NUT', what: 'tells everything when the power goes', state: 'running', where: 'BIG HOSS', box: 'hoss',
    icon: 'M3 8h15v8H3zM21 11v2M7 11h4' },
  { name: 'Claude Code', what: 'runs my weekly health checks', state: 'running', where: 'BIG HOSS', box: 'hoss',
    icon: 'M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM12 4v4M9.5 13h.01M14.5 13h.01' },
  { name: 'Authentik', what: 'one login for friends and family', state: 'under-construction',
    icon: 'M14 10a4 4 0 1 0-4 4M10 14l-7 7M6 18l2 2M14 10h7v4' },
  { name: 'VideoJoker', what: 'the Discord bot, always on', state: 'under-construction',
    icon: 'M4 5h16v11H9l-5 4z' },
  { name: 'Minecraft', what: 'a forever world', state: 'under-construction',
    icon: 'M12 2l9 5v10l-9 5l-9-5V7zM12 12l9-5M12 12L3 7M12 12v10' },
  { name: 'RomM', what: 'a retro library in the browser', state: 'under-construction',
    icon: 'M12 3a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM12 9v6M5 15h14v4H5z' },
];

/** The quiet row at the bottom: computers in the house that aren't part of the lab. */
export const LAB_AROUND_THE_HOUSE: readonly string[] = [
  'battlestation · Ryzen 7, RTX 3070',
  'Bambu Lab P1S',
  'ThinkPad X220, waiting for a job',
  '4 × Pi Zero',
];

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** "12 things, on four boxes": the running rows, and the machines they run on (Tailscale, everywhere, adds none). */
export function runningSummary(services: readonly LabService[] = LAB_SERVICES): string {
  const running = services.filter(s => s.state === 'running');
  const boxes = new Set(running.map(s => s.box).filter(box => box !== null)).size;
  const things = `${running.length} ${running.length === 1 ? 'thing' : 'things'}`;
  return `${things}, on ${COUNT_WORDS[boxes] ?? boxes} ${boxes === 1 ? 'box' : 'boxes'}`;
}
