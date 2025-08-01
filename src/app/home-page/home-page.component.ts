import { Component } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
  standalone: true,
  imports: [BasePageComponent, MatIconModule]
})
export class HomePageComponent {

}
