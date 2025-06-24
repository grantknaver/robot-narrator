import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('accessToken');

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
          const newToken = event.headers.get('Authorization');
          if (newToken?.startsWith('Bearer ')) {
            localStorage.setItem('accessToken', newToken.slice(7));
          }
        }
      })
    );
  }
}
