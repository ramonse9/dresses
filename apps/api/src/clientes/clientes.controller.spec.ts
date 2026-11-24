import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { AccessTokenPayload } from '../auth/types/access-token-payload.js';
import { ClientesController } from './clientes.controller.js';
import { ClientesService } from './clientes.service.js';
import { Cliente } from './entities/cliente.tenant-entity.js';

describe('ClientesController', () => {
  const tenant = {
    empresaId: '019a6f33-82b7-4a22-971b-6a8d7c5e4f30',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_019a6f3382b74a22971b6a8d7c5e4f30',
  } as TenantScope;
  const user = {
    sub: 'b18c2a56-d33f-4d88-a8e7-42931121e295',
    email: 'owner@example.com',
    sessionId: 'c18c2a56-d33f-4d88-a8e7-42931121e295',
  } as AccessTokenPayload;
  const actor = { actorUsuarioId: user.sub, sessionId: user.sessionId };

  it('forwards normalized creation input and authenticated tenant', async () => {
    const cliente = { id: 'cliente-id' } as Cliente;
    const create = vi.fn().mockResolvedValue(cliente);
    const controller = new ClientesController({
      create,
    } as unknown as ClientesService);

    await expect(
      controller.create(tenant, user, {
        nombre: ' Ana ',
        telefono: ' ',
        email: ' ANA@EXAMPLE.COM ',
      }),
    ).resolves.toBe(cliente);
    expect(create).toHaveBeenCalledWith(
      tenant,
      {
        nombre: 'Ana',
        telefono: null,
        email: 'ana@example.com',
      },
      actor,
    );
  });

  it('forwards strict list filters', async () => {
    const response = {
      data: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    };
    const findAll = vi.fn().mockResolvedValue(response);
    const controller = new ClientesController({
      findAll,
    } as unknown as ClientesService);

    await expect(
      controller.findAll(tenant, {
        page: '2',
        limit: '10',
        activo: 'true',
        q: ' Ana ',
      }),
    ).resolves.toBe(response);
    expect(findAll).toHaveBeenCalledWith(tenant, {
      page: 2,
      limit: 10,
      activo: true,
      q: 'Ana',
    });
  });

  it('forwards updates without accepting status', async () => {
    const cliente = { id: 'cliente-id' } as Cliente;
    const update = vi.fn().mockResolvedValue(cliente);
    const controller = new ClientesController({
      update,
    } as unknown as ClientesService);

    await expect(
      controller.update(tenant, user, 'cliente-id', {
        telefono: ' 555-0100 ',
        email: '',
      }),
    ).resolves.toBe(cliente);
    expect(update).toHaveBeenCalledWith(
      tenant,
      'cliente-id',
      { telefono: '555-0100', email: null },
      actor,
    );
  });

  it('forwards owner-only status changes and soft deletion', async () => {
    const cliente = { id: 'cliente-id', activo: false } as Cliente;
    const updateEstado = vi.fn().mockResolvedValue(cliente);
    const deactivate = vi.fn().mockResolvedValue(cliente);
    const controller = new ClientesController({
      updateEstado,
      deactivate,
    } as unknown as ClientesService);

    await expect(
      controller.updateEstado(tenant, user, 'cliente-id', { activo: false }),
    ).resolves.toBe(cliente);
    await expect(
      controller.deactivate(tenant, user, 'cliente-id'),
    ).resolves.toBe(cliente);
    expect(updateEstado).toHaveBeenCalledWith(
      tenant,
      'cliente-id',
      false,
      actor,
    );
    expect(deactivate).toHaveBeenCalledWith(tenant, 'cliente-id', actor);
  });
});
