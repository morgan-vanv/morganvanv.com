import { Component } from '@angular/core';
import { CustomNavbarComponent } from '../custom-navbar/custom-navbar.component';

@Component({
  selector: 'app-base-page',
  imports: [CustomNavbarComponent],
  templateUrl: './base-page.component.html',
  styleUrl: './base-page.component.scss',
})
export class BasePageComponent {}
