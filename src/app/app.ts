import { Component } from '@angular/core';
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

  prepareRoute(outlet: RouterOutlet): string | undefined {
    return outlet?.activatedRouteData?.['animation'];
  }

}
