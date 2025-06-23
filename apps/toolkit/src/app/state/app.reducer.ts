import { createReducer, on } from '@ngrx/store';
import { initializeApp, appInitialized } from './app.actions';
import { AppState } from './app.state';

export const initialState: AppState = {
  initialized: false,
  isOnline: true,
  language: 'EN',
  theme: 'dark',
  loading: false,
  error: null,
};

export const appReducer = createReducer(
  initialState,
  on(initializeApp, (state) => ({ ...state, initialized: false })),
  on(appInitialized, (state) => ({ ...state, initialized: true }))
);
