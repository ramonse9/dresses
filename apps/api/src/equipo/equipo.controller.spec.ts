import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { EquipoController } from './equipo.controller.js';
import { EquipoService } from './equipo.service.js';

describe('EquipoController', () => {
  const tenant = {
    empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295',
  } as TenantScope;

  it('forwards only the verified empresa id and parsed filters', async () => {
    const response = {
      data: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    };
    const findAll = vi.fn().mockResolvedValue(response);
    const controller = new EquipoController({
      findAll,
    } as unknown as EquipoService);

    await expect(
      controller.findAll(tenant, {
        page: '2',
        limit: '10',
        rol: EmpresaUsuarioRol.OWNER,
        activo: 'true',
        q: ' Ana ',
      }),
    ).resolves.toBe(response);
    expect(findAll).toHaveBeenCalledWith(tenant.empresaId, {
      page: 2,
      limit: 10,
      rol: EmpresaUsuarioRol.OWNER,
      activo: true,
      q: 'Ana',
    });
  });

  it('forwards membership lookup without tenant schema data', async () => {
    const response = { id: 'membership-id' };
    const findOne = vi.fn().mockResolvedValue(response);
    const controller = new EquipoController({
      findOne,
    } as unknown as EquipoService);

    await expect(controller.findOne(tenant, 'membership-id')).resolves.toBe(
      response,
    );
    expect(findOne).toHaveBeenCalledWith(tenant.empresaId, 'membership-id');
    expect(JSON.stringify(findOne.mock.calls)).not.toContain('schemaName');
    expect(JSON.stringify(findOne.mock.calls)).not.toContain('tenant_');
  });
});
