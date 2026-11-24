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
import { ClientesService } from '../src/clientes/clientes.service.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { SucursalesService } from '../src/sucursales/sucursales.service.js';
import { TenantResolverService } from '../src/tenancy/tenant-resolver.service.js';
import type { TenantScope } from '../src/tenancy/tenant-scope.js';
import { VestidoEstadoOperativo } from '../src/vestidos/entities/vestido.tenant-entity.js';
import { VestidosService } from '../src/vestidos/vestidos.service.js';

describe('PostgreSQL tenant resource auditing', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let audits: Repository<AuditEvent>;
  let auditService: AuditService;
  let empresasService: EmpresasService;
  let tenantResolver: TenantResolverService;
  let sucursalesService: SucursalesService;
  let clientesService: ClientesService;
  let vestidosService: VestidosService;
  let tenantA: TenantScope;
  let tenantB: TenantScope;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugA = `resource-audit-a-${suffix}`;
  const slugB = `resource-audit-b-${suffix}`;
  const actorA: AuthenticatedAuditActor = {
    actorUsuarioId: '019a6f33-82b7-4a22-971b-6a8d7c5e4f30',
    sessionId: '119a6f33-82b7-4a22-971b-6a8d7c5e4f30',
  };
  const actorB: AuthenticatedAuditActor = {
    actorUsuarioId: '219a6f33-82b7-4a22-971b-6a8d7c5e4f30',
    sessionId: '319a6f33-82b7-4a22-971b-6a8d7c5e4f30',
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
    tenantResolver = moduleRef.get(TenantResolverService);
    sucursalesService = moduleRef.get(SucursalesService);
    clientesService = moduleRef.get(ClientesService);
    vestidosService = moduleRef.get(VestidosService);

    const empresaA = await empresasService.create({
      nombre: 'Resource Audit A',
      slug: slugA,
    });
    const empresaB = await empresasService.create({
      nombre: 'Resource Audit B',
      slug: slugB,
    });
    tenantA = await tenantResolver.resolveByEmpresaId(empresaA.id);
    tenantB = await tenantResolver.resolveByEmpresaId(empresaB.id);
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

  it('records every branch, customer and dress event without leaking tenant data', async () => {
    const branchA = await sucursalesService.create(
      tenantA,
      { nombre: 'Centro A', direccion: 'Dirección privada A' },
      actorA,
    );
    const destinationA = await sucursalesService.create(
      tenantA,
      { nombre: 'Destino A' },
      actorA,
    );
    const branchB = await sucursalesService.create(
      tenantB,
      { nombre: 'Centro B' },
      actorB,
    );

    await sucursalesService.update(
      tenantA,
      branchA.id,
      {
        nombre: 'Centro A Actualizado',
        direccion: 'Nueva dirección privada',
        telefono: '555-0100',
      },
      actorA,
    );
    await sucursalesService.deactivate(tenantA, branchA.id, actorA);
    await sucursalesService.update(
      tenantA,
      branchA.id,
      { activo: true },
      actorA,
    );

    const customerA = await clientesService.create(
      tenantA,
      {
        nombre: 'Cliente Auditoría',
        email: 'cliente-audit@example.com',
        direccion: 'Dirección sensible original',
        notas: 'Nota sensible original',
      },
      actorA,
    );
    await clientesService.update(
      tenantA,
      customerA.id,
      {
        nombre: 'Cliente Actualizado',
        email: 'actualizado@example.com',
        direccion: 'Dirección sensible nueva',
        notas: 'Nota sensible nueva',
      },
      actorA,
    );
    await clientesService.deactivate(tenantA, customerA.id, actorA);
    await clientesService.updateEstado(tenantA, customerA.id, true, actorA);

    const dressA = await vestidosService.create(
      tenantA,
      {
        sucursalId: branchA.id,
        codigo: 'AUD-001',
        nombre: 'Vestido Auditado',
        descripcion: 'Descripción no auditada',
        talla: 'M',
        color: 'Azul',
        precioRenta: '1250.00',
        deposito: '500.00',
        estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      },
      actorA,
    );
    await vestidosService.update(
      tenantA,
      dressA.id,
      {
        nombre: 'Vestido Actualizado',
        descripcion: 'Descripción privada nueva',
      },
      actorA,
    );
    await vestidosService.update(
      tenantA,
      dressA.id,
      { sucursalId: destinationA.id },
      actorA,
    );
    await vestidosService.deactivate(tenantA, dressA.id, actorA);
    await vestidosService.update(tenantA, dressA.id, { activo: true }, actorA);
    await vestidosService.update(
      tenantA,
      dressA.id,
      { estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO },
      actorA,
    );
    const dressB = await vestidosService.create(
      tenantB,
      {
        sucursalId: branchB.id,
        codigo: 'AUD-001',
        nombre: 'Vestido Otro Tenant',
        talla: 'M',
        color: 'Azul',
        precioRenta: '1250.00',
        estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      },
      actorB,
    );

    const expectedA: Array<[AuditAction, string]> = [
      [AUDIT_ACTIONS.BRANCH_CREATED, branchA.id],
      [AUDIT_ACTIONS.BRANCH_UPDATED, branchA.id],
      [AUDIT_ACTIONS.BRANCH_DEACTIVATED, branchA.id],
      [AUDIT_ACTIONS.BRANCH_ACTIVATED, branchA.id],
      [AUDIT_ACTIONS.CUSTOMER_CREATED, customerA.id],
      [AUDIT_ACTIONS.CUSTOMER_UPDATED, customerA.id],
      [AUDIT_ACTIONS.CUSTOMER_DEACTIVATED, customerA.id],
      [AUDIT_ACTIONS.CUSTOMER_ACTIVATED, customerA.id],
      [AUDIT_ACTIONS.DRESS_CREATED, dressA.id],
      [AUDIT_ACTIONS.DRESS_UPDATED, dressA.id],
      [AUDIT_ACTIONS.DRESS_TRANSFERRED, dressA.id],
      [AUDIT_ACTIONS.DRESS_DEACTIVATED, dressA.id],
      [AUDIT_ACTIONS.DRESS_ACTIVATED, dressA.id],
      [AUDIT_ACTIONS.DRESS_OPERATIONAL_STATUS_CHANGED, dressA.id],
    ];
    for (const [action, resourceId] of expectedA) {
      const resourceType = action.startsWith('branch.')
        ? AUDIT_RESOURCE_TYPES.BRANCH
        : action.startsWith('customer.')
          ? AUDIT_RESOURCE_TYPES.CUSTOMER
          : AUDIT_RESOURCE_TYPES.DRESS;
      await expect(event(action, resourceId)).resolves.toMatchObject({
        empresaId: tenantA.empresaId,
        actorUsuarioId: actorA.actorUsuarioId,
        sessionId: actorA.sessionId,
        resourceType,
        resourceId,
      });
    }
    await expect(
      event(AUDIT_ACTIONS.DRESS_CREATED, dressB.id),
    ).resolves.toMatchObject({
      empresaId: tenantB.empresaId,
      actorUsuarioId: actorB.actorUsuarioId,
      sessionId: actorB.sessionId,
      resourceId: dressB.id,
    });

    await expect(
      event(AUDIT_ACTIONS.DRESS_TRANSFERRED, dressA.id),
    ).resolves.toMatchObject({
      metadata: {
        previousSucursalId: branchA.id,
        newSucursalId: destinationA.id,
      },
    });
    await expect(
      event(AUDIT_ACTIONS.DRESS_OPERATIONAL_STATUS_CHANGED, dressA.id),
    ).resolves.toMatchObject({
      metadata: {
        previousOperationalStatus: VestidoEstadoOperativo.DISPONIBLE,
        newOperationalStatus: VestidoEstadoOperativo.MANTENIMIENTO,
      },
    });
    await expect(
      event(AUDIT_ACTIONS.CUSTOMER_DEACTIVATED, customerA.id),
    ).resolves.toMatchObject({
      metadata: { previousActive: true, newActive: false },
    });
    expect(
      await audits.countBy({
        action: AUDIT_ACTIONS.DRESS_UPDATED,
        resourceId: dressA.id,
      }),
    ).toBe(1);

    const customerUpdate = await event(
      AUDIT_ACTIONS.CUSTOMER_UPDATED,
      customerA.id,
    );
    expect(customerUpdate.metadata).toMatchObject({
      changedFields: ['nombre', 'email', 'direccion', 'notas'],
      changes: {
        nombre: {
          previous: 'Cliente Auditoría',
          new: 'Cliente Actualizado',
        },
      },
    });
    expect(JSON.stringify(customerUpdate.metadata)).not.toMatch(
      /actualizado@example|dirección sensible|nota sensible|schemaName|tenant_/i,
    );

    const branchUpdate = await event(AUDIT_ACTIONS.BRANCH_UPDATED, branchA.id);
    expect(JSON.stringify(branchUpdate.metadata)).not.toMatch(
      /nueva dirección|555-0100|schemaName|tenant_/i,
    );

    const countBeforeQueries = await audits.count();
    await sucursalesService.findAll(tenantA);
    await clientesService.findOne(tenantA, customerA.id);
    await vestidosService.findOne(tenantA, dressA.id);
    expect(await audits.count()).toBe(countBeforeQueries);

    for (const audit of await audits.findBy({ empresaId: tenantA.empresaId })) {
      expect(JSON.stringify(audit)).not.toMatch(/schemaName|tenant_[0-9a-f]+/i);
    }
  });

  it('rolls back a tenant mutation when audit persistence fails', async () => {
    const customer = await clientesService.create(
      tenantA,
      { nombre: 'Cliente Rollback', email: 'rollback@example.com' },
      actorA,
    );
    const eventsBefore = await audits.countBy({
      action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
      resourceId: customer.id,
    });
    const auditFailure = vi
      .spyOn(auditService, 'record')
      .mockRejectedValueOnce(new Error('controlled tenant audit failure'));

    await expect(
      clientesService.update(
        tenantA,
        customer.id,
        { nombre: 'No debe persistirse' },
        actorA,
      ),
    ).rejects.toThrow('controlled tenant audit failure');
    auditFailure.mockRestore();

    await expect(
      clientesService.findOne(tenantA, customer.id),
    ).resolves.toMatchObject({
      nombre: 'Cliente Rollback',
    });
    await expect(
      audits.countBy({
        action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
        resourceId: customer.id,
      }),
    ).resolves.toBe(eventsBefore);
  });

  function event(action: AuditAction, resourceId: string): Promise<AuditEvent> {
    return audits.findOneByOrFail({ action, resourceId });
  }
});
