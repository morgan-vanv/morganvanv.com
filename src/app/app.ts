import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {LandingPage} from './landing-page/landing-page';
import {SplashdownPage} from './splashdown-page/splashdown-page';
import {Canvas} from './canvas/canvas';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LandingPage, SplashdownPage, Canvas],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('morganvanv.com');
}
