import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit/audit.constants.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { AuditoriaController } from './auditoria.controller.js';
import { AuditoriaService } from './auditoria.service.js';

describe('AuditoriaController', () => {
  const tenant = {
    empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
    empresaSlug: 'atelier',
    schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295',
  } as TenantScope;

  it('forwards only the verified empresa and strict filters', async () => {
    const response = {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    const findAll = vi.fn().mockResolvedValue(response);
    const controller = new AuditoriaController({
      findAll,
    } as unknown as AuditoriaService);

    await expect(
      controller.findAll(tenant, {
        action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
        resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER,
      }),
    ).resolves.toBe(response);
    expect(findAll).toHaveBeenCalledWith(tenant.empresaId, {
      page: 1,
      limit: 20,
      action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER,
    });
    expect(JSON.stringify(findAll.mock.calls)).not.toMatch(
      /schemaName|tenant_/,
    );
  });

  it('scopes detail by the verified empresa', async () => {
    const response = { id: 'event-id' };
    const findOne = vi.fn().mockResolvedValue(response);
    const controller = new AuditoriaController({
      findOne,
    } as unknown as AuditoriaService);

    await expect(controller.findOne(tenant, 'event-id')).resolves.toBe(
      response,
    );
    expect(findOne).toHaveBeenCalledWith(tenant.empresaId, 'event-id');
  });
});
