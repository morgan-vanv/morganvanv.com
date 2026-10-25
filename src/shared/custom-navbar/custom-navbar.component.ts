import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent, IconName } from '../icon/icon.component';

interface NavLink {
  route: string;
  label?: string;
  icon?: IconName;
  ariaLabel?: string;
  exact?: boolean;
}

@Component({
  selector: 'app-custom-navbar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './custom-navbar.component.html',
  styleUrl: './custom-navbar.component.scss'
})
export class CustomNavbarComponent {

  readonly navLinks: NavLink[] = [
    { route: '/', icon: 'exit', ariaLabel: 'Greeting', exact: true },
    { route: '/home', label: 'Home' },
    { route: '/background', label: 'Background' },
    { route: '/social', label: 'Social' },
    { route: '/interests', label: 'Interests' },
    { route: '/projects', label: 'Projects' },
    { route: '/blog', label: 'Blog' },
  ];

}
