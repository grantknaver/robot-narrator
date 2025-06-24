import { User } from "../../models/user.interface";

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  error: string | null;
  loading: boolean;
}

export const initialAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  error: null,
  loading: false
};
