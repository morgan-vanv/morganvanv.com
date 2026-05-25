import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';

@Component({
  selector: 'app-greeting-page',
  imports: [RouterLink, MatIconModule, MatIconButton],
  templateUrl: './greeting-page.component.html',
  styleUrl: './greeting-page.component.scss',
})
export class GreetingPageComponent {}
