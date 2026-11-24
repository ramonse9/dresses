import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { AccessTokenPayload } from '../auth/types/access-token-payload.js';
import {
  Vestido,
  VestidoEstadoOperativo,
} from './entities/vestido.tenant-entity.js';
import { VestidosController } from './vestidos.controller.js';
import { VestidosService } from './vestidos.service.js';

describe('VestidosController', () => {
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

  it('forwards only normalized input and the authenticated tenant', async () => {
    const vestido = { id: 'dress-id', codigo: 'V-001' } as Vestido;
    const create = vi.fn().mockResolvedValue(vestido);
    const controller = new VestidosController({
      create,
    } as unknown as VestidosService);

    await expect(
      controller.create(tenant, user, {
        sucursalId: 'A18C2A56-D33F-4D88-A8E7-42931121E295',
        codigo: ' v-001 ',
        nombre: ' Vestido Azul ',
        talla: ' M ',
        color: ' Azul ',
        precioRenta: 1250.5,
      }),
    ).resolves.toBe(vestido);
    expect(create).toHaveBeenCalledWith(
      tenant,
      {
        sucursalId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
        codigo: 'V-001',
        nombre: 'Vestido Azul',
        talla: 'M',
        color: 'Azul',
        precioRenta: '1250.50',
        estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      },
      actor,
    );
  });

  it('forwards parsed pagination and filters', async () => {
    const response = {
      data: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    };
    const findAll = vi.fn().mockResolvedValue(response);
    const controller = new VestidosController({
      findAll,
    } as unknown as VestidosService);

    await expect(
      controller.findAll(tenant, {
        page: '2',
        limit: '10',
        activo: 'true',
        q: ' azul ',
      }),
    ).resolves.toBe(response);
    expect(findAll).toHaveBeenCalledWith(tenant, {
      page: 2,
      limit: 10,
      activo: true,
      q: 'azul',
    });
  });

  it('forwards a normalized availability range from the authenticated tenant', async () => {
    const response = {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      range: {
        fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
        fechaFin: new Date('2026-12-12T23:00:00.000Z'),
      },
    };
    const findAvailability = vi.fn().mockResolvedValue(response);
    const controller = new VestidosController({
      findAvailability,
    } as unknown as VestidosService);

    await expect(
      controller.findAvailability(tenant, {
        sucursalId: 'A18C2A56-D33F-4D88-A8E7-42931121E295',
        fechaInicio: '2026-12-10T16:00:00-07:00',
        fechaFin: '2026-12-12T16:00:00-07:00',
      }),
    ).resolves.toBe(response);
    expect(findAvailability).toHaveBeenCalledWith(tenant, {
      sucursalId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
      fechaFin: new Date('2026-12-12T23:00:00.000Z'),
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      page: 1,
      limit: 20,
    });
  });

  it('forwards lookup ids only with the authenticated tenant', async () => {
    const response = { id: 'dress-id' };
    const findOne = vi.fn().mockResolvedValue(response);
    const controller = new VestidosController({
      findOne,
    } as unknown as VestidosService);

    await expect(controller.findOne(tenant, 'dress-id')).resolves.toBe(
      response,
    );
    expect(findOne).toHaveBeenCalledWith(tenant, 'dress-id');
  });

  it('forwards normalized partial updates', async () => {
    const vestido = { id: 'dress-id', codigo: 'V-002' } as Vestido;
    const update = vi.fn().mockResolvedValue(vestido);
    const controller = new VestidosController({
      update,
    } as unknown as VestidosService);

    await expect(
      controller.update(tenant, user, 'dress-id', {
        sucursalId: 'A18C2A56-D33F-4D88-A8E7-42931121E295',
        codigo: ' v-002 ',
        precioRenta: 1500,
        deposito: null,
        activo: true,
      }),
    ).resolves.toBe(vestido);
    expect(update).toHaveBeenCalledWith(
      tenant,
      'dress-id',
      {
        sucursalId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
        codigo: 'V-002',
        precioRenta: '1500.00',
        deposito: null,
        activo: true,
      },
      actor,
    );
  });

  it('forwards soft deletion only with the authenticated tenant', async () => {
    const vestido = { id: 'dress-id', activo: false } as Vestido;
    const deactivate = vi.fn().mockResolvedValue(vestido);
    const controller = new VestidosController({
      deactivate,
    } as unknown as VestidosService);

    await expect(controller.deactivate(tenant, user, 'dress-id')).resolves.toBe(
      vestido,
    );
    expect(deactivate).toHaveBeenCalledWith(tenant, 'dress-id', actor);
  });
});
