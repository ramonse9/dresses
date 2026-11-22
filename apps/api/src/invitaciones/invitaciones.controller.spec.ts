import type { AccessTokenPayload } from '../auth/types/access-token-payload.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { InvitacionesController } from './invitaciones.controller.js';
import { InvitacionesService } from './invitaciones.service.js';

describe('InvitacionesController', () => {
  const tenant = {
    empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295',
  } as TenantScope;
  const user: AccessTokenPayload = {
    sub: 'b18c2a56-d33f-4d88-a8e7-42931121e295',
    email: 'owner@example.com',
    sessionId: 'c18c2a56-d33f-4d88-a8e7-42931121e295',
    empresaId: tenant.empresaId,
    rol: EmpresaUsuarioRol.OWNER,
  };

  it('forwards only verified ids and normalized creation input', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'invitation-id' });
    const controller = new InvitacionesController({
      create,
    } as unknown as InvitacionesService);

    await controller.create(tenant, user, {
      email: ' PERSON@EXAMPLE.COM ',
      rol: 'EMPLOYEE',
    });

    expect(create).toHaveBeenCalledWith(tenant.empresaId, user.sub, {
      email: 'person@example.com',
      rol: EmpresaUsuarioRol.EMPLOYEE,
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain('schemaName');
    expect(JSON.stringify(create.mock.calls)).not.toContain('tenant_');
  });

  it('parses list filters and requires empty mutation bodies', async () => {
    const findAll = vi.fn().mockResolvedValue({ data: [] });
    const resend = vi.fn().mockResolvedValue({ id: 'invitation-id' });
    const revoke = vi.fn().mockResolvedValue({ id: 'invitation-id' });
    const controller = new InvitacionesController({
      findAll,
      resend,
      revoke,
    } as unknown as InvitacionesService);

    await controller.findAll(tenant, {
      page: '2',
      estado: 'PENDIENTE',
      q: ' PERSON ',
    });
    await controller.resend(tenant, user, 'invitation-id', {});
    await controller.revoke(tenant, user, 'invitation-id', {});

    expect(findAll).toHaveBeenCalledWith(tenant.empresaId, {
      page: 2,
      limit: 20,
      estado: 'PENDIENTE',
      q: 'person',
    });
    expect(resend).toHaveBeenCalledWith(
      tenant.empresaId,
      user.sub,
      'invitation-id',
    );
    expect(revoke).toHaveBeenCalledWith(
      tenant.empresaId,
      user.sub,
      'invitation-id',
    );
  });
});
