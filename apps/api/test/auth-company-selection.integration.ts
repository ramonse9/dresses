import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
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
    await moduleRef.init();

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

    await moduleRef?.close();
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

    membresiaA.activo = false;
    await membresiasRepository.save(membresiaA);
    await expect(
      authService.selectEmpresa(payloadA, { empresaId: empresaA.id }),
    ).rejects.toThrow('No tienes acceso a esta empresa');

    empresaB.activo = false;
    await empresasRepository.save(empresaB);
    await expect(authService.listEmpresas(payloadA)).resolves.toEqual([]);
    await expect(
      authService.selectEmpresa(payloadA, { empresaId: empresaB.id }),
    ).rejects.toThrow('No tienes acceso a esta empresa');

    await authService.logout(payloadA);
    const request = {
      headers: { authorization: `Bearer ${selectedA.accessToken}` },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    await expect(jwtAuthGuard.canActivate(context)).rejects.toThrow(
      'Token inválido',
    );
  });
});
