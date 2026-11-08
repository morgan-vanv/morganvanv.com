import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DiscordService } from '../../../shared/discord/discord.service';
import { DiscordSummary } from '../../../shared/discord/discord';

/** Games listed by name; the rest are "+ N more". */
export const GAMES_SHOWN = 4;

/** The line under the join button. Morgan's words (2026-11-08). */
export const DISCORD_TAGLINE = "home to the world's greatest gaming prodigies";

/** "1 in voice", "nobody in voice". */
export function voiceLabel(n: number): string {
  return n ? `${n} in voice` : 'nobody in voice';
}

/** The status bar's three widths, as percentages of everyone online (all "around" with nobody on). */
export function statusShares(summary: DiscordSummary): { online: number; idle: number; dnd: number } {
  const { online, idle, dnd } = summary.status;
  const total = online + idle + dnd;
  if (!total) return { online: 0, idle: 0, dnd: 0 };
  const pct = (n: number) => Math.round(n / total * 1000) / 10;
  return { online: pct(online), idle: pct(idle), dnd: pct(dnd) };
}

/**
 * The Discord on /social: how many are on, how they're split, who's in voice and what's being played,
 * with a way in. Counts only, never people. Shows nothing until Discord has answered (the page's
 * `DiscordService`), so there are never made-up numbers.
 */
@Component({
  selector: 'app-discord-panel',
  templateUrl: './discord-panel.html',
  styleUrl: './discord-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscordPanelComponent {
  private readonly discord = inject(DiscordService);

  readonly summary = this.discord.summary;
  readonly tagline = DISCORD_TAGLINE;

  readonly view = computed(() => {
    const summary = this.summary();
    if (!summary) return null;
    const { online, idle, dnd } = summary.status;
    return {
      summary,
      shares: statusShares(summary),
      statusLabel: `${online} around, ${idle} idle, ${dnd} busy`,
      voice: voiceLabel(summary.inVoice),
      games: summary.games.slice(0, GAMES_SHOWN),
      moreGames: Math.max(0, summary.games.length - GAMES_SHOWN),
      joinLabel: `Pull up a chair: join ${summary.name} on Discord (opens Discord in a new tab)`,
    };
  });
}
