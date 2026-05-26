import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { defaultRouteTransition } from '../shared/route-transition';
import { KeyboardNavService } from '../shared/services/keyboard-nav.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  animations: [ defaultRouteTransition ]
})
export class App {
  private readonly _keyboardNav = inject(KeyboardNavService);

  prepareRoute(outlet: RouterOutlet): string | undefined {
    return outlet?.activatedRouteData?.['animation'];
  }

}
