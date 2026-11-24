import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  type AuditAction,
} from '../src/audit/audit.constants.js';
import { AuditEvent } from '../src/audit/entities/audit-event.entity.js';
import {
  AuditService,
  type AuthenticatedAuditActor,
} from '../src/audit/audit.service.js';
import { AppModule } from '../src/app.module.js';
import { Cliente } from '../src/clientes/entities/cliente.tenant-entity.js';
import { ClientesService } from '../src/clientes/clientes.service.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { ReservacionEstado } from '../src/reservaciones/entities/reservacion.tenant-entity.js';
import { ReservacionesService } from '../src/reservaciones/reservaciones.service.js';
import { Sucursal } from '../src/sucursales/entities/sucursal.tenant-entity.js';
import { SucursalesService } from '../src/sucursales/sucursales.service.js';
import { TenantResolverService } from '../src/tenancy/tenant-resolver.service.js';
import type { TenantScope } from '../src/tenancy/tenant-scope.js';
import {
  Vestido,
  VestidoEstadoOperativo,
} from '../src/vestidos/entities/vestido.tenant-entity.js';
import { VestidosService } from '../src/vestidos/vestidos.service.js';

describe('PostgreSQL reservation auditing', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let audits: Repository<AuditEvent>;
  let auditService: AuditService;
  let empresasService: EmpresasService;
  let clientesService: ClientesService;
  let sucursalesService: SucursalesService;
  let vestidosService: VestidosService;
  let reservacionesService: ReservacionesService;
  let tenantResolver: TenantResolverService;
  let tenantA: TenantScope;
  let tenantB: TenantScope;
  let clienteA: Cliente;
  let clienteB: Cliente;
  let sucursalA: Sucursal;
  let sucursalB: Sucursal;
  let sequence = 0;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugA = `reservation-audit-a-${suffix}`;
  const slugB = `reservation-audit-b-${suffix}`;
  const actorA: AuthenticatedAuditActor = {
    actorUsuarioId: '419a6f33-82b7-4a22-971b-6a8d7c5e4f30',
    sessionId: '519a6f33-82b7-4a22-971b-6a8d7c5e4f30',
  };
  const actorB: AuthenticatedAuditActor = {
    actorUsuarioId: '619a6f33-82b7-4a22-971b-6a8d7c5e4f30',
    sessionId: '719a6f33-82b7-4a22-971b-6a8d7c5e4f30',
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    audits = dataSource.getRepository(AuditEvent);
    auditService = moduleRef.get(AuditService);
    empresasService = moduleRef.get(EmpresasService);
    clientesService = moduleRef.get(ClientesService);
    sucursalesService = moduleRef.get(SucursalesService);
    vestidosService = moduleRef.get(VestidosService);
    reservacionesService = moduleRef.get(ReservacionesService);
    tenantResolver = moduleRef.get(TenantResolverService);

    const empresaA = await empresasService.create({
      nombre: 'Reservation Audit A',
      slug: slugA,
    });
    const empresaB = await empresasService.create({
      nombre: 'Reservation Audit B',
      slug: slugB,
    });
    tenantA = await tenantResolver.resolveByEmpresaId(empresaA.id);
    tenantB = await tenantResolver.resolveByEmpresaId(empresaB.id);
    clienteA = await clientesService.create(tenantA, {
      nombre: 'Cliente Auditoría A',
      email: `reservation-audit-a-${suffix}@example.com`,
    });
    clienteB = await clientesService.create(tenantB, {
      nombre: 'Cliente Auditoría B',
      email: `reservation-audit-b-${suffix}@example.com`,
    });
    sucursalA = await sucursalesService.create(tenantA, {
      nombre: 'Sucursal Auditoría A',
    });
    sucursalB = await sucursalesService.create(tenantB, {
      nombre: 'Sucursal Auditoría B',
    });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const empresas = dataSource.getRepository(Empresa);
      for (const slug of [slugA, slugB]) {
        const empresa = await empresas.findOne({ where: { slug } });
        if (empresa) {
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quoteTenantSchemaName(empresa.schemaName)} CASCADE`,
          );
          await empresas.delete({ id: empresa.id });
        }
      }
    }
    await moduleRef?.close();
  });

  async function createDress(
    tenant: TenantScope,
    sucursal: Sucursal,
    price = '500.00',
    deposit = '100.00',
  ): Promise<Vestido> {
    sequence += 1;
    return vestidosService.create(tenant, {
      sucursalId: sucursal.id,
      codigo: `RES-AUD-${sequence}`,
      nombre: `Vestido Auditoría ${sequence}`,
      talla: 'M',
      color: 'Azul',
      precioRenta: price,
      deposito: deposit,
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    });
  }

  function createReservation(
    tenant: TenantScope,
    cliente: Cliente,
    sucursal: Sucursal,
    vestidoIds: string[],
    actor: AuthenticatedAuditActor,
    confirmar = false,
    start = new Date('2030-01-10T16:00:00.000Z'),
    end = new Date('2030-01-12T16:00:00.000Z'),
  ) {
    return reservacionesService.create(
      tenant,
      {
        clienteId: cliente.id,
        sucursalId: sucursal.id,
        vestidoIds,
        fechaInicio: start,
        fechaFin: end,
        confirmar,
      },
      actor,
    );
  }

  async function event(
    action: AuditAction,
    resourceId: string,
  ): Promise<AuditEvent> {
    return audits.findOneByOrFail({ action, resourceId });
  }

  it('audits draft and confirmed creation with safe historical totals', async () => {
    const draftDress = await createDress(tenantA, sucursalA, '500.25', '80.10');
    const confirmedDress = await createDress(
      tenantA,
      sucursalA,
      '750.50',
      '120.15',
    );
    const draft = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      [draftDress.id],
      actorA,
    );
    const confirmed = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      [confirmedDress.id],
      actorA,
      true,
      new Date('2030-02-10T16:00:00.000Z'),
      new Date('2030-02-12T16:00:00.000Z'),
    );

    await expect(
      event(AUDIT_ACTIONS.RESERVATION_CREATED, draft.id),
    ).resolves.toMatchObject({
      empresaId: tenantA.empresaId,
      actorUsuarioId: actorA.actorUsuarioId,
      sessionId: actorA.sessionId,
      resourceType: AUDIT_RESOURCE_TYPES.RESERVATION,
      metadata: {
        previousState: null,
        newState: ReservacionEstado.BORRADOR,
        clienteId: clienteA.id,
        sucursalId: sucursalA.id,
        range: {
          previous: null,
          new: {
            fechaInicio: '2030-01-10T16:00:00.000Z',
            fechaFin: '2030-01-12T16:00:00.000Z',
          },
        },
        addedDressIds: [draftDress.id],
        removedDressIds: [],
        importeRenta: '500.25',
        depositoRequerido: '80.10',
      },
    });
    const confirmedAudit = await event(
      AUDIT_ACTIONS.RESERVATION_CREATED,
      confirmed.id,
    );
    expect(confirmedAudit.metadata).toMatchObject({
      previousState: null,
      newState: ReservacionEstado.CONFIRMADA,
      importeRenta: '750.50',
      depositoRequerido: '120.15',
    });
    expect(typeof confirmedAudit.metadata.importeRenta).toBe('string');
    expect(typeof confirmedAudit.metadata.depositoRequerido).toBe('string');
    await expect(
      audits.countBy({
        action: AUDIT_ACTIONS.RESERVATION_CONFIRMED,
        resourceId: confirmed.id,
      }),
    ).resolves.toBe(0);
  });

  it('audits controlled updates without full snapshots or request bodies', async () => {
    const originalDress = await createDress(
      tenantA,
      sucursalA,
      '300.00',
      '50.00',
    );
    const replacementDress = await createDress(
      tenantA,
      sucursalA,
      '425.75',
      '90.25',
    );
    const reservation = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      [originalDress.id],
      actorA,
      false,
      new Date('2030-03-10T16:00:00.000Z'),
      new Date('2030-03-12T16:00:00.000Z'),
    );

    await reservacionesService.update(
      tenantA,
      reservation.id,
      {
        vestidoIds: [replacementDress.id],
        fechaInicio: new Date('2030-03-11T16:00:00.000Z'),
        fechaFin: new Date('2030-03-13T16:00:00.000Z'),
        notas: 'Nota que no debe copiarse a auditoría',
      },
      actorA,
    );

    const audit = await event(
      AUDIT_ACTIONS.RESERVATION_UPDATED,
      reservation.id,
    );
    expect(audit.metadata).toMatchObject({
      previousState: ReservacionEstado.BORRADOR,
      newState: ReservacionEstado.BORRADOR,
      range: {
        previous: {
          fechaInicio: '2030-03-10T16:00:00.000Z',
          fechaFin: '2030-03-12T16:00:00.000Z',
        },
        new: {
          fechaInicio: '2030-03-11T16:00:00.000Z',
          fechaFin: '2030-03-13T16:00:00.000Z',
        },
      },
      addedDressIds: [replacementDress.id],
      removedDressIds: [originalDress.id],
      notesChanged: true,
      importeRenta: '425.75',
      depositoRequerido: '90.25',
    });
    expect(JSON.stringify(audit.metadata)).not.toMatch(
      /nota que no debe|body|snapshot|schemaName|tenant_/i,
    );
  });

  it('audits every successful lifecycle transition exactly once', async () => {
    const dress = await createDress(tenantA, sucursalA);
    const reservation = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      [dress.id],
      actorA,
      false,
      new Date('2030-04-10T16:00:00.000Z'),
      new Date('2030-04-12T16:00:00.000Z'),
    );

    await reservacionesService.confirm(tenantA, reservation.id, actorA);
    await reservacionesService.deliver(tenantA, reservation.id, actorA);
    await reservacionesService.returnReservation(
      tenantA,
      reservation.id,
      actorA,
    );

    const expected: Array<[AuditAction, ReservacionEstado, ReservacionEstado]> =
      [
        [
          AUDIT_ACTIONS.RESERVATION_CONFIRMED,
          ReservacionEstado.BORRADOR,
          ReservacionEstado.CONFIRMADA,
        ],
        [
          AUDIT_ACTIONS.RESERVATION_DELIVERED,
          ReservacionEstado.CONFIRMADA,
          ReservacionEstado.ENTREGADA,
        ],
        [
          AUDIT_ACTIONS.RESERVATION_RETURNED,
          ReservacionEstado.ENTREGADA,
          ReservacionEstado.DEVUELTA,
        ],
      ];
    for (const [action, previousState, newState] of expected) {
      await expect(event(action, reservation.id)).resolves.toMatchObject({
        empresaId: tenantA.empresaId,
        actorUsuarioId: actorA.actorUsuarioId,
        sessionId: actorA.sessionId,
        resourceId: reservation.id,
        metadata: { previousState, newState },
      });
      await expect(
        audits.countBy({ action, resourceId: reservation.id }),
      ).resolves.toBe(1);
    }
  });

  it('audits cancellation without duplicating its reason', async () => {
    const dress = await createDress(tenantA, sucursalA);
    const reservation = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      [dress.id],
      actorA,
      false,
      new Date('2030-05-10T16:00:00.000Z'),
      new Date('2030-05-12T16:00:00.000Z'),
    );
    const reason = 'Motivo privado que no debe duplicarse';

    await reservacionesService.cancel(
      tenantA,
      reservation.id,
      { motivo: reason },
      actorA,
    );

    const audit = await event(
      AUDIT_ACTIONS.RESERVATION_CANCELLED,
      reservation.id,
    );
    expect(audit.metadata).toEqual({
      previousState: ReservacionEstado.BORRADOR,
      newState: ReservacionEstado.CANCELADA,
      hasCancellationReason: true,
    });
    expect(JSON.stringify(audit.metadata)).not.toContain(reason);
  });

  it('records only the transition that wins a concurrent race', async () => {
    const dress = await createDress(tenantA, sucursalA);
    const start = new Date('2030-06-10T16:00:00.000Z');
    const end = new Date('2030-06-12T16:00:00.000Z');
    const [draftA, draftB] = await Promise.all([
      createReservation(
        tenantA,
        clienteA,
        sucursalA,
        [dress.id],
        actorA,
        false,
        start,
        end,
      ),
      createReservation(
        tenantA,
        clienteA,
        sucursalA,
        [dress.id],
        actorA,
        false,
        start,
        end,
      ),
    ]);
    const results = await Promise.allSettled([
      reservacionesService.confirm(tenantA, draftA.id, actorA),
      reservacionesService.confirm(tenantA, draftB.id, actorA),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException),
    });
    const confirmationEvents = await audits.findBy({
      action: AUDIT_ACTIONS.RESERVATION_CONFIRMED,
    });
    expect(
      confirmationEvents.filter((audit) =>
        [draftA.id, draftB.id].includes(audit.resourceId ?? ''),
      ),
    ).toHaveLength(1);

    const winner = results[0]?.status === 'fulfilled' ? draftA : draftB;
    const deliveries = await Promise.allSettled([
      reservacionesService.deliver(tenantA, winner.id, actorA),
      reservacionesService.deliver(tenantA, winner.id, actorA),
    ]);
    expect(
      deliveries.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      deliveries.filter(({ status }) => status === 'rejected'),
    ).toHaveLength(1);
    await expect(
      audits.countBy({
        action: AUDIT_ACTIONS.RESERVATION_DELIVERED,
        resourceId: winner.id,
      }),
    ).resolves.toBe(1);
  });

  it('rolls back a transition when audit persistence fails', async () => {
    const dress = await createDress(tenantA, sucursalA);
    const reservation = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      [dress.id],
      actorA,
      false,
      new Date('2030-07-10T16:00:00.000Z'),
      new Date('2030-07-12T16:00:00.000Z'),
    );
    const auditFailure = vi
      .spyOn(auditService, 'record')
      .mockRejectedValueOnce(new Error('controlled reservation audit failure'));

    await expect(
      reservacionesService.confirm(tenantA, reservation.id, actorA),
    ).rejects.toThrow('controlled reservation audit failure');
    auditFailure.mockRestore();

    await expect(
      reservacionesService.findOne(tenantA, reservation.id),
    ).resolves.toMatchObject({ estado: ReservacionEstado.BORRADOR });
    await expect(
      audits.countBy({
        action: AUDIT_ACTIONS.RESERVATION_CONFIRMED,
        resourceId: reservation.id,
      }),
    ).resolves.toBe(0);
  });

  it('isolates audit events across tenants and omits internal schemas', async () => {
    const dressB = await createDress(tenantB, sucursalB, '500.25', '80.10');
    const reservationB = await createReservation(
      tenantB,
      clienteB,
      sucursalB,
      [dressB.id],
      actorB,
      false,
      new Date('2030-08-10T16:00:00.000Z'),
      new Date('2030-08-12T16:00:00.000Z'),
    );
    const eventsBefore = await audits.countBy({
      action: AUDIT_ACTIONS.RESERVATION_CONFIRMED,
      resourceId: reservationB.id,
    });

    await expect(
      reservacionesService.confirm(tenantA, reservationB.id, actorA),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      audits.countBy({
        action: AUDIT_ACTIONS.RESERVATION_CONFIRMED,
        resourceId: reservationB.id,
      }),
    ).resolves.toBe(eventsBefore);
    await reservacionesService.confirm(tenantB, reservationB.id, actorB);

    const audit = await event(
      AUDIT_ACTIONS.RESERVATION_CONFIRMED,
      reservationB.id,
    );
    expect(audit).toMatchObject({
      empresaId: tenantB.empresaId,
      actorUsuarioId: actorB.actorUsuarioId,
      sessionId: actorB.sessionId,
    });
    expect(JSON.stringify(audit)).not.toMatch(/schemaName|tenant_[0-9a-f]+/i);
  });
});
