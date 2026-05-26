import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { StatsFmService, StatsFmTopArtist, StatsFmTopAlbum, StatsFmTopTrack } from '../../shared/services/stats-fm.service';
import { WiseOldManService, WomPlayer, WomBoss } from '../../shared/services/wise-old-man.service';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';

const STATSFM_USERNAME = 'morgan.vanv';
const WOM_USERNAME = 'TipodissDong';
const STATS_DISPLAY_LIMIT = 8;

// Ordered to match the in-game Skills tab layout (3 columns, top to bottom)
const SKILL_ORDER = [
  'attack',       'hitpoints',    'mining',
  'strength',     'agility',      'smithing',
  'defence',      'herblore',     'fishing',
  'ranged',       'thieving',     'cooking',
  'prayer',       'crafting',     'firemaking',
  'magic',        'fletching',    'woodcutting',
  'runecrafting', 'slayer',       'farming',
  'construction', 'hunter',       'sailing',
] as const;

@Component({
  selector: 'app-interests-page',
  imports: [BasePageComponent, AsyncPipe],
  templateUrl: './interests-page.component.html',
  styleUrl: './interests-page.component.scss'
})
export class InterestsPageComponent implements OnInit {
  private statsFm = inject(StatsFmService);
  private wom = inject(WiseOldManService);

  topTracks$!: Observable<StatsFmTopTrack[]>;
  topAlbums$!: Observable<StatsFmTopAlbum[]>;
  topArtists$!: Observable<StatsFmTopArtist[]>;
  player$!: Observable<WomPlayer>;

  topBosses: WomBoss[] = [];

  readonly skillOrder = SKILL_ORDER;
  readonly womUsername = WOM_USERNAME;
  readonly womProfileUrl = `https://wiseoldman.net/players/${WOM_USERNAME.toLowerCase()}`;
  readonly runeprofileUrl = `https://www.runeprofile.com/${WOM_USERNAME}`;

  ngOnInit(): void {
    this.topTracks$ = this.statsFm.getTopTracks(STATSFM_USERNAME, 'weeks').pipe(
      map(items => items.slice(0, STATS_DISPLAY_LIMIT))
    );
    this.topAlbums$ = this.statsFm.getTopAlbums(STATSFM_USERNAME, 'months').pipe(
      map(items => items.slice(0, STATS_DISPLAY_LIMIT))
    );
    this.topArtists$ = this.statsFm.getTopArtists(STATSFM_USERNAME, 'lifetime').pipe(
      map(items => items.slice(0, STATS_DISPLAY_LIMIT))
    );
    this.player$ = this.wom.getPlayer(WOM_USERNAME).pipe(
      tap(p => { this.topBosses = this.sortBosses(p); })
    );
  }

  formatPlaytime(ms: number): string {
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  getSkillIcon(skill: string): string {
    const name = skill.charAt(0).toUpperCase() + skill.slice(1);
    return `https://oldschool.runescape.wiki/images/${name}_icon.png`;
  }

  formatBossName(metric: string): string {
    return metric.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  formatNumber(n: number): string {
    return Math.round(n).toLocaleString();
  }

  private sortBosses(player: WomPlayer): WomBoss[] {
    return Object.values(player.latestSnapshot.data.bosses)
      .filter(b => b.kills > 0)
      .sort((a, b) => b.kills - a.kills);
  }
}

