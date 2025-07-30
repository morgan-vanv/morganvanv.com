import { Component } from '@angular/core';
import { BasePageComponent} from '../../shared/base-page/base-page.component';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
  standalone: true,
  imports: [BasePageComponent]
})
export class HomePageComponent {

}
