import { createReducer, on } from '@ngrx/store';
import { initialAuthState } from './auth.state';
import * as AuthActions from './auth.actions';

export const authReducer = createReducer(
  initialAuthState,

  on(AuthActions.login, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(AuthActions.loginSuccess, (state, { user }) => ({
    ...state,
    isAuthenticated: true,
    user,
    loading: false
  })),

  on(AuthActions.loginFailure, (state, { error }) => ({
    ...state,
    isAuthenticated: false,
    user: null,
    error,
    loading: false
  })),

  on(AuthActions.logout, () => initialAuthState)
);
