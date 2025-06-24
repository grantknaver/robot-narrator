import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { Store } from '@ngrx/store';
import { login, logout } from '../../state/auth/auth.actions';
import {
  selectAuthenticatedUser,
  selectIsAuthenticated,
} from '../../state/auth/auth.selectors';
import { User } from '../../models/user.interface';

@Component({
  selector: 'app-header',
  imports: [CommonModule, ButtonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  activeUser: User | null = null;
  isAuthenticated = false;
  constructor(private store: Store) {}

  ngOnInit() {
    this.store.select(selectAuthenticatedUser).subscribe((user) => {
      if (user) {
        this.activeUser = user;
        console.log(user);
        this.isAuthenticated = true;
      }
    });
  }

  onLogin() {
    this.store.dispatch(
      login({ email: 'lisacope@msn.com', password: 'Testing123!' })
    );
  }

  onLogout() {
    this.store.dispatch(logout());
  }
}
