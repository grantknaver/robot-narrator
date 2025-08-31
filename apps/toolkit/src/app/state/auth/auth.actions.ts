import { createAction, props } from '@ngrx/store';
import { User } from '../../models/user.interface';

export const login = createAction(
  '[Auth] Login',
  props<{ email: string; password: string }>()
);

export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ user: User }>()
);

export const logoutSuccess = createAction('[Auth] Logout Success');

export const loginFailure = createAction(
  '[Auth] Login Failure',
  props<{ error: string }>()
);

export const tokenRestored = createAction(
  '[Auth] Token Restored',
  props<{ token: string; user: User }>()
);

export const logout = createAction('[Auth] Logout');
