import { Component } from '@angular/core';
import {CommonModule} from '@angular/common';
import {GreetingPageComponent} from '../greeting-page/greeting-page.component';
import {LandingPageComponent} from '../landing-page/landing-page.component';


@Component({
  selector: 'app-view-manager',
  standalone: true,
  imports: [CommonModule, GreetingPageComponent, LandingPageComponent],
  templateUrl: './view-manager.html',
  styleUrl: './view-manager.scss'
})
export class ViewManager {
  currentView: 'greeting' | 'landing' = 'greeting';

  onLandingComplete() {
    this.currentView = 'landing';
  }
}
