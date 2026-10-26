import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { VerticalNavContainerComponent } from '../../shared/vertical-nav/vertical-nav-container.component';
import { VerticalNavItemComponent } from '../../shared/vertical-nav/vertical-nav-item.component';
import { StatsFmService, StatsFmTopArtist, StatsFmTopAlbum, StatsFmTopTrack } from '../../shared/services/stats-fm.service';
import { OsrsStatsComponent } from './osrs-stats/osrs-stats';
import { LastListenedComponent } from '../../shared/last-listened/last-listened.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { OsrsPreviewComponent } from './osrs-stats/osrs-preview/osrs-preview';
import { Observable, map, catchError, of } from 'rxjs';
import { WOM_USERNAME, POWERED_BY_LINKS } from '../../shared/constants/osrs-stats.const';
import { SITE_CONFIG } from '../../shared/config/site.config';
import { isUnderConstruction } from '../../shared/constants/under-construction.const';

const STATSFM_USERNAME = SITE_CONFIG.handles.statsFm;
const STATS_DISPLAY_LIMIT = 8;

export type MusicList = 'songs' | 'albums' | 'artists';

@Component({
  selector: 'app-interests-page',
  imports: [BasePageComponent, AsyncPipe, OsrsStatsComponent, VerticalNavContainerComponent, VerticalNavItemComponent, LastListenedComponent, PageHeaderComponent, OsrsPreviewComponent],
  templateUrl: './interests-page.component.html',
  styleUrl: './interests-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterestsPageComponent {
  readonly womUsername = WOM_USERNAME;
  readonly statsFmProfileUrl = `https://stats.fm/user/${STATSFM_USERNAME}`;
  readonly discogsCollectionUrl = `https://www.discogs.com/user/${SITE_CONFIG.handles.discogs}/collection`;
  readonly poweredByLinks = POWERED_BY_LINKS;
  readonly mediaUnderConstruction = isUnderConstruction('favorite-media');
  readonly photosUnderConstruction = isUnderConstruction('my-photos');

  /** Tablets and phones show one top list at a time. */
  readonly listTabs: readonly { id: MusicList; label: string }[] = [
    { id: 'songs', label: 'Songs' },
    { id: 'albums', label: 'Albums' },
    { id: 'artists', label: 'Artists' },
  ];
  readonly activeList = signal<MusicList>('songs');

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

  /** "210 hrs", "1 hr", "45 min" — whole units only, so it fits in a list row. */
  formatPlaytime(ms: number): string {
    const hours = Math.floor(ms / 3_600_000);
    if (hours >= 2) return `${hours.toLocaleString()} hrs`;
    if (hours === 1) return '1 hr';
    return `${Math.floor(ms / 60_000)} min`;
  }
}
