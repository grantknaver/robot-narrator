import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { TOKEN_KEY } from '../shared/constants';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    console.log('hi from the authInterceptor');
    const token = localStorage.getItem(TOKEN_KEY);

    // Don't attach token to auth routes
    const isAuthRoute =
      req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

    const authReq =
      token && !isAuthRoute
        ? req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`,
            },
          })
        : req;

    return next.handle(authReq).pipe(
      tap((event) => {
        if (event instanceof HttpResponse) {
          const raw =
            event.headers.get('X-New-Access-Token') ??
            event.headers.get('x-new-access-token');
          const token = raw?.trim();
          if (token) {
            const match = /^Bearer\s+(.+)$/i.exec(token);
            const naked = match ? match[1] : token;
            localStorage.setItem(TOKEN_KEY, naked);
          }
        }
      })
    );
  }
}
