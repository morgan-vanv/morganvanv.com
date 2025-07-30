import { Component } from '@angular/core';
import {CustomNavbarComponent} from '../../shared/custom-navbar/custom-navbar.component';

@Component({
  selector: 'app-landing-page',
  imports: [
    CustomNavbarComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {

}
