import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KeyboardNavService } from '../shared/services/keyboard-nav.service';
import { SkyComponent } from '../shared/sky/sky.component';
import { SkyMenuComponent } from '../shared/sky/sky-menu.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SkyComponent, SkyMenuComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    inject(KeyboardNavService);
  }
}
