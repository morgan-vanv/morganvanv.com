import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { defaultRouteTransition } from '../shared/route-transition';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  animations: [ defaultRouteTransition ]
})
export class App {
  protected readonly title = signal('morganvanv.com');

  prepareRoute(outlet: RouterOutlet) {
    return outlet?.activatedRouteData?.['animation'];
  }

}
