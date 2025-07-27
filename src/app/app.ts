import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {LandingPageComponent} from './landing-page/landing-page.component';
import {SplashdownPageComponent} from './splashdown-page/splashdown-page.component';
import {ViewManager} from './view-manager/view-manager';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LandingPageComponent, SplashdownPageComponent, ViewManager],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('morganvanv.com');
}
