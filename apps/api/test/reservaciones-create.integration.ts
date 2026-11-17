import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
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

describe('PostgreSQL secure reservation creation', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
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
  let sucursalASecondary: Sucursal;
  let sucursalB: Sucursal;
  let codeSequence = 0;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugA = `reservas-create-a-${suffix}`;
  const slugB = `reservas-create-b-${suffix}`;
  const missingId = '00000000-0000-4000-8000-000000000000';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    empresasService = moduleRef.get(EmpresasService);
    clientesService = moduleRef.get(ClientesService);
    sucursalesService = moduleRef.get(SucursalesService);
    vestidosService = moduleRef.get(VestidosService);
    reservacionesService = moduleRef.get(ReservacionesService);
    tenantResolver = moduleRef.get(TenantResolverService);

    const empresaA = await empresasService.create({
      nombre: 'Reservas Create A',
      slug: slugA,
    });
    const empresaB = await empresasService.create({
      nombre: 'Reservas Create B',
      slug: slugB,
    });
    tenantA = await tenantResolver.resolveByEmpresaId(empresaA.id);
    tenantB = await tenantResolver.resolveByEmpresaId(empresaB.id);
    clienteA = await clientesService.create(tenantA, {
      nombre: 'Cliente A',
      email: 'cliente-a@example.com',
    });
    clienteB = await clientesService.create(tenantB, {
      nombre: 'Cliente B',
      email: 'cliente-b@example.com',
    });
    sucursalA = await sucursalesService.create(tenantA, { nombre: 'Centro A' });
    sucursalASecondary = await sucursalesService.create(tenantA, {
      nombre: 'Norte A',
    });
    sucursalB = await sucursalesService.create(tenantB, { nombre: 'Centro B' });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const repository = dataSource.getRepository(Empresa);

      for (const slug of [slugA, slugB]) {
        const empresa = await repository.findOne({ where: { slug } });

        if (empresa) {
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quoteTenantSchemaName(empresa.schemaName)} CASCADE`,
          );
          await repository.delete({ id: empresa.id });
        }
      }
    }

    await moduleRef?.close();
  });

  async function createDress(
    tenant: TenantScope,
    sucursal: Sucursal,
    values: Partial<Pick<Vestido, 'precioRenta' | 'deposito'>> = {},
  ): Promise<Vestido> {
    codeSequence += 1;
    return vestidosService.create(tenant, {
      sucursalId: sucursal.id,
      codigo: `RES-${codeSequence}`,
      nombre: `Vestido ${codeSequence}`,
      talla: 'M',
      color: 'Azul',
      precioRenta: values.precioRenta ?? '100.00',
      deposito: values.deposito ?? null,
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    });
  }

  function input(
    cliente: Cliente,
    sucursal: Sucursal,
    vestidoIds: string[],
    overrides: Partial<{
      fechaInicio: Date;
      fechaFin: Date;
      confirmar: boolean;
    }> = {},
  ) {
    return {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      vestidoIds,
      fechaInicio:
        overrides.fechaInicio ?? new Date('2027-01-10T16:00:00.000Z'),
      fechaFin: overrides.fechaFin ?? new Date('2027-01-12T16:00:00.000Z'),
      confirmar: overrides.confirmar ?? true,
    };
  }

  it('creates confirmed and draft reservations with backend totals and historical snapshots', async () => {
    const vestidoA = await createDress(tenantA, sucursalA, {
      precioRenta: '1250.50',
      deposito: '500.00',
    });
    const vestidoB = await createDress(tenantA, sucursalA, {
      precioRenta: '900.25',
      deposito: null,
    });

    const confirmed = await reservacionesService.create(
      tenantA,
      input(clienteA, sucursalA, [vestidoA.id, vestidoB.id]),
    );
    expect(confirmed).toMatchObject({
      estado: ReservacionEstado.CONFIRMADA,
      importeRenta: '2150.75',
      depositoRequerido: '500.00',
      confirmadaAt: expect.any(Date),
      vestidos: [
        expect.objectContaining({
          id: vestidoA.id,
          precioRenta: '1250.50',
          deposito: '500.00',
        }),
        expect.objectContaining({
          id: vestidoB.id,
          precioRenta: '900.25',
          deposito: '0.00',
        }),
      ],
    });
    expect(JSON.stringify(confirmed)).not.toContain('schemaName');
    expect(JSON.stringify(confirmed)).not.toContain('tenant_');

    await vestidosService.update(tenantA, vestidoA.id, {
      precioRenta: '2000.00',
      deposito: '800.00',
    });
    const schema = quoteTenantSchemaName(tenantA.schemaName);
    const snapshots = (await dataSource.query(
      `SELECT "precio_renta" AS "precioRenta", "deposito" FROM ${schema}."reservacion_vestidos" WHERE "reservacion_id" = $1 AND "vestido_id" = $2`,
      [confirmed.id, vestidoA.id],
    )) as Array<{ precioRenta: string; deposito: string }>;
    expect(snapshots).toEqual([{ precioRenta: '1250.50', deposito: '500.00' }]);

    const draftDress = await createDress(tenantA, sucursalA);
    await expect(
      reservacionesService.create(
        tenantA,
        input(clienteA, sucursalA, [draftDress.id], { confirmar: false }),
      ),
    ).resolves.toMatchObject({
      estado: ReservacionEstado.BORRADOR,
      confirmadaAt: null,
    });
  });

  it('allows overlapping drafts and contiguous confirmed ranges but rejects blocking overlaps', async () => {
    const vestido = await createDress(tenantA, sucursalA);
    const period = input(clienteA, sucursalA, [vestido.id], {
      confirmar: false,
    });

    await reservacionesService.create(tenantA, period);
    await expect(
      reservacionesService.create(tenantA, period),
    ).resolves.toMatchObject({ estado: ReservacionEstado.BORRADOR });
    await expect(
      reservacionesService.create(tenantA, { ...period, confirmar: true }),
    ).resolves.toMatchObject({ estado: ReservacionEstado.CONFIRMADA });
    await expect(
      reservacionesService.create(tenantA, { ...period, confirmar: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      reservacionesService.create(
        tenantA,
        input(clienteA, sucursalA, [vestido.id], {
          fechaInicio: period.fechaFin,
          fechaFin: new Date('2027-01-13T16:00:00.000Z'),
        }),
      ),
    ).resolves.toMatchObject({ estado: ReservacionEstado.CONFIRMADA });
  });

  it('validates active tenant references, operational state and branch ownership', async () => {
    const activeDress = await createDress(tenantA, sucursalA);
    const inactiveDress = await createDress(tenantA, sucursalA);
    await vestidosService.deactivate(tenantA, inactiveDress.id);
    const maintenanceDress = await createDress(tenantA, sucursalA);
    await vestidosService.update(tenantA, maintenanceDress.id, {
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
    });
    const otherBranchDress = await createDress(tenantA, sucursalASecondary);
    const foreignDress = await createDress(tenantB, sucursalB);
    const inactiveCliente = await clientesService.create(tenantA, {
      nombre: 'Cliente inactivo',
      email: 'inactivo@example.com',
    });
    await clientesService.deactivate(tenantA, inactiveCliente.id);
    const inactiveBranch = await sucursalesService.create(tenantA, {
      nombre: 'Sucursal inactiva',
    });
    const inactiveBranchDress = await createDress(tenantA, inactiveBranch);
    await sucursalesService.deactivate(tenantA, inactiveBranch.id);

    for (const invalidInput of [
      { ...input(clienteA, sucursalA, [activeDress.id]), clienteId: missingId },
      {
        ...input(inactiveCliente, sucursalA, [activeDress.id]),
      },
      {
        ...input(clienteA, sucursalA, [activeDress.id]),
        sucursalId: missingId,
      },
      input(clienteA, inactiveBranch, [inactiveBranchDress.id]),
      input(clienteA, sucursalA, [missingId]),
      input(clienteA, sucursalA, [foreignDress.id]),
    ]) {
      await expect(
        reservacionesService.create(tenantA, invalidInput),
      ).rejects.toBeInstanceOf(NotFoundException);
    }

    for (const invalidDress of [
      inactiveDress,
      maintenanceDress,
      otherBranchDress,
    ]) {
      await expect(
        reservacionesService.create(
          tenantA,
          input(clienteA, sucursalA, [invalidDress.id]),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('isolates identical dress UUIDs in different tenants', async () => {
    const sharedDressId = '11111111-1111-4111-8111-111111111111';
    const schemaA = quoteTenantSchemaName(tenantA.schemaName);
    const schemaB = quoteTenantSchemaName(tenantB.schemaName);

    await dataSource.query(
      `INSERT INTO ${schemaA}."vestidos" ("id", "sucursal_id", "codigo", "nombre", "talla", "color", "precio_renta", "estado_operativo") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sharedDressId,
        sucursalA.id,
        'SHARED-A',
        'Compartido A',
        'M',
        'Azul',
        '100.00',
        VestidoEstadoOperativo.DISPONIBLE,
      ],
    );
    await dataSource.query(
      `INSERT INTO ${schemaB}."vestidos" ("id", "sucursal_id", "codigo", "nombre", "talla", "color", "precio_renta", "estado_operativo") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sharedDressId,
        sucursalB.id,
        'SHARED-B',
        'Compartido B',
        'M',
        'Rojo',
        '200.00',
        VestidoEstadoOperativo.DISPONIBLE,
      ],
    );

    const [reservationA, reservationB] = await Promise.all([
      reservacionesService.create(
        tenantA,
        input(clienteA, sucursalA, [sharedDressId]),
      ),
      reservacionesService.create(
        tenantB,
        input(clienteB, sucursalB, [sharedDressId]),
      ),
    ]);
    expect(reservationA.importeRenta).toBe('100.00');
    expect(reservationB.importeRenta).toBe('200.00');
  });

  it('serializes concurrent confirmations so only one can reserve the period', async () => {
    const vestido = await createDress(tenantA, sucursalA);
    const reservationInput = input(clienteA, sucursalA, [vestido.id], {
      fechaInicio: new Date('2027-04-10T16:00:00.000Z'),
      fechaFin: new Date('2027-04-12T16:00:00.000Z'),
    });
    const results = await Promise.allSettled([
      reservacionesService.create(tenantA, reservationInput),
      reservacionesService.create(tenantA, reservationInput),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    const rejected = results.find(({ status }) => status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: expect.any(ConflictException),
    });
  });

  it('rolls back the header and releases transactional locks when detail persistence fails', async () => {
    const vestido = await createDress(tenantA, sucursalA);
    const schema = quoteTenantSchemaName(tenantA.schemaName);
    const before = (await dataSource.query(
      `SELECT COUNT(*)::integer AS "count" FROM ${schema}."reservaciones"`,
    )) as Array<{ count: number }>;

    await dataSource.query(
      `CREATE FUNCTION ${schema}."fail_reservation_detail"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced detail failure'; END; $$`,
    );
    await dataSource.query(
      `CREATE TRIGGER "TRG_fail_reservation_detail" BEFORE INSERT ON ${schema}."reservacion_vestidos" FOR EACH ROW EXECUTE FUNCTION ${schema}."fail_reservation_detail"()`,
    );

    try {
      await expect(
        reservacionesService.create(
          tenantA,
          input(clienteA, sucursalA, [vestido.id], {
            fechaInicio: new Date('2027-05-10T16:00:00.000Z'),
            fechaFin: new Date('2027-05-12T16:00:00.000Z'),
          }),
        ),
      ).rejects.toBeInstanceOf(QueryFailedError);
    } finally {
      await dataSource.query(
        `DROP TRIGGER IF EXISTS "TRG_fail_reservation_detail" ON ${schema}."reservacion_vestidos"`,
      );
      await dataSource.query(
        `DROP FUNCTION IF EXISTS ${schema}."fail_reservation_detail"()`,
      );
    }

    const after = (await dataSource.query(
      `SELECT COUNT(*)::integer AS "count" FROM ${schema}."reservaciones"`,
    )) as Array<{ count: number }>;
    expect(after).toEqual(before);
    await expect(
      reservacionesService.create(
        tenantA,
        input(clienteA, sucursalA, [vestido.id], {
          fechaInicio: new Date('2027-05-10T16:00:00.000Z'),
          fechaFin: new Date('2027-05-12T16:00:00.000Z'),
        }),
      ),
    ).resolves.toMatchObject({ estado: ReservacionEstado.CONFIRMADA });
  });
});
