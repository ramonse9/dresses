import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DevTenantAdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const nodeEnvironment =
      this.configService.get<string>('NODE_ENV') ?? 'development';
    const enabled =
      this.configService.get<string>('ENABLE_DEV_TENANT_ADMIN') === 'true';

    if (nodeEnvironment === 'production' || !enabled) {
      throw new NotFoundException();
    }

    return true;
  }
}
