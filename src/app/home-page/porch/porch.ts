import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecentStreamService } from '../../../shared/services/recent-stream.service';
import { CINCINNATI_TIME_ZONE, SkyService } from '../../../shared/sky/sky.service';
import { litPath } from '../../../shared/badges/moon-badge/moon-phase';
import { DiscordService } from '../../../shared/discord/discord.service';
import { DISCORD_TAGLINE, discordDetail } from '../../../shared/discord/discord';
import { LabStatusService } from '../../lab-page/lab-status.service';
import { moonLine, onAirLines, planetLine } from './porch-lines';

/**
 * Home's porch: what's going on around the place right now, in Morgan's order (2026-11-09): what's
 * on the record player (stats.fm), tonight's sky (the sky's own numbers), the Discord (as `/now`'s
 * Hanging out row) and what's on the air in the lab. Each one leads somewhere. Nothing waits on a
 * feed to look finished: until one answers, its spot shows a resting line (prerendered, so
 * hydration matches) and the lab's names show without lights.
 */
@Component({
  selector: 'app-home-porch',
  imports: [RouterLink],
  templateUrl: './porch.html',
  styleUrl: './porch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Both poll only while Home is open, and stop with it.
  providers: [DiscordService, LabStatusService],
})
export class HomePorchComponent {
  private readonly recentStream = inject(RecentStreamService);
  private readonly sky = inject(SkyService);
  private readonly discord = inject(DiscordService);
  private readonly labStatus = inject(LabStatusService);
  private readonly injector = inject(Injector);

  readonly tagline = DISCORD_TAGLINE;

  /** The last track from stats.fm, or null. */
  readonly record = computed(() => {
    const item = this.recentStream.lastListened();
    if (!item) return null;
    return {
      title: item.trackName,
      artist: item.artistName,
      cover: item.imageUrl,
      playing: item.isPlaying,
      when: item.isPlaying ? 'right now' : this.recentStream.when(),
    };
  });

  readonly skyLabel = computed(() => this.sky.location().mine ? 'tonight over you' : 'tonight over Cincinnati');

  /** The Moon now and the night's first planet, once the sky has worked them out (in the browser). */
  readonly tonight = computed(() => {
    const moon = this.sky.upNow()?.detail?.moon ?? null;
    const night = this.sky.tonight();
    if (!moon && !night) return null;
    const location = this.sky.location();
    return {
      moon: moon ? moonLine(moon) : null,
      path: moon ? litPath(moon.phase, 20, 20, 15) : '',
      // Seen from south of the equator the lit side is the other one.
      southern: location.lat < 0,
      planets: night ? planetLine(night, location.mine ? undefined : CINCINNATI_TIME_ZONE) : null,
    };
  });

  /** The Discord, counts only (as `/now`'s Hanging out row), or null. */
  readonly hangingOut = computed(() => {
    const summary = this.discord.summary();
    return summary ? { name: summary.name, detail: discordDetail(summary) } : null;
  });

  readonly onAir = computed(() =>
    onAirLines(id => this.labStatus.stateOf(id), this.discord.summary()?.botOnline ?? null));

  /** Hides the page, as the greeting's "or just look up" does; focus goes to the ☾ (this button is about to be inert). */
  protected lookUp(): void {
    this.sky.enterLookUp();
    afterNextRender(() => {
      (document.querySelector<HTMLElement>('.sky-button') ?? document.querySelector<HTMLElement>('app-sky-look-up .back'))?.focus();
    }, { injector: this.injector });
  }
}
