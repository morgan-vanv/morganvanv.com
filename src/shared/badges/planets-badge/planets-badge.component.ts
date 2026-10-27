import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { CINCINNATI_TIME_ZONE, SkyService } from '../../sky/sky.service';
import { TonightPlanet } from '../../sky/sky-tonight';

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
 * Up tonight: the naked-eye planets in the coming night, from the sky's own numbers (`SkyService.tonight`,
 * so `?sky-at=` moves it too). By day it's tonight's forecast, each planet with the hours it's up; once
 * it's dark, how high the ones up now are, then any that rise later. Always there once the sky has its
 * numbers, saying so when there are no planets (or no dark sky) tonight. Opens the ☾ menu.
 */
@Component({
  selector: 'app-planets-badge',
  imports: [BadgeComponent],
  templateUrl: './planets-badge.component.html',
  styleUrl: './planets-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanetsBadgeComponent {
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

    // [DRAFT copy] Morgan to edit.
    const tooBright = `The sky's too bright to see them yet. Dark from ${clock(night.start, zone)}.`;
    const dawn = night.end ? `dawn at ${clock(night.end, zone)}` : 'morning';
    const note = night.dark ? `naked-eye planets ${where} until ${dawn}` : tooBright;

    if (!night.planets.length) {
      const line = 'No naked-eye planets above the horizon tonight.';
      return finish('just stars', { title, lines: [line], note }, `${line}${night.dark ? '' : ` ${tooBright}`}`);
    }

    // Once it's dark, a planet up now gets its height (the live sky's, when it has one).
    const live = new Map((this.sky.upNow()?.detail?.planets ?? []).map(p => [p.name, p.alt]));
    const describe = (p: TonightPlanet) => {
      if (night.dark && p.upAtStart) return degreesUp(live.get(p.name) ?? p.altAtStart);
      const from = p.upAtStart ? (night.dark ? 'now' : 'dusk') : clock(p.from, zone);
      const until = p.upAtEnd ? (night.end ? 'dawn' : 'morning') : clock(p.until, zone);
      if (from === 'dusk' && until === 'dawn') return { short: 'all night', long: 'all night' };
      return { short: `${from}–${until}`, long: `from ${from} until ${until}` };
    };
    const rows = night.planets.map(p => ({ name: p.name, ...describe(p) }));
    const [first, ...rest] = rows;
    return finish(
      rest.length ? `${first.name} +${rest.length}` : first.name,
      { title, rows: rows.map(r => ({ label: r.name, value: r.short })), note },
      rows.map(r => `${r.name}, ${r.long}`).join('; ') + (night.dark ? '.' : `. ${tooBright}`),
    );
  });
}
