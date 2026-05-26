import { Component } from '@angular/core';
import { CustomNavbarComponent } from '../custom-navbar/custom-navbar.component';
import { ScrollHintComponent } from '../scroll-hint/scroll-hint.component';

@Component({
  selector: 'app-base-page',
  imports: [CustomNavbarComponent, ScrollHintComponent],
  templateUrl: './base-page.component.html',
  styleUrl: './base-page.component.scss',
})
export class BasePageComponent {}
