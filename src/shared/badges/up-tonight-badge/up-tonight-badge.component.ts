import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { CINCINNATI_TIME_ZONE, SkyService } from '../../sky/sky.service';
import { TonightPlanet, TonightWindow } from '../../sky/sky-tonight';

/** A height above the horizon in whole degrees, short and spelled out; anything up at all is at least 1. */
function degreesUp(alt: number): { short: string; long: string } {
  const n = Math.max(1, Math.round(alt));
  return { short: `${n}° up`, long: `${n} degree${n === 1 ? '' : 's'} up` };
}

const FIVE_MINUTES = 5 * 60_000;

/** "9:10 pm", "8 am": to the nearest five minutes, on the sky's own clock (Cincinnati's, or the browser's). */
export function clock(date: Date, timeZone?: string): string {
  const rounded = new Date(Math.round(date.getTime() / FIVE_MINUTES) * FIVE_MINUTES);
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone })
    .format(rounded)
    .replace(/\s/g, ' ')
    .replace(':00 ', ' ')
    .toLowerCase();
}

/**
 * Up tonight: the most visible things in the coming night, from the sky's own numbers
 * (`SkyService.tonight`, so `?sky-at=` moves it too): the Moon (and whether it drowns the faint
 * stars), the naked-eye planets with when they're up and when they're highest, the brightest stars
 * and the constellations overhead at prime time, and a meteor shower if one peaks about now. By
 * day it's tonight's forecast; once it's dark, how high the things up now are. Always there once
 * the sky has its numbers, saying so when there's nothing (or no dark sky) tonight. Opens the ☾ menu.
 */
@Component({
  selector: 'app-up-tonight-badge',
  imports: [BadgeComponent],
  templateUrl: './up-tonight-badge.component.html',
  styleUrl: './up-tonight-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpTonightBadgeComponent {
  protected readonly sky = inject(SkyService);

  readonly up = computed(() => {
    const night = this.sky.tonight();
    if (!night) return null;
    const mine = this.sky.location().mine;
    const zone = mine ? undefined : CINCINNATI_TIME_ZONE;
    const where = mine ? 'over you' : 'over Cincinnati';
    const title = mine ? 'In your sky tonight' : 'In the Cincinnati sky tonight';
    const cta = 'open the sky ☾';
    const finish = (value: string, popover: BadgePopover, spoken: string) => ({
      value, popover: { ...popover, title, cta } satisfies BadgePopover, label: `Up tonight ${where}: ${spoken} Opens the sky menu.`,
    });

    // Summer near the poles: the Sun never gets far enough down.
    if (!night.start) {
      const line = 'The Sun doesn\'t get far enough down for a dark sky tonight.';
      return finish('no dark sky', { title, lines: [line] }, line);
    }

    // Copy approved by Morgan (2026-10-28).
    const tooBright = `too bright for stars yet. dark from ${clock(night.start, zone)}.`;
    const dawn = night.end ? `dawn at ${clock(night.end, zone)}` : 'morning';
    const note = night.dark ? `${where} until ${dawn}` : tooBright;
    const dawnWord = night.end ? 'dawn' : 'morning';

    // When something's up: its hours, or, once it's dark and it's up now, how high it is (the live sky's number, when it has one).
    const live = new Map((this.sky.upNow()?.detail?.planets ?? []).map(p => [p.name, p.alt]));
    const when = (w: TonightWindow, liveAlt?: number) => {
      if (night.dark && w.upAtStart) return degreesUp(liveAlt ?? w.altAtStart);
      const from = w.upAtStart ? (night.dark ? 'now' : 'dusk') : clock(w.from, zone);
      const until = w.upAtEnd ? dawnWord : clock(w.until, zone);
      if (from === 'dusk' && until === 'dawn') return { short: 'all night', long: 'all night' };
      return { short: `${from}–${until}`, long: `from ${from} until ${until}` };
    };
    // A planet's best hour, if it's up for a while and not at its best right at the edge of the night.
    const best = (p: TonightPlanet) => {
      const edge = p.peak.getTime() === p.from.getTime() || p.peak.getTime() === p.until.getTime();
      return edge || p.until.getTime() - p.from.getTime() < 2 * 3_600_000 ? '' : `, highest ${clock(p.peak, zone)}`;
    };

    const rows: { label: string; value: string; spoken: string }[] = [];
    const moon = night.moon;
    if (moon?.up) {
      const lit = `${Math.round(moon.illuminated * 100)}% lit`;
      const liveMoon = this.sky.upNow()?.detail?.moon;
      const up = when(moon.up, liveMoon && liveMoon.alt > 0 ? liveMoon.alt : undefined);
      rows.push({ label: 'Moon', value: `${lit}, ${up.short}`, spoken: `the Moon, ${lit}, ${up.long}` });
    }
    for (const p of night.planets) {
      const up = when(p, live.get(p.name));
      rows.push({ label: p.name, value: up.short, spoken: `${p.name}, ${up.long}${best(p)}` });
    }

    const lines: string[] = [];
    const spokenLines: string[] = [];
    if (night.stars.length) {
      const names = night.stars.map(s => s.name).join(', ');
      lines.push(`Brightest: ${names}`);
      spokenLines.push(`the brightest stars are ${names}`);
    }
    if (night.constellations.length) {
      const names = night.constellations.join(', ');
      lines.push(`Overhead: ${names}`);
      spokenLines.push(`overhead, ${names}`);
    }
    if (night.shower) {
      const peak = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(night.shower.peak);
      lines.push(`${night.shower.name} peak ${peak}: up to ${night.shower.rate} an hour`);
      spokenLines.push(`the ${night.shower.name} meteor shower peaks ${peak}, up to ${night.shower.rate} an hour`);
    }
    if (moon?.bright) {
      lines.push('big Moon tonight. only the bright stars make it through.');
      spokenLines.push('big Moon tonight, so only the bright stars make it through');
    }

    if (!rows.length && !lines.length) {
      const line = 'nothing up tonight but the stars. which is plenty.';
      return finish('just stars', { title, lines: [line], note }, `${line}${night.dark ? '' : ` ${tooBright}`}`);
    }

    // The face names the first thing and counts the rest of the rows; the popover has them all.
    const [first, ...rest] = rows;
    const value = !first ? (night.stars[0]?.name ?? 'just stars') : rest.length ? `${first.label} +${rest.length}` : first.label;
    const spoken = [...rows.map(r => r.spoken), ...spokenLines].join('; ');
    return finish(
      value,
      { title, rows: rows.map(r => ({ label: r.label, value: r.value })), lines: lines.length ? lines : undefined, note },
      `${spoken}.${night.dark ? '' : ` ${tooBright}`}`,
    );
  });
}
