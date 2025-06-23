export interface AppState {
  initialized: boolean;
  isOnline: boolean;
  language: string;
  theme: 'light' | 'dark';
  loading: boolean;
  error: string | null;
}
