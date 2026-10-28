import { Component, inject, ChangeDetectionStrategy, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KeyboardNavService } from '../shared/services/keyboard-nav.service';
import { SkyComponent } from '../shared/sky/sky.component';
import { SkyMenuComponent } from '../shared/sky/sky-menu.component';
import { SkyLookUpComponent } from '../shared/sky/sky-look-up.component';
import { SkyService } from '../shared/sky/sky.service';
import { CampfireService } from '../shared/services/campfire.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SkyComponent, SkyMenuComponent, SkyLookUpComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly sky = inject(SkyService);

  constructor() {
    inject(KeyboardNavService);
    // One visit, counted once per tab session (on the real site only), whichever page it starts on.
    const campfire = inject(CampfireService);
    afterNextRender(() => {
      campfire.countVisit();
      // On any page, so a #host=<key> typed onto the wrong page doesn't sit in the address bar.
      void campfire.captureHostKey();
    });
  }
}
