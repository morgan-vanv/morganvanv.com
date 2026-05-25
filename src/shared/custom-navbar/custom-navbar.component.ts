import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface NavLink {
  route: string;
  label?: string;
  icon?: string;
  ariaLabel?: string;
  exact?: boolean;
}

@Component({
  selector: 'app-custom-navbar',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './custom-navbar.component.html',
  styleUrl: './custom-navbar.component.scss'
})
export class CustomNavbarComponent {

  readonly navLinks: NavLink[] = [
    { route: '/', icon: 'exit_to_app', ariaLabel: 'Greeting', exact: true },
    { route: '/home', label: 'Home' },
    { route: '/background', label: 'Background' },
    { route: '/interests', label: 'Interests' },
    { route: '/projects', label: 'Projects' },
    { route: '/blog', label: 'Blog' },
  ];

}
