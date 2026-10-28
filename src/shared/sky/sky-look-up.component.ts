import { ChangeDetectionStrategy, Component, DestroyRef, Injector, afterNextRender, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { IconComponent } from '../icon/icon.component';
import { SkyService } from './sky.service';
import { StarNamingComponent } from './star-naming.component';
import { SkyCompassComponent } from './sky-compass.component';

/**
 * Look up: while the page is hidden (App fades out <main> and makes it inert),
 * a "back to the page" button in the bottom-left corner, free look's compass
 * (top-left), and the name-a-star panel when it's open. Escape closes the ☾ menu or the panel first, then leaves look-up;
 * so does any route change (← →, a link). Copy approved by Morgan (2026-10-28).
 */
@Component({
  selector: 'app-sky-look-up',
  imports: [IconComponent, StarNamingComponent, SkyCompassComponent],
  templateUrl: './sky-look-up.component.html',
  styleUrl: './sky-look-up.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkyLookUpComponent {
  protected readonly sky = inject(SkyService);
  private readonly injector = inject(Injector);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const navigation = inject(Router).events.pipe(filter(e => e instanceof NavigationStart))
      .subscribe(() => this.sky.leaveLookUp());
    destroyRef.onDestroy(() => navigation.unsubscribe());

    // On the document, so it works wherever focus is (often nowhere: the page is hidden). The ☾ menu
    // handles its own Escape first and marks it handled; the site-wide Escape (KeyboardNavService, on
    // window) skips anything handled here.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !this.sky.lookingUp()) return;
      event.preventDefault();
      // Innermost first: the ☾ menu (if focus wasn't in it, it didn't see this), the panel, then look-up itself.
      if (this.sky.menuOpen()) this.sky.menuOpen.set(false);
      else if (this.sky.naming()) this.closePanel();
      else this.backToPage();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', onKeyDown);
      destroyRef.onDestroy(() => document.removeEventListener('keydown', onKeyDown));
    }

    // Focus moves into the naming panel when it opens: the panel does that itself (it's loaded on first use).
  }

  /** Closes the panel, still looking up, and hands focus back to what opened it. */
  protected closePanel(): void {
    const opener = this.sky.namingOpener;
    this.sky.stopNaming();
    this.sky.namingOpener = null;
    this.focusAfter(opener);
  }

  protected backToPage(): void {
    const opener = this.sky.naming() ? this.sky.namingOpener : null;
    this.sky.namingOpener = null;
    this.sky.leaveLookUp();
    this.focusAfter(opener);
  }

  /** What opened the panel if it's still there, else the ☾ button (the back button is about to go). */
  private focusAfter(opener: HTMLElement | null): void {
    afterNextRender(() => {
      const target = opener?.isConnected ? opener : document.querySelector<HTMLElement>('.sky-button');
      target?.focus();
    }, { injector: this.injector });
  }
}
