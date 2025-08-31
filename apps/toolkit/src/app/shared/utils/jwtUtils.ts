import { jwtDecode, JwtPayload } from 'jwt-decode';
import { TOKEN_KEY } from '../constants';

type MyJwtClaims = {
  sub: string;
  email: string;
  role: string;
  userId: string; // Special claim from backend
  name?: string;
  jti?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
};

function stripBearer(t: string) {
  return t.replace(/^Bearer\s+/i, '');
}

export function hasValidToken(): boolean {
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

export function getUserIdFromToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const { userId } = jwtDecode<MyJwtClaims>(stripBearer(token));
    return userId ?? null;
  } catch {
    return null;
  }
}
