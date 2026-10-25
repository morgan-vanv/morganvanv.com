import { inject, Injectable } from '@angular/core';
import { ApiCacheService } from './api-cache.service';
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

export interface StatsFmTopAlbum {
  position: number;
  streams: number;
  playedMs: number;
  album: {
    id: number;
    name: string;
    image: string;
    artists: StatsFmArtist[];
  };
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

export interface StatsFmCurrentStream {
  date: string;
  isPlaying: boolean;
  progressMs: number;
  track: StatsFmTrack;
}

export type StatsFmRange = 'weeks' | 'months' | 'lifetime';

const BASE_URL = 'https://api.stats.fm/api/v1';

@Injectable({ providedIn: 'root' })
export class StatsFmService {
  private http = inject(ApiCacheService);

  getTopAlbums(username: string, range: StatsFmRange = 'months'): Observable<StatsFmTopAlbum[]> {
    return this.http
      .get<{ items: StatsFmTopAlbum[] }>(`${BASE_URL}/users/${encodeURIComponent(username)}/top/albums?range=${range}`)
      .pipe(map(r => r.items));
  }

  getTopArtists(username: string, range: StatsFmRange = 'weeks'): Observable<StatsFmTopArtist[]> {
    return this.http
      .get<{ items: StatsFmTopArtist[] }>(`${BASE_URL}/users/${encodeURIComponent(username)}/top/artists?range=${range}`)
      .pipe(map(r => r.items));
  }

  getTopTracks(username: string, range: StatsFmRange = 'weeks'): Observable<StatsFmTopTrack[]> {
    return this.http
      .get<{ items: StatsFmTopTrack[] }>(`${BASE_URL}/users/${encodeURIComponent(username)}/top/tracks?range=${range}`)
      .pipe(map(r => r.items));
  }

  getRecentStreams(username: string, limit = 10, ttlMs?: number): Observable<StatsFmRecentStream[]> {
    return this.http
      .get<{ items: StatsFmRecentStream[] }>(`${BASE_URL}/users/${encodeURIComponent(username)}/streams/recent?limit=${limit}`, ttlMs)
      .pipe(map(r => r.items ?? []));
  }

  /**
   * What's playing right now, or null when nothing is (the API answers with
   * an empty body) or the user keeps it private. Never cached.
   */
  getCurrentStream(username: string): Observable<StatsFmCurrentStream | null> {
    return this.http
      .get<{ item?: StatsFmCurrentStream | null } | null>(`${BASE_URL}/users/${encodeURIComponent(username)}/streams/current`, 0)
      .pipe(map(r => r?.item ?? null));
  }
}
