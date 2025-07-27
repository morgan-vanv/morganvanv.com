import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-greeting-page',
  templateUrl: './greeting-page.component.html',
  styleUrls: ['./greeting-page.component.scss'],
  imports: [CommonModule, MatIconModule, MatIconButton],
})
export class GreetingPageComponent {
  @Output() proceed = new EventEmitter<void>();

  onProceed() {
    this.proceed.emit();
  }
}
