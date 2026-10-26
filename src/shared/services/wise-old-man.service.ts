import { Injectable, inject } from '@angular/core';
import { ApiCacheService } from './api-cache.service';
import { Observable } from 'rxjs';

export interface WomSkill {
  metric: string;
  experience: number;
  rank: number;
  level: number;
  ehp: number;
}

export interface WomBoss {
  metric: string;
  kills: number;
  rank: number;
  ehb: number;
}

export interface WomActivity {
  metric: string;
  score: number;
  rank: number;
}

export interface WomSnapshot {
  skills: Record<string, WomSkill>;
  bosses: Record<string, WomBoss>;
  activities: Record<string, WomActivity>;
}

export interface WomPlayer {
  id: number;
  username: string;
  displayName: string;
  exp: number;
  ehp: number;
  ehb: number;
  /** Efficient hours to max, per Wise Old Man (0 once maxed). */
  ttm?: number;
  combatLevel: number;
  latestSnapshot: { data: WomSnapshot };
}

const BASE_URL = 'https://api.wiseoldman.net/v2';

@Injectable({ providedIn: 'root' })
export class WiseOldManService {
  private http = inject(ApiCacheService);

  getPlayer(username: string): Observable<WomPlayer> {
    return this.http.get<WomPlayer>(`${BASE_URL}/players/${encodeURIComponent(username)}`);
  }
}
