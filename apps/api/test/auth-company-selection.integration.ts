import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { PasswordHashService } from '../src/auth/password-hash.service.js';
import { TenantAuthGuard } from '../src/auth/tenant-auth.guard.js';
import type { AccessTokenPayload } from '../src/auth/types/access-token-payload.js';
import { TenantContextService } from '../src/database/tenant-context.service.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import type { TenantScope } from '../src/tenancy/tenant-scope.js';
import { EmpresaUsuario } from '../src/usuarios/entities/empresa-usuario.entity.js';
import { EmpresaUsuarioRol } from '../src/usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';

describe('PostgreSQL authenticated empresa selection', () => {
  let moduleRef: TestingModule;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usuariosRepository: Repository<Usuario>;
  let membresiasRepository: Repository<EmpresaUsuario>;
  let empresasRepository: Repository<Empresa>;
  let authService: AuthService;
  let jwtService: JwtService;
  let jwtAuthGuard: JwtAuthGuard;
  let tenantAuthGuard: TenantAuthGuard;
  let tenantContextService: TenantContextService;
  let empresaA: Empresa;
  let empresaB: Empresa;
  let usuarioA: Usuario;
  let usuarioB: Usuario;
  let membresiaA: EmpresaUsuario;

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
    usuariosRepository = dataSource.getRepository(Usuario);
    membresiasRepository = dataSource.getRepository(EmpresaUsuario);
    empresasRepository = dataSource.getRepository(Empresa);
    authService = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
    jwtAuthGuard = moduleRef.get(JwtAuthGuard);
    tenantAuthGuard = moduleRef.get(TenantAuthGuard);
    tenantContextService = moduleRef.get(TenantContextService);

    const empresasService = moduleRef.get(EmpresasService);
    const passwordHashService = moduleRef.get(PasswordHashService);
    empresaA = await empresasService.create({
      nombre: 'Selection Alpha',
      slug: `selection-alpha-${suffix}`,
    });
    empresaB = await empresasService.create({
      nombre: 'Selection Beta',
      slug: `selection-beta-${suffix}`,
    });

    const passwordHash = await passwordHashService.hashPassword(password);
    [usuarioA, usuarioB] = await usuariosRepository.save([
      usuariosRepository.create({
        email: `selection-a-${suffix}@example.com`,
        passwordHash,
        nombre: 'Selection User A',
        activo: true,
      }),
      usuariosRepository.create({
        email: `selection-b-${suffix}@example.com`,
        passwordHash,
        nombre: 'Selection User B',
        activo: true,
      }),
    ]);

    const membresias = await membresiasRepository.save([
      membresiasRepository.create({
        usuarioId: usuarioA.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
      membresiasRepository.create({
        usuarioId: usuarioA.id,
        empresaId: empresaB.id,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: true,
      }),
      membresiasRepository.create({
        usuarioId: usuarioB.id,
        empresaId: empresaB.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
    ]);
    membresiaA = membresias[0];
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (usuarioA && usuarioB) {
        await membresiasRepository.delete([
          { usuarioId: usuarioA.id },
          { usuarioId: usuarioB.id },
        ]);
        await usuariosRepository.delete([usuarioA.id, usuarioB.id]);
      }

      for (const empresa of [empresaA, empresaB]) {
        if (empresa) {
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quoteTenantSchemaName(empresa.schemaName)} CASCADE`,
          );
          await empresasRepository.delete({ id: empresa.id });
        }
      }
    }

    await app?.close();
  });

  it('supports multiple empresas and prevents cross-company selection', async () => {
    const loginA = await authService.login({
      email: usuarioA.email,
      password,
    });
    const loginB = await authService.login({
      email: usuarioB.email,
      password,
    });
    const payloadA = await jwtService.verifyAsync<AccessTokenPayload>(
      loginA.accessToken,
    );
    const payloadB = await jwtService.verifyAsync<AccessTokenPayload>(
      loginB.accessToken,
    );

    const empresasA = await authService.listEmpresas(payloadA);
    const empresasB = await authService.listEmpresas(payloadB);
    expect(empresasA).toEqual([
      {
        id: empresaA.id,
        nombre: empresaA.nombre,
        slug: empresaA.slug,
        rol: EmpresaUsuarioRol.OWNER,
      },
      {
        id: empresaB.id,
        nombre: empresaB.nombre,
        slug: empresaB.slug,
        rol: EmpresaUsuarioRol.EMPLOYEE,
      },
    ]);
    expect(empresasB).toEqual([
      {
        id: empresaB.id,
        nombre: empresaB.nombre,
        slug: empresaB.slug,
        rol: EmpresaUsuarioRol.OWNER,
      },
    ]);
    expect(JSON.stringify([empresasA, empresasB])).not.toContain('schemaName');
    expect(JSON.stringify([empresasA, empresasB])).not.toContain('tenant_');

    const selectedA = await authService.selectEmpresa(payloadA, {
      empresaId: empresaA.id,
    });
    const selectedPayloadA = await jwtService.verifyAsync<
      Record<string, unknown>
    >(selectedA.accessToken);
    expect(selectedPayloadA).toMatchObject({
      sub: usuarioA.id,
      sessionId: payloadA.sessionId,
      empresaId: empresaA.id,
      rol: EmpresaUsuarioRol.OWNER,
    });
    expect(selectedPayloadA).not.toHaveProperty('schemaName');

    const selectedB = await authService.selectEmpresa(payloadB, {
      empresaId: empresaB.id,
    });
    const selectedEmployeeB = await authService.selectEmpresa(payloadA, {
      empresaId: empresaB.id,
    });

    async function resolveScopeFromToken(
      accessToken: string,
      spoofedEmpresaId: string,
    ): Promise<TenantScope> {
      const request: {
        headers: Record<string, string>;
        query: Record<string, string>;
        params: Record<string, string>;
        body: Record<string, string>;
        user?: AccessTokenPayload;
        tenantScope?: TenantScope;
      } = {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'x-empresa-id': spoofedEmpresaId,
          'x-schema-name': 'tenant_untrusted',
        },
        query: { empresaId: spoofedEmpresaId, schemaName: 'tenant_untrusted' },
        params: { empresaId: spoofedEmpresaId, schemaName: 'tenant_untrusted' },
        body: { empresaId: spoofedEmpresaId, schemaName: 'tenant_untrusted' },
      };
      const context = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      await jwtAuthGuard.canActivate(context);
      await tenantAuthGuard.canActivate(context);

      if (!request.tenantScope) {
        throw new Error('TenantAuthGuard did not attach a TenantScope');
      }

      return request.tenantScope;
    }

    const scopeA = await resolveScopeFromToken(
      selectedA.accessToken,
      empresaB.id,
    );
    const scopeB = await resolveScopeFromToken(
      selectedB.accessToken,
      empresaA.id,
    );
    expect(scopeA.empresaId).toBe(empresaA.id);
    expect(scopeB.empresaId).toBe(empresaB.id);

    const sucursalAResponse = await request(app.getHttpServer())
      .post('/api/sucursales')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .send({ nombre: 'Token Centro' })
      .expect(201);
    const sucursalBResponse = await request(app.getHttpServer())
      .post('/api/sucursales')
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .send({ nombre: 'Token Centro' })
      .expect(201);
    const sucursalASecondaryResponse = await request(app.getHttpServer())
      .post('/api/sucursales')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .send({ nombre: 'Token Norte' })
      .expect(201);
    const sucursalBSecondaryResponse = await request(app.getHttpServer())
      .post('/api/sucursales')
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .send({ nombre: 'Token Norte' })
      .expect(201);
    expect(sucursalAResponse.body).toMatchObject({
      nombre: 'Token Centro',
      activo: true,
    });
    expect(sucursalBResponse.body).toMatchObject({
      nombre: 'Token Centro',
      activo: true,
    });
    expect(
      JSON.stringify([
        sucursalAResponse.body,
        sucursalBResponse.body,
        sucursalASecondaryResponse.body,
        sucursalBSecondaryResponse.body,
      ]),
    ).not.toContain('tenant_');

    const vestidoAResponse = await request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .send({
        sucursalId: sucursalAResponse.body.id,
        codigo: 'TOKEN-001',
        nombre: 'Vestido Token A',
        talla: 'M',
        color: 'Azul',
        precioRenta: '1250.50',
      })
      .expect(201);
    const vestidoBResponse = await request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .send({
        sucursalId: sucursalBResponse.body.id,
        codigo: 'TOKEN-001',
        nombre: 'Vestido Token B',
        talla: 'M',
        color: 'Rojo',
        precioRenta: '1500.00',
      })
      .expect(201);
    expect(vestidoAResponse.body).toMatchObject({ codigo: 'TOKEN-001' });
    expect(vestidoBResponse.body).toMatchObject({ codigo: 'TOKEN-001' });
    expect(
      JSON.stringify([vestidoAResponse.body, vestidoBResponse.body]),
    ).not.toContain('tenant_');

    await request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .send({
        sucursalId: sucursalBResponse.body.id,
        codigo: 'EMPLOYEE-DENIED',
        nombre: 'No autorizada',
        talla: 'M',
        color: 'Negro',
        precioRenta: '500.00',
      })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .send({
        sucursalId: sucursalBResponse.body.id,
        codigo: 'TENANT-SELECTOR-DENIED',
        nombre: 'Selector rechazado',
        talla: 'M',
        color: 'Negro',
        precioRenta: '500.00',
        schemaName: empresaA.schemaName,
      })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/vestidos?schemaName=${empresaA.schemaName}`)
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/vestidos')
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .set('x-empresa-id', empresaA.id)
      .set('x-schema-name', empresaA.schemaName)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          data: [
            expect.objectContaining({
              id: vestidoBResponse.body.id,
              sucursal: expect.objectContaining({
                id: sucursalBResponse.body.id,
              }),
            }),
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
        expect(JSON.stringify(response.body)).not.toContain('schemaName');
        expect(JSON.stringify(response.body)).not.toContain('tenant_');
      });
    await request(app.getHttpServer())
      .get(`/api/vestidos/${String(vestidoBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .set('x-empresa-id', empresaA.id)
      .set('x-schema-name', empresaA.schemaName)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ id: vestidoBResponse.body.id });
        expect(JSON.stringify(response.body)).not.toContain('tenant_');
      });
    await request(app.getHttpServer())
      .get(`/api/vestidos/${String(vestidoAResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .expect(404);
    const vestidoASecondaryResponse = await request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .send({
        sucursalId: sucursalASecondaryResponse.body.id,
        codigo: 'TOKEN-SECOND',
        nombre: 'Vestido Secundario A',
        talla: 'L',
        color: 'Verde',
        precioRenta: '900.00',
      })
      .expect(201);
    const vestidoBSecondaryResponse = await request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .send({
        sucursalId: sucursalBSecondaryResponse.body.id,
        codigo: 'TOKEN-SECOND',
        nombre: 'Vestido Secundario B',
        talla: 'L',
        color: 'Verde',
        precioRenta: '900.00',
      })
      .expect(201);
    expect(vestidoASecondaryResponse.body.codigo).toBe('TOKEN-SECOND');
    expect(vestidoBSecondaryResponse.body.codigo).toBe('TOKEN-SECOND');
    await request(app.getHttpServer())
      .patch(`/api/vestidos/${String(vestidoBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .send({ nombre: 'No autorizada' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/vestidos/${String(vestidoBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .send({ sucursalId: sucursalBSecondaryResponse.body.id })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/vestidos/${String(vestidoBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .send({ activo: true })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/vestidos/${String(vestidoBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/vestidos/${String(vestidoBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .send({
        codigo: ' token-002 ',
        nombre: 'Vestido actualizado',
        sucursalId: sucursalBSecondaryResponse.body.id,
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          codigo: 'TOKEN-002',
          nombre: 'Vestido actualizado',
          sucursalId: sucursalBSecondaryResponse.body.id,
          activo: true,
        });
        expect(JSON.stringify(response.body)).not.toContain('tenant_');
      });
    await request(app.getHttpServer())
      .patch(`/api/vestidos/${String(vestidoBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .send({ empresaId: empresaA.id, activo: true })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/api/vestidos/${String(vestidoBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ activo: false });
      });
    await request(app.getHttpServer())
      .patch(`/api/vestidos/${String(vestidoBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .send({ activo: true })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ activo: true });
      });
    await request(app.getHttpServer())
      .patch(`/api/vestidos/${String(vestidoAResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .send({ nombre: 'Cruce' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/vestidos/${String(vestidoAResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(2);
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: sucursalBResponse.body.id }),
            expect.objectContaining({
              id: sucursalBSecondaryResponse.body.id,
            }),
          ]),
        );
      });
    await request(app.getHttpServer())
      .post('/api/sucursales')
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .send({ nombre: 'No autorizada' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/sucursales/${String(sucursalBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .send({ nombre: 'No autorizada' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/sucursales/${String(sucursalBResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedEmployeeB.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/sucursales/${String(sucursalAResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/sucursales/${String(sucursalAResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ activo: false });
      });
    await request(app.getHttpServer())
      .post(`/api/empresas/${empresaA.slug}/sucursales`)
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .send({ nombre: 'Ruta anterior' })
      .expect(404);

    const currentSchemaA = await tenantContextService.run(
      scopeA,
      async (manager) => {
        const rows = (await manager.query(
          'SELECT current_schema() AS schema',
        )) as Array<{ schema: string }>;
        return rows[0]?.schema;
      },
    );
    const currentSchemaB = await tenantContextService.run(
      scopeB,
      async (manager) => {
        const rows = (await manager.query(
          'SELECT current_schema() AS schema',
        )) as Array<{ schema: string }>;
        return rows[0]?.schema;
      },
    );
    expect(currentSchemaA).toBe(empresaA.schemaName);
    expect(currentSchemaB).toBe(empresaB.schemaName);

    const poolState = (await dataSource.query(
      "SELECT current_schema() AS schema, current_setting('search_path') AS search_path",
    )) as Array<{ schema: string; search_path: string }>;
    expect(poolState[0]?.schema).toBe('public');
    expect(poolState[0]?.search_path).not.toContain('tenant_');

    await expect(
      authService.selectEmpresa(payloadB, { empresaId: empresaA.id }),
    ).rejects.toThrow('No tienes acceso a esta empresa');

    membresiaA.rol = EmpresaUsuarioRol.EMPLOYEE;
    await membresiasRepository.save(membresiaA);
    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/vestidos')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/vestidos/${String(vestidoAResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .send({
        sucursalId: sucursalASecondaryResponse.body.id,
        codigo: 'STALE-ROLE',
        nombre: 'Rol obsoleto',
        talla: 'M',
        color: 'Negro',
        precioRenta: '500.00',
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/vestidos/${String(vestidoAResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .send({ activo: true })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/vestidos/${String(vestidoAResponse.body.id)}`)
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/sucursales')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .send({ nombre: 'Rol JWT obsoleto' })
      .expect(403);

    membresiaA.activo = false;
    await membresiasRepository.save(membresiaA);
    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/vestidos')
      .set('Authorization', `Bearer ${selectedA.accessToken}`)
      .expect(403);
    await expect(
      authService.selectEmpresa(payloadA, { empresaId: empresaA.id }),
    ).rejects.toThrow('No tienes acceso a esta empresa');

    empresaB.activo = false;
    await empresasRepository.save(empresaB);
    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/vestidos')
      .set('Authorization', `Bearer ${selectedB.accessToken}`)
      .expect(403);
    await expect(authService.listEmpresas(payloadA)).resolves.toEqual([]);
    await expect(
      authService.selectEmpresa(payloadA, { empresaId: empresaB.id }),
    ).rejects.toThrow('No tienes acceso a esta empresa');

    await authService.logout(payloadA);
    const guardRequest = {
      headers: { authorization: `Bearer ${selectedA.accessToken}` },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => guardRequest }),
    } as unknown as ExecutionContext;
    await expect(jwtAuthGuard.canActivate(context)).rejects.toThrow(
      'Token inválido',
    );
  });
});
