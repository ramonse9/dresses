import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, Repository } from 'typeorm';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../src/audit/audit.constants.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PasswordHashService } from '../src/auth/password-hash.service.js';
import type { AccessTokenPayload } from '../src/auth/types/access-token-payload.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import {
  EmpresaUsuario,
  EmpresaUsuarioRol,
} from '../src/usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';

describe('PostgreSQL administrative audit queries', () => {
  let moduleRef: TestingModule;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let empresas: Repository<Empresa>;
  let usuarios: Repository<Usuario>;
  let membresias: Repository<EmpresaUsuario>;
  let empresaA: Empresa;
  let empresaB: Empresa;
  let ownerA: Usuario;
  let employeeA: Usuario;
  let ownerB: Usuario;
  let membershipA: EmpresaUsuario;
  let ownerTokenA: string;
  let employeeTokenA: string;
  let ownerTokenB: string;
  let eventAId: string;
  let eventA2Id: string;
  let eventBId: string;
  let resourceAId: string;
  let rangeStart: Date;
  let rangeEnd: Date;

  const suffix = `${process.pid}-${Date.now()}`;
  const password = 'integration-password';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleRef.get(DataSource);
    empresas = dataSource.getRepository(Empresa);
    usuarios = dataSource.getRepository(Usuario);
    membresias = dataSource.getRepository(EmpresaUsuario);
    const empresasService = moduleRef.get(EmpresasService);
    const passwordHashService = moduleRef.get(PasswordHashService);
    const authService = moduleRef.get(AuthService);
    const jwtService = moduleRef.get(JwtService);
    const auditService = moduleRef.get(AuditService);

    empresaA = await empresasService.create({
      nombre: 'Auditoría Alpha',
      slug: `auditoria-alpha-${suffix}`,
    });
    empresaB = await empresasService.create({
      nombre: 'Auditoría Beta',
      slug: `auditoria-beta-${suffix}`,
    });
    const passwordHash = await passwordHashService.hashPassword(password);
    [ownerA, employeeA, ownerB] = await usuarios.save([
      usuarios.create({
        email: `audit-owner-a-${suffix}@example.test`,
        passwordHash,
        nombre: 'Audit Owner Alpha',
        activo: true,
      }),
      usuarios.create({
        email: `audit-employee-a-${suffix}@example.test`,
        passwordHash,
        nombre: 'Audit Employee Alpha',
        activo: true,
      }),
      usuarios.create({
        email: `audit-owner-b-${suffix}@example.test`,
        passwordHash,
        nombre: 'Audit Owner Beta',
        activo: true,
      }),
    ]);
    [membershipA] = await membresias.save([
      membresias.create({
        usuarioId: ownerA.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
      membresias.create({
        usuarioId: employeeA.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: true,
      }),
      membresias.create({
        usuarioId: ownerB.id,
        empresaId: empresaB.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
    ]);

    ownerTokenA = await tenantToken(authService, jwtService, ownerA, empresaA);
    employeeTokenA = await tenantToken(
      authService,
      jwtService,
      employeeA,
      empresaA,
    );
    ownerTokenB = await tenantToken(authService, jwtService, ownerB, empresaB);

    rangeStart = new Date(Date.now() - 1_000);
    resourceAId = randomUUID();
    const eventA = await auditService.record({
      empresaId: empresaA.id,
      actorUsuarioId: ownerA.id,
      action: AUDIT_ACTIONS.RESERVATION_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.RESERVATION,
      resourceId: resourceAId,
      metadata: {
        previousState: 'BORRADOR',
        newState: 'CONFIRMADA',
        password: 'must-never-be-returned',
        nested: {
          tokenHash: 'must-never-be-returned',
          headers: { authorization: 'must-never-be-returned' },
          checksumHash: 'must-never-be-returned',
          safe: true,
        },
      },
      safeMetadataFields: ['previousState', 'newState', 'password', 'nested'],
      ipAddress: '203.0.113.10',
      userAgent: 'AuditBrowser/1.0',
    });
    const eventA2 = await auditService.record({
      empresaId: empresaA.id,
      actorUsuarioId: ownerA.id,
      action: AUDIT_ACTIONS.MEMBERSHIP_ROLE_CHANGED,
      resourceType: AUDIT_RESOURCE_TYPES.MEMBERSHIP,
      resourceId: membershipA.id,
      metadata: { previousRole: 'EMPLOYEE', newRole: 'OWNER' },
      safeMetadataFields: ['previousRole', 'newRole'],
    });
    const eventB = await auditService.record({
      empresaId: empresaB.id,
      actorUsuarioId: ownerB.id,
      action: AUDIT_ACTIONS.RESERVATION_UPDATED,
      resourceType: AUDIT_RESOURCE_TYPES.RESERVATION,
      resourceId: randomUUID(),
      metadata: { newState: 'CONFIRMADA' },
      safeMetadataFields: ['newState'],
    });
    eventAId = eventA.id;
    eventA2Id = eventA2.id;
    eventBId = eventB.id;
    rangeEnd = new Date(Date.now() + 1_000);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const userIds = [ownerA, employeeA, ownerB]
        .filter(Boolean)
        .map(({ id }) => id);
      if (userIds.length > 0) {
        await membresias.delete(userIds.map((usuarioId) => ({ usuarioId })));
        await usuarios.delete(userIds);
      }
      for (const empresa of [empresaA, empresaB]) {
        if (empresa) {
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quoteTenantSchemaName(empresa.schemaName)} CASCADE`,
          );
          await empresas.delete({ id: empresa.id });
        }
      }
    }
    await app?.close();
  });

  it('lists only the authenticated company with actor data and pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auditoria')
      .query({ page: '1', limit: '1' })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    expect(response.body).toMatchObject({
      data: [
        {
          actor: {
            id: ownerA.id,
            nombre: ownerA.nombre,
            email: ownerA.email,
            activo: true,
          },
        },
      ],
      pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /password|tokenHash|refreshToken|cookie|authorization|schemaName|tenant_/i,
    );
  });

  it('filters by action, resource, actor and semi-open date range', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auditoria')
      .query({
        action: AUDIT_ACTIONS.RESERVATION_UPDATED,
        resourceType: AUDIT_RESOURCE_TYPES.RESERVATION,
        resourceId: resourceAId,
        actorUsuarioId: ownerA.id,
        fechaDesde: rangeStart.toISOString(),
        fechaHasta: rangeEnd.toISOString(),
      })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    expect(response.body).toMatchObject({
      data: [
        {
          id: eventAId,
          action: AUDIT_ACTIONS.RESERVATION_UPDATED,
          resourceType: AUDIT_RESOURCE_TYPES.RESERVATION,
          resourceId: resourceAId,
          actor: { id: ownerA.id },
          metadata: {
            previousState: 'BORRADOR',
            newState: 'CONFIRMADA',
            nested: { safe: true },
          },
          ipAddress: '203.0.113.10',
          userAgent: 'AuditBrowser/1.0',
        },
      ],
      pagination: { total: 1 },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /must-never|password|tokenHash|schemaName|tenant_/i,
    );
  });

  it('returns safe detail to OWNER and 404 across companies', async () => {
    await request(app.getHttpServer())
      .get(`/api/auditoria/${eventA2Id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: eventA2Id,
          actor: { id: ownerA.id, email: ownerA.email },
          metadata: { previousRole: 'EMPLOYEE', newRole: 'OWNER' },
        });
      });

    await request(app.getHttpServer())
      .get(`/api/auditoria/${eventBId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/auditoria/${eventAId}`)
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .expect(404);
  });

  it('rejects EMPLOYEE and tenant selectors without changing scope', async () => {
    await request(app.getHttpServer())
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${employeeTokenA}`)
      .expect(403);

    for (const selector of [
      { empresaId: empresaB.id },
      { empresaSlug: empresaB.slug },
      { schemaName: empresaB.schemaName },
    ]) {
      await request(app.getHttpServer())
        .get('/api/auditoria')
        .query(selector)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400);
    }

    const response = await request(app.getHttpServer())
      .get('/api/auditoria')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('x-empresa-id', empresaB.id)
      .set('x-schema-name', empresaB.schemaName)
      .expect(200);
    expect(response.body.pagination.total).toBe(2);
    expect(response.body.data).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: eventBId })]),
    );
  });

  async function tenantToken(
    authService: AuthService,
    jwtService: JwtService,
    user: Usuario,
    empresa: Empresa,
  ): Promise<string> {
    const login = await authService.login({ email: user.email, password });
    const payload = await jwtService.verifyAsync<AccessTokenPayload>(
      login.accessToken,
    );
    return (await authService.selectEmpresa(payload, { empresaId: empresa.id }))
      .accessToken;
  }
});
