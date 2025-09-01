import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
  HttpClient,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { TOKEN_KEY } from '../shared/constants';

@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  private http = inject(HttpClient);

  intercept<T>(
    req: HttpRequest<T>,
    next: HttpHandler
  ): Observable<HttpEvent<T>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse): Observable<HttpEvent<T>> => {
        if (error.status === 419) {
          return this.http
            .post('/api/auth/refresh', {}, { withCredentials: true })
            .pipe(
              switchMap(() => {
                const newToken = localStorage.getItem(TOKEN_KEY); // set by refresh response
                if (!newToken) return throwError(() => error);
                const retryReq = req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${newToken}`,
                  },
                });
                return next.handle(retryReq);
              }),
              catchError(() => throwError(() => error)) // If refresh fails, pass error up
            );
        }

        return throwError(() => error);
      })
    );
  }
}
