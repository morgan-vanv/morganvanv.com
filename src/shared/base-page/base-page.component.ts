import { Component } from '@angular/core';

@Component({
  template: './base-page.component.html',
  styleUrls: ['./base-page.component.scss'],
  standalone: true
})
export abstract class BasePageComponent {
  // Common properties and methods for all pages
}
