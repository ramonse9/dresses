import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { TenantAuthenticatedRequest } from './tenant-auth.guard.js';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const tenantScope = context
      .switchToHttp()
      .getRequest<TenantAuthenticatedRequest>().tenantScope;

    if (!tenantScope) {
      throw new InternalServerErrorException(
        'TenantAuthGuard debe ejecutarse antes de resolver el tenant',
      );
    }

    return tenantScope;
  },
);
