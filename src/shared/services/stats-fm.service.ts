import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StatsFmAlbum {
  id: number;
  name: string;
  image: string;
}

export interface StatsFmArtist {
  id: number;
  name: string;
  image: string;
  genres: string[];
  followers: number;
  spotifyPopularity: number;
}

export interface StatsFmTrack {
  id: number;
  name: string;
  durationMs: number;
  explicit: boolean;
  albums: StatsFmAlbum[];
  artists: StatsFmArtist[];
  spotifyPreview: string | null;
}

export interface StatsFmTopArtist {
  position: number;
  streams: number;
  playedMs: number;
  artist: StatsFmArtist;
}

export interface StatsFmTopTrack {
  position: number;
  streams: number;
  playedMs: number;
  track: StatsFmTrack;
}

export interface StatsFmRecentStream {
  platform: string;
  endTime: string;
  track: StatsFmTrack;
}

export type StatsFmRange = 'weeks' | 'months' | 'lifetime';

const BASE_URL = 'https://api.stats.fm/api/v1';

@Injectable({ providedIn: 'root' })
export class StatsFmService {
  private http = inject(HttpClient);

  getTopArtists(username: string, range: StatsFmRange = 'weeks'): Observable<StatsFmTopArtist[]> {
    return this.http
      .get<{ items: StatsFmTopArtist[] }>(`${BASE_URL}/users/${username}/top/artists?range=${range}`)
      .pipe(map(r => r.items));
  }

  getTopTracks(username: string, range: StatsFmRange = 'weeks'): Observable<StatsFmTopTrack[]> {
    return this.http
      .get<{ items: StatsFmTopTrack[] }>(`${BASE_URL}/users/${username}/top/tracks?range=${range}`)
      .pipe(map(r => r.items));
  }

  getRecentStreams(username: string, limit = 10): Observable<StatsFmRecentStream[]> {
    return this.http
      .get<{ items: StatsFmRecentStream[] }>(`${BASE_URL}/users/${username}/streams/recent?limit=${limit}`)
      .pipe(map(r => r.items));
  }
}
