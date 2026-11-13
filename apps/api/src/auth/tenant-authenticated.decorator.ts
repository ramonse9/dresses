import { applyDecorators, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { TenantAuthGuard } from './tenant-auth.guard.js';
import { TenantScopeCleanupInterceptor } from './tenant-scope-cleanup.interceptor.js';

export function TenantAuthenticated(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard, TenantAuthGuard, RolesGuard),
    UseInterceptors(TenantScopeCleanupInterceptor),
  );
}
