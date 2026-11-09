/**
 * The lab log, for /lab: one-liners about what happened in the homelab, in Morgan's words, oldest first and
 * the newest last, the way a terminal's `tail` reads. The page shows the last few (`LAB_LOG_TAIL`) until the
 * whole log is asked for.
 *
 * No dates and no times (Morgan, 2026-11-09): the order is the array's, and the text never says when
 * ("this afternoon", "an hour later", a month's name). Facts only: names, models, what happened; never an
 * address, a port, a serial or a local hostname. `lab-log.const.spec.ts` checks all of it, as
 * `lab.const.spec.ts` does for the rest of the Lab. Add an entry as one line at the end.
 */

/** How many entries the Lab shows until "the whole log" is asked for. */
export const LAB_LOG_TAIL = 8;

// Every line is a draft, written from the infra repo's record for Morgan to rewrite in his own words.
export const LAB_LOG: readonly string[] = [
  'new CMOS battery; turned virtualization back on.',
  'pulled the plug on purpose. everything shut down in order and came back on its own.',
  'a JetKVM joined the rack, so I can watch it boot from anywhere.',
  'flashed the BIOS. over the KVM. from the couch.',
  'Pi-hole left the Pi for a container. the Pi is taking a break.',
  '64 GB of RAM. memtest found nothing.',
  'the KVM got its own charger and the case\'s power button.',
  'VideoJoker and Authentik moved in. Foundry left the NAS for a VM of its own.',
  'the bot ships itself: tag a release on GitHub and it\'s running.',
  'started keeping this log.',
];

/** The last `count` entries, in order; all of them when `count` is left out. */
export function labLogTail(entries: readonly string[] = LAB_LOG, count?: number): readonly string[] {
  return count === undefined ? entries : entries.slice(Math.max(0, entries.length - count));
}
