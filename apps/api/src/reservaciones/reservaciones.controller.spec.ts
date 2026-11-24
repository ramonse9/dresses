import type { TenantScope } from '../tenancy/tenant-scope.js';
import { ReservacionEstado } from './entities/reservacion.tenant-entity.js';
import { ReservacionesController } from './reservaciones.controller.js';
import { ReservacionesService } from './reservaciones.service.js';

describe('ReservacionesController', () => {
  const tenant = {
    empresaId: '019a6f33-82b7-4a22-971b-6a8d7c5e4f30',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_019a6f3382b74a22971b6a8d7c5e4f30',
  } as TenantScope;
  const user = {
    sub: '119a6f33-82b7-4a22-971b-6a8d7c5e4f31',
    email: 'owner@example.com',
    sessionId: '219a6f33-82b7-4a22-971b-6a8d7c5e4f32',
  };
  const actor = {
    actorUsuarioId: user.sub,
    sessionId: user.sessionId,
  };

  it('forwards only normalized input and the authenticated tenant', async () => {
    const response = {
      id: 'reservation-id',
      estado: ReservacionEstado.CONFIRMADA,
    };
    const create = vi.fn().mockResolvedValue(response);
    const controller = new ReservacionesController({
      create,
    } as unknown as ReservacionesService);

    await expect(
      controller.create(tenant, user, {
        clienteId: 'A18C2A56-D33F-4D88-A8E7-42931121E295',
        sucursalId: 'B18C2A56-D33F-4D88-A8E7-42931121E295',
        vestidoIds: ['C18C2A56-D33F-4D88-A8E7-42931121E295'],
        fechaInicio: '2026-12-10T16:00:00-07:00',
        fechaFin: '2026-12-12T16:00:00-07:00',
        notas: '  Entrega vespertina  ',
      }),
    ).resolves.toBe(response);
    expect(create).toHaveBeenCalledWith(
      tenant,
      {
        clienteId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
        sucursalId: 'b18c2a56-d33f-4d88-a8e7-42931121e295',
        vestidoIds: ['c18c2a56-d33f-4d88-a8e7-42931121e295'],
        fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
        fechaFin: new Date('2026-12-12T23:00:00.000Z'),
        notas: 'Entrega vespertina',
        confirmar: true,
      },
      actor,
    );
  });

  it('forwards parsed listing filters', async () => {
    const response = {
      data: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    };
    const findAll = vi.fn().mockResolvedValue(response);
    const controller = new ReservacionesController({
      findAll,
    } as unknown as ReservacionesService);

    await expect(
      controller.findAll(tenant, {
        page: '2',
        limit: '10',
        estado: ReservacionEstado.CONFIRMADA,
        q: ' Ana ',
      }),
    ).resolves.toBe(response);
    expect(findAll).toHaveBeenCalledWith(tenant, {
      page: 2,
      limit: 10,
      estado: ReservacionEstado.CONFIRMADA,
      q: 'Ana',
    });
  });

  it('forwards detail ids with only the authenticated tenant', async () => {
    const response = { id: 'reservation-id' };
    const findOne = vi.fn().mockResolvedValue(response);
    const controller = new ReservacionesController({
      findOne,
    } as unknown as ReservacionesService);

    await expect(controller.findOne(tenant, 'reservation-id')).resolves.toBe(
      response,
    );
    expect(findOne).toHaveBeenCalledWith(tenant, 'reservation-id');
  });

  it('forwards normalized editable fields without state', async () => {
    const response = { id: 'reservation-id' };
    const update = vi.fn().mockResolvedValue(response);
    const controller = new ReservacionesController({
      update,
    } as unknown as ReservacionesService);

    await expect(
      controller.update(tenant, user, 'reservation-id', {
        vestidoIds: ['C18C2A56-D33F-4D88-A8E7-42931121E295'],
        notas: '  Cambio  ',
      }),
    ).resolves.toBe(response);
    expect(update).toHaveBeenCalledWith(
      tenant,
      'reservation-id',
      {
        vestidoIds: ['c18c2a56-d33f-4d88-a8e7-42931121e295'],
        notas: 'Cambio',
      },
      actor,
    );
  });

  it.each([
    ['confirm', 'confirm'],
    ['deliver', 'deliver'],
    ['returnReservation', 'returnReservation'],
  ] as const)(
    'forwards %s without accepting a state',
    async (method, serviceMethod) => {
      const response = { id: 'reservation-id' };
      const operation = vi.fn().mockResolvedValue(response);
      const controller = new ReservacionesController({
        [serviceMethod]: operation,
      } as unknown as ReservacionesService);

      await expect(
        controller[method](tenant, user, 'reservation-id'),
      ).resolves.toBe(response);
      expect(operation).toHaveBeenCalledWith(tenant, 'reservation-id', actor);
    },
  );

  it('normalizes the optional cancellation reason', async () => {
    const response = { id: 'reservation-id' };
    const cancel = vi.fn().mockResolvedValue(response);
    const controller = new ReservacionesController({
      cancel,
    } as unknown as ReservacionesService);

    await expect(
      controller.cancel(tenant, user, 'reservation-id', {
        motivo: '  Cambio de planes  ',
      }),
    ).resolves.toBe(response);
    expect(cancel).toHaveBeenCalledWith(
      tenant,
      'reservation-id',
      { motivo: 'Cambio de planes' },
      actor,
    );
  });
});
