import { Component, OnInit, inject } from '@angular/core';
import {NavigationEnd, Router, RouterModule } from '@angular/router';

import { filter } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-custom-navbar',
  imports: [RouterModule, MatIconModule],
  templateUrl: './custom-navbar.component.html',
  styleUrl: './custom-navbar.component.scss'
})
export class CustomNavbarComponent implements OnInit {
  currentRoute = '';

  private router = inject(Router);

  ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute = event.url;
      });

    // Set initial route
    this.currentRoute = this.router.url;
  }

  isActive(route: string): boolean {
    return this.currentRoute === route;
  }
}
