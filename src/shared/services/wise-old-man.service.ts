import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

export interface WomSnapshot {
  skills: Record<string, WomSkill>;
  bosses: Record<string, WomBoss>;
}

export interface WomPlayer {
  id: number;
  username: string;
  displayName: string;
  exp: number;
  ehp: number;
  ehb: number;
  combatLevel: number;
  latestSnapshot: { data: WomSnapshot };
}

const BASE_URL = 'https://api.wiseoldman.net/v2';

@Injectable({ providedIn: 'root' })
export class WiseOldManService {
  private http = inject(HttpClient);

  getPlayer(username: string): Observable<WomPlayer> {
    return this.http.get<WomPlayer>(`${BASE_URL}/players/${username}`, {
      headers: { 'User-Agent': 'morganvanv.com personal site' },
    });
  }
}
