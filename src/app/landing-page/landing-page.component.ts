import { Component } from '@angular/core';
import { BasePageComponent} from '../../shared/base-page/base-page.component';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss'],
  standalone: true,
  imports: [BasePageComponent]
})
export class LandingPageComponent {
  profileHeader = 'Your Profile Header';
}
