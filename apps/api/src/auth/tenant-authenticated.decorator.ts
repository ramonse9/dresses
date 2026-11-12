import { applyDecorators, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { TenantAuthGuard } from './tenant-auth.guard.js';
import { TenantScopeCleanupInterceptor } from './tenant-scope-cleanup.interceptor.js';

export function TenantAuthenticated(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard, TenantAuthGuard),
    UseInterceptors(TenantScopeCleanupInterceptor),
  );
}
