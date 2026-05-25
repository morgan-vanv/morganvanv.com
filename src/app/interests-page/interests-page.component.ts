import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { StatsFmService, StatsFmTopArtist, StatsFmTopAlbum, StatsFmTopTrack } from '../../shared/services/stats-fm.service';
import { Observable } from 'rxjs';

const STATSFM_USERNAME = 'morgan.vanv';

@Component({
  selector: 'app-interests-page',
  imports: [BasePageComponent, AsyncPipe],
  templateUrl: './interests-page.component.html',
  styleUrl: './interests-page.component.scss'
})
export class InterestsPageComponent implements OnInit {
  private statsFm = inject(StatsFmService);

  topTracks$!: Observable<StatsFmTopTrack[]>;
  topAlbums$!: Observable<StatsFmTopAlbum[]>;
  topArtists$!: Observable<StatsFmTopArtist[]>;

  ngOnInit(): void {
    this.topTracks$ = this.statsFm.getTopTracks(STATSFM_USERNAME, 'weeks');
    this.topAlbums$ = this.statsFm.getTopAlbums(STATSFM_USERNAME, 'months');
    this.topArtists$ = this.statsFm.getTopArtists(STATSFM_USERNAME, 'lifetime');
  }

  formatPlaytime(ms: number): string {
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

