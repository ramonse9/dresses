import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevTenantAdminGuard } from './dev-tenant-admin.guard.js';

describe('DevTenantAdminGuard', () => {
  it('allows explicit development-only tenant administration', () => {
    const config = {
      get: vi.fn((key: string) =>
        key === 'NODE_ENV' ? 'development' : 'true',
      ),
    } as unknown as ConfigService;
    const guard = new DevTenantAdminGuard(config);

    expect(guard.canActivate({} as ExecutionContext)).toBe(true);
  });

  it('hides the endpoint when the flag is disabled', () => {
    const config = {
      get: vi.fn((key: string) =>
        key === 'NODE_ENV' ? 'development' : 'false',
      ),
    } as unknown as ConfigService;
    const guard = new DevTenantAdminGuard(config);

    expect(() => guard.canActivate({} as ExecutionContext)).toThrow(
      NotFoundException,
    );
  });

  it('cannot be enabled in production', () => {
    const config = {
      get: vi.fn((key: string) => (key === 'NODE_ENV' ? 'production' : 'true')),
    } as unknown as ConfigService;
    const guard = new DevTenantAdminGuard(config);

    expect(() => guard.canActivate({} as ExecutionContext)).toThrow(
      NotFoundException,
    );
  });
});
