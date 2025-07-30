import { Component } from '@angular/core';
import { CustomNavbarComponent} from '../custom-navbar/custom-navbar.component';

@Component({
  selector: 'app-base-page',
  templateUrl: './base-page.component.html',
  styleUrls: ['./base-page.component.scss'],
  standalone: true,
  imports: [CustomNavbarComponent]
})
export class BasePageComponent {
  // Common properties and methods for all pages
}
