import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { ScrollHintComponent } from '../../shared/scroll-hint/scroll-hint.component';
import { StatsFmService, StatsFmTopArtist, StatsFmTopAlbum, StatsFmTopTrack } from '../../shared/services/stats-fm.service';
import { OsrsStatsComponent } from './osrs-stats/osrs-stats';
import { Observable, map, catchError, of } from 'rxjs';

const STATSFM_USERNAME = 'morgan.vanv';
const STATS_DISPLAY_LIMIT = 8;

@Component({
  selector: 'app-interests-page',
  imports: [BasePageComponent, AsyncPipe, ScrollHintComponent, OsrsStatsComponent],
  templateUrl: './interests-page.component.html',
  styleUrl: './interests-page.component.scss'
})
export class InterestsPageComponent {
  private statsFm = inject(StatsFmService);

  topTracks$: Observable<StatsFmTopTrack[]> = this.statsFm.getTopTracks(STATSFM_USERNAME, 'weeks').pipe(
    map(items => items.slice(0, STATS_DISPLAY_LIMIT)),
    catchError(() => of([]))
  );
  topAlbums$: Observable<StatsFmTopAlbum[]> = this.statsFm.getTopAlbums(STATSFM_USERNAME, 'months').pipe(
    map(items => items.slice(0, STATS_DISPLAY_LIMIT)),
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
