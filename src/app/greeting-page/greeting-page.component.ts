import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';

@Component({
  selector: 'app-greeting-page',
  imports: [MatIconModule, MatIconButton],
  templateUrl: './greeting-page.component.html',
  styleUrl: './greeting-page.component.scss',
})
export class GreetingPageComponent {

  private router = inject(Router);

  onProceedGreetingMessage(): void {
    this.router.navigate(['/home']);
  }

}
