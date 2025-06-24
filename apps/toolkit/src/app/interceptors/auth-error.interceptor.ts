import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
  HttpClient
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';

@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  private http = inject(HttpClient);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 419) {
          // Token expired — try refreshing
          return this.http.post('/api/auth/refresh', {}, { withCredentials: true }).pipe(
            switchMap(() => {
              const newToken = localStorage.getItem('accessToken'); // set by refresh response
              if (!newToken) return throwError(() => error);

              // Retry original request with new token
              const retryReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`
                }
              });
              return next.handle(retryReq);
            }),
            catchError(() => throwError(() => error)) // If refresh fails, pass error up
          );
        }

        return throwError(() => error); // All other errors
      })
    );
  }
}
