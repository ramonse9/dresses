import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import type { TenantAuthenticatedRequest } from './tenant-auth.guard.js';

@Injectable()
export class TenantScopeCleanupInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<TenantAuthenticatedRequest>();

    return next.handle().pipe(
      finalize(() => {
        delete request.tenantScope;
      }),
    );
  }
}
