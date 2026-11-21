import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, Repository } from 'typeorm';
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

describe('PostgreSQL equipo miembros', () => {
  let moduleRef: TestingModule;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let empresasRepository: Repository<Empresa>;
  let usuariosRepository: Repository<Usuario>;
  let membresiasRepository: Repository<EmpresaUsuario>;
  let empresaA: Empresa;
  let empresaB: Empresa;
  let ownerA: Usuario;
  let employeeA: Usuario;
  let sharedUser: Usuario;
  let inactiveUser: Usuario;
  let ownerMembershipA: EmpresaUsuario;
  let employeeMembershipA: EmpresaUsuario;
  let sharedMembershipA: EmpresaUsuario;
  let sharedMembershipB: EmpresaUsuario;
  let inactiveUserMembershipA: EmpresaUsuario;
  let ownerTokenA: string;
  let employeeTokenA: string;
  let sharedTokenB: string;

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
    empresasRepository = dataSource.getRepository(Empresa);
    usuariosRepository = dataSource.getRepository(Usuario);
    membresiasRepository = dataSource.getRepository(EmpresaUsuario);

    const empresasService = moduleRef.get(EmpresasService);
    const passwordHashService = moduleRef.get(PasswordHashService);
    const authService = moduleRef.get(AuthService);
    const jwtService = moduleRef.get(JwtService);
    empresaA = await empresasService.create({
      nombre: 'Equipo Alpha',
      slug: `equipo-alpha-${suffix}`,
    });
    empresaB = await empresasService.create({
      nombre: 'Equipo Beta',
      slug: `equipo-beta-${suffix}`,
    });

    const passwordHash = await passwordHashService.hashPassword(password);
    [ownerA, employeeA, sharedUser, inactiveUser] =
      await usuariosRepository.save([
        usuariosRepository.create({
          email: `equipo-owner-${suffix}@example.com`,
          passwordHash,
          nombre: 'Equipo Owner',
          activo: true,
        }),
        usuariosRepository.create({
          email: `equipo-employee-${suffix}@example.com`,
          passwordHash,
          nombre: 'Equipo Employee',
          activo: true,
        }),
        usuariosRepository.create({
          email: `equipo-shared-${suffix}@example.com`,
          passwordHash,
          nombre: 'Equipo Shared',
          activo: true,
        }),
        usuariosRepository.create({
          email: `equipo-inactive-${suffix}@example.com`,
          passwordHash,
          nombre: 'Equipo Inactive',
          activo: false,
        }),
      ]);

    [
      ownerMembershipA,
      employeeMembershipA,
      sharedMembershipA,
      sharedMembershipB,
      inactiveUserMembershipA,
    ] = await membresiasRepository.save([
      membresiasRepository.create({
        usuarioId: ownerA.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
      membresiasRepository.create({
        usuarioId: employeeA.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: true,
      }),
      membresiasRepository.create({
        usuarioId: sharedUser.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: false,
      }),
      membresiasRepository.create({
        usuarioId: sharedUser.id,
        empresaId: empresaB.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
      membresiasRepository.create({
        usuarioId: inactiveUser.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: true,
      }),
    ]);

    const ownerLogin = await authService.login({
      email: ownerA.email,
      password,
    });
    const employeeLogin = await authService.login({
      email: employeeA.email,
      password,
    });
    const sharedLogin = await authService.login({
      email: sharedUser.email,
      password,
    });
    ownerTokenA = (
      await authService.selectEmpresa(
        await jwtService.verifyAsync<AccessTokenPayload>(
          ownerLogin.accessToken,
        ),
        { empresaId: empresaA.id },
      )
    ).accessToken;
    employeeTokenA = (
      await authService.selectEmpresa(
        await jwtService.verifyAsync<AccessTokenPayload>(
          employeeLogin.accessToken,
        ),
        { empresaId: empresaA.id },
      )
    ).accessToken;
    sharedTokenB = (
      await authService.selectEmpresa(
        await jwtService.verifyAsync<AccessTokenPayload>(
          sharedLogin.accessToken,
        ),
        { empresaId: empresaB.id },
      )
    ).accessToken;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const userIds = [ownerA, employeeA, sharedUser, inactiveUser]
        .filter(Boolean)
        .map(({ id }) => id);
      if (userIds.length > 0) {
        await membresiasRepository.delete(
          userIds.map((usuarioId) => ({ usuarioId })),
        );
        await usuariosRepository.delete(userIds);
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

  it('lists only the selected empresa with filters, inactive memberships and inactive users', async () => {
    const sharedResponse = await request(app.getHttpServer())
      .get('/api/equipo/miembros')
      .query({ q: 'shared', activo: 'false', page: '1', limit: '1' })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);
    expect(sharedResponse.body).toMatchObject({
      data: [
        {
          id: sharedMembershipA.id,
          usuario: {
            id: sharedUser.id,
            email: sharedUser.email,
            activo: true,
          },
          rol: EmpresaUsuarioRol.EMPLOYEE,
          activo: false,
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });
    expect(JSON.stringify(sharedResponse.body)).not.toMatch(
      /passwordHash|refreshTokenHash|sessionId|schemaName|tenant_/,
    );

    const inactiveUserResponse = await request(app.getHttpServer())
      .get('/api/equipo/miembros')
      .query({ q: 'inactive', rol: EmpresaUsuarioRol.EMPLOYEE })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);
    expect(inactiveUserResponse.body.data).toEqual([
      expect.objectContaining({
        id: inactiveUserMembershipA.id,
        usuario: expect.objectContaining({ activo: false }),
      }),
    ]);
  });

  it('keeps a shared user membership isolated between two empresas', async () => {
    await request(app.getHttpServer())
      .get(`/api/equipo/miembros/${sharedMembershipB.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(404);

    const response = await request(app.getHttpServer())
      .get(`/api/equipo/miembros/${sharedMembershipB.id}`)
      .set('Authorization', `Bearer ${sharedTokenB}`)
      .expect(200);
    expect(response.body).toMatchObject({
      id: sharedMembershipB.id,
      usuario: { id: sharedUser.id },
      rol: EmpresaUsuarioRol.OWNER,
    });
  });

  it('rejects EMPLOYEE and unknown tenant selectors', async () => {
    await request(app.getHttpServer())
      .get('/api/equipo/miembros')
      .set('Authorization', `Bearer ${employeeTokenA}`)
      .expect(403);

    for (const query of [
      { empresaId: empresaB.id },
      { empresaSlug: empresaB.slug },
      { schemaName: empresaB.schemaName },
      { usuarioId: sharedUser.id },
    ]) {
      await request(app.getHttpServer())
        .get('/api/equipo/miembros')
        .query(query)
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(400);
    }
  });

  it('ignores spoofed tenant headers and loses access immediately after deactivation', async () => {
    await request(app.getHttpServer())
      .get(`/api/equipo/miembros/${ownerMembershipA.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('x-empresa-id', empresaB.id)
      .set('x-schema-name', empresaB.schemaName)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${employeeTokenA}`)
      .expect(200);
    employeeMembershipA.activo = false;
    await membresiasRepository.save(employeeMembershipA);
    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${employeeTokenA}`)
      .expect(403);
  });
});
