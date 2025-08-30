import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Store } from '@ngrx/store';
import { login, logout } from '../../state/auth/auth.actions';
import {
  selectAuthenticatedUser,
  selectIsAuthenticated,
} from '../../state/auth/auth.selectors';
import { User } from '../../models/user.interface';
import { LoginComponent } from '../../components/auth/login/login.component';

@Component({
  selector: 'app-header',
  imports: [CommonModule, DialogModule, ButtonModule, LoginComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {
  activeUser: User | null = null;
  isAuthenticated = false;
  showLoginDialog = false;

  constructor(private store: Store) {}

  ngOnInit() {
    this.store.select(selectAuthenticatedUser).subscribe((user) => {
      if (user) {
        this.activeUser = user;
        console.log(user);
        this.showLoginDialog = false;
        this.isAuthenticated = true;
      }
    });
  }

  onLogout() {
    this.store.dispatch(logout());
  }
}
