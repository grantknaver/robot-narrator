import { createReducer, on } from '@ngrx/store';
import { AuthState, initialAuthState } from './auth.state';
import * as AuthActions from './auth.actions';

export const authReducer = createReducer(
  initialAuthState,

  on(AuthActions.login, (state: AuthState) => ({
    ...state,
    loading: true,
    error: null,
  })),

  on(AuthActions.loginSuccess, (state: AuthState, { user }) => ({
    ...state,
    isAuthenticated: true,
    user: user,
    loading: false,
  })),

  on(AuthActions.loginFailure, (state: AuthState, { error }) => ({
    ...state,
    isAuthenticated: false,
    user: null,
    error,
    loading: false,
  })),

  on(AuthActions.logout, (state: AuthState) => ({
    ...state,
    initialAuthState,
  }))
);
