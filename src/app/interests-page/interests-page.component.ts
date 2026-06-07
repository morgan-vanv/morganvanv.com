import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { VerticalNavContainerComponent } from '../../shared/vertical-nav/vertical-nav-container.component';
import { VerticalNavItemComponent } from '../../shared/vertical-nav/vertical-nav-item.component';
import { StatsFmService, StatsFmTopArtist, StatsFmTopAlbum, StatsFmTopTrack } from '../../shared/services/stats-fm.service';
import { OsrsStatsComponent } from './osrs-stats/osrs-stats';
import { Observable, map, catchError, of } from 'rxjs';
import { WOM_USERNAME, POWERED_BY_LINKS } from '../../shared/constants/osrs-stats.const';

const STATSFM_USERNAME = 'morgan.vanv';
const STATS_DISPLAY_LIMIT = 8;

@Component({
  selector: 'app-interests-page',
  imports: [BasePageComponent, AsyncPipe, OsrsStatsComponent, VerticalNavContainerComponent, VerticalNavItemComponent],
  templateUrl: './interests-page.component.html',
  styleUrl: './interests-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterestsPageComponent {
  readonly womUsername = WOM_USERNAME;
  readonly poweredByLinks = POWERED_BY_LINKS;

  private statsFm = inject(StatsFmService);

  topTracks$: Observable<StatsFmTopTrack[]> = this.statsFm.getTopTracks(STATSFM_USERNAME, 'weeks').pipe(
    map(items => [...items].sort((a, b) => b.streams - a.streams).slice(0, STATS_DISPLAY_LIMIT)),
    catchError(() => of([]))
  );
  topAlbums$: Observable<StatsFmTopAlbum[]> = this.statsFm.getTopAlbums(STATSFM_USERNAME, 'months').pipe(
    map(items => [...items].sort((a, b) => b.streams - a.streams).slice(0, STATS_DISPLAY_LIMIT)),
    catchError(() => of([]))
  );
  topArtists$: Observable<StatsFmTopArtist[]> = this.statsFm.getTopArtists(STATSFM_USERNAME, 'lifetime').pipe(
    map(items => items.slice(0, STATS_DISPLAY_LIMIT)),
    catchError(() => of([]))
  );

  formatPlaytime(ms: number): string {
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}
