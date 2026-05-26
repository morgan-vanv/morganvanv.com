import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent } from 'rxjs';

const NAV_ROUTES = ['/home', '/background', '/interests', '/projects', '/blog'];

@Injectable({ providedIn: 'root' })
export class KeyboardNavService {
  private readonly router = inject(Router);

  constructor() {
    fromEvent<KeyboardEvent>(document, 'keydown')
      .subscribe(e => this.onKeyDown(e));
  }

  private onKeyDown(e: KeyboardEvent): void {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

    const currentPath = '/' + this.router.url.split('/')[1];

    if (currentPath === '/') {
      if (e.key.startsWith('Arrow')) this.router.navigate(['/home']);
      return;
    }

    if (e.key === 'Escape') {
      this.router.navigate(['/']);
      return;
    }

    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    const idx = NAV_ROUTES.indexOf(currentPath);
    if (idx === -1) return;

    const nextIdx = e.key === 'ArrowLeft' ? idx - 1 : idx + 1;
    if (nextIdx >= 0 && nextIdx < NAV_ROUTES.length) {
      this.router.navigate([NAV_ROUTES[nextIdx]]);
    }
  }
}
