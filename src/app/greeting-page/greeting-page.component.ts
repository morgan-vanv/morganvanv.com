import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-greeting-page',
  templateUrl: './greeting-page.component.html',
  styleUrls: ['./greeting-page.component.scss'],
  imports: [CommonModule, MatIconModule, MatIconButton],
})
export class GreetingPageComponent {

  constructor(private router: Router) {}

  onProceedGreetingMessage() {
    this.router.navigate(['/home']);
  }

}
