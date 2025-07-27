import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss'],
  imports: [CommonModule, MatIconModule, MatIconButton],
})
export class LandingPageComponent {
  @Output() proceed = new EventEmitter<void>();

  onProceed() {
    this.proceed.emit();
  }
}
