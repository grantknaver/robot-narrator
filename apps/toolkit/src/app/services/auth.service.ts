import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { User } from '../models/user.interface';
import { TOKEN_KEY } from '../shared/constants';

export interface LoginRequest {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly baseUrl = 'http://localhost:3000/api/Auth'; // Adjust base URL if needed

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/login`, credentials);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {});
  }

  hasValidToken(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;
    try {
      const { exp } = jwtDecode<JwtPayload>(token);
      if (!exp) return true; // no exp => treat as valid
      const nowSec = Math.floor(Date.now() / 1000);
      return exp > nowSec;
    } catch {
      return false;
    }
  }
}
