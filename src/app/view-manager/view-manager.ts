import { Component } from '@angular/core';
import { LandingPageComponent } from '../landing-page/landing-page.component';
import { SplashdownPageComponent } from '../splashdown-page/splashdown-page.component';
import {CommonModule} from '@angular/common';


@Component({
  selector: 'app-view-manager',
  standalone: true,
  imports: [CommonModule, LandingPageComponent, SplashdownPageComponent],
  templateUrl: './view-manager.html',
  styleUrl: './view-manager.scss'
})
export class ViewManager {
  currentView: 'landing' | 'splashdown' = 'landing';

  onLandingComplete() {
    this.currentView = 'splashdown';
  }
}
