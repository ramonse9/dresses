import { ConflictException, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../src/audit/audit.constants.js';
import { AuditEvent } from '../src/audit/entities/audit-event.entity.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PasswordHashService } from '../src/auth/password-hash.service.js';
import type { AccessTokenPayload } from '../src/auth/types/access-token-payload.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { EquipoService } from '../src/equipo/equipo.service.js';
import {
  EmpresaUsuario,
  EmpresaUsuarioRol,
} from '../src/usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';

describe('PostgreSQL administración de membresías', () => {
  let moduleRef: TestingModule;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let equipoService: EquipoService;
  let empresasRepository: Repository<Empresa>;
  let usuariosRepository: Repository<Usuario>;
  let membresiasRepository: Repository<EmpresaUsuario>;
  let auditEvents: Repository<AuditEvent>;
  let auditService: AuditService;
  let empresaA: Empresa;
  let empresaB: Empresa;
  let ownerA1: Usuario;
  let ownerA2: Usuario;
  let employee: Usuario;
  let inactiveUser: Usuario;
  let ownerB: Usuario;
  let ownerMembershipA1: EmpresaUsuario;
  let ownerMembershipA2: EmpresaUsuario;
  let employeeMembershipA: EmpresaUsuario;
  let employeeMembershipB: EmpresaUsuario;
  let inactiveMembershipA: EmpresaUsuario;
  let ownerMembershipB: EmpresaUsuario;
  let ownerTokenA1: string;
  let ownerSessionA1: string;
  let employeeTokenA: string;
  let employeeTokenB: string;

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
    equipoService = moduleRef.get(EquipoService);
    empresasRepository = dataSource.getRepository(Empresa);
    usuariosRepository = dataSource.getRepository(Usuario);
    membresiasRepository = dataSource.getRepository(EmpresaUsuario);
    auditEvents = dataSource.getRepository(AuditEvent);
    auditService = moduleRef.get(AuditService);

    const empresasService = moduleRef.get(EmpresasService);
    const passwordHashService = moduleRef.get(PasswordHashService);
    const authService = moduleRef.get(AuthService);
    const jwtService = moduleRef.get(JwtService);

    empresaA = await empresasService.create({
      nombre: 'Membresías Alpha',
      slug: `membresias-alpha-${suffix}`,
    });
    empresaB = await empresasService.create({
      nombre: 'Membresías Beta',
      slug: `membresias-beta-${suffix}`,
    });

    const passwordHash = await passwordHashService.hashPassword(password);
    [ownerA1, ownerA2, employee, inactiveUser, ownerB] =
      await usuariosRepository.save([
        usuariosRepository.create({
          email: `membresias-owner-1-${suffix}@example.com`,
          passwordHash,
          nombre: 'Owner Uno',
          activo: true,
        }),
        usuariosRepository.create({
          email: `membresias-owner-2-${suffix}@example.com`,
          passwordHash,
          nombre: 'Owner Dos',
          activo: true,
        }),
        usuariosRepository.create({
          email: `membresias-employee-${suffix}@example.com`,
          passwordHash,
          nombre: 'Employee Compartido',
          activo: true,
        }),
        usuariosRepository.create({
          email: `membresias-inactive-${suffix}@example.com`,
          passwordHash,
          nombre: 'Usuario Inactivo',
          activo: false,
        }),
        usuariosRepository.create({
          email: `membresias-owner-b-${suffix}@example.com`,
          passwordHash,
          nombre: 'Owner Beta',
          activo: true,
        }),
      ]);

    [
      ownerMembershipA1,
      ownerMembershipA2,
      employeeMembershipA,
      employeeMembershipB,
      inactiveMembershipA,
      ownerMembershipB,
    ] = await membresiasRepository.save([
      membresiasRepository.create({
        usuarioId: ownerA1.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
      membresiasRepository.create({
        usuarioId: ownerA2.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
      membresiasRepository.create({
        usuarioId: employee.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: true,
      }),
      membresiasRepository.create({
        usuarioId: employee.id,
        empresaId: empresaB.id,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: true,
      }),
      membresiasRepository.create({
        usuarioId: inactiveUser.id,
        empresaId: empresaA.id,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: false,
      }),
      membresiasRepository.create({
        usuarioId: ownerB.id,
        empresaId: empresaB.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
    ]);

    const ownerLogin = await authService.login({
      email: ownerA1.email,
      password,
    });
    const employeeLogin = await authService.login({
      email: employee.email,
      password,
    });
    const ownerPayload = await jwtService.verifyAsync<AccessTokenPayload>(
      ownerLogin.accessToken,
    );
    ownerSessionA1 = ownerPayload.sessionId;
    ownerTokenA1 = (
      await authService.selectEmpresa(ownerPayload, { empresaId: empresaA.id })
    ).accessToken;
    const employeePayload = await jwtService.verifyAsync<AccessTokenPayload>(
      employeeLogin.accessToken,
    );
    employeeTokenA = (
      await authService.selectEmpresa(employeePayload, {
        empresaId: empresaA.id,
      })
    ).accessToken;
    employeeTokenB = (
      await authService.selectEmpresa(employeePayload, {
        empresaId: empresaB.id,
      })
    ).accessToken;
  });

  beforeEach(async () => {
    await empresasRepository.update({ id: empresaA.id }, { activo: true });
    await usuariosRepository.update({ id: inactiveUser.id }, { activo: false });
    await membresiasRepository.update(
      { id: ownerMembershipA1.id },
      { rol: EmpresaUsuarioRol.OWNER, activo: true },
    );
    await membresiasRepository.update(
      { id: ownerMembershipA2.id },
      { rol: EmpresaUsuarioRol.OWNER, activo: true },
    );
    await membresiasRepository.update(
      { id: employeeMembershipA.id },
      { rol: EmpresaUsuarioRol.EMPLOYEE, activo: true },
    );
    await membresiasRepository.update(
      { id: employeeMembershipB.id },
      { rol: EmpresaUsuarioRol.EMPLOYEE, activo: true },
    );
    await membresiasRepository.update(
      { id: inactiveMembershipA.id },
      { rol: EmpresaUsuarioRol.EMPLOYEE, activo: false },
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const userIds = [ownerA1, ownerA2, employee, inactiveUser, ownerB]
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

  it('promotes and demotes memberships without changing the global user', async () => {
    const before = await usuariosRepository.findOneByOrFail({
      id: employee.id,
    });

    const promoted = await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${employeeMembershipA.id}/rol`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ rol: EmpresaUsuarioRol.OWNER })
      .expect(200);
    expect(promoted.body).toMatchObject({
      id: employeeMembershipA.id,
      rol: EmpresaUsuarioRol.OWNER,
      usuario: { id: employee.id, email: employee.email },
    });
    expect(JSON.stringify(promoted.body)).not.toMatch(
      /passwordHash|refreshTokenHash|sessionId|schemaName|tenant_/,
    );

    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${ownerMembershipA2.id}/rol`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ rol: EmpresaUsuarioRol.EMPLOYEE })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: ownerMembershipA2.id,
          rol: EmpresaUsuarioRol.EMPLOYEE,
        });
      });

    const after = await usuariosRepository.findOneByOrFail({ id: employee.id });
    expect(after).toMatchObject({
      id: before.id,
      email: before.email,
      nombre: before.nombre,
      activo: before.activo,
    });

    await expect(
      auditEvents.findOneByOrFail({
        action: AUDIT_ACTIONS.MEMBERSHIP_ROLE_CHANGED,
        resourceType: AUDIT_RESOURCE_TYPES.MEMBERSHIP,
        resourceId: employeeMembershipA.id,
      }),
    ).resolves.toMatchObject({
      empresaId: empresaA.id,
      actorUsuarioId: ownerA1.id,
      sessionId: ownerSessionA1,
      metadata: {
        previousRole: EmpresaUsuarioRol.EMPLOYEE,
        newRole: EmpresaUsuarioRol.OWNER,
      },
    });
  });

  it('deactivates immediately only in the selected empresa and can reactivate', async () => {
    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${employeeTokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${employeeMembershipA.id}/estado`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ activo: false })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: employeeMembershipA.id,
          activo: false,
        });
      });

    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${employeeTokenA}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${employeeTokenB}`)
      .expect(200);
    await expect(
      usuariosRepository.findOneByOrFail({ id: employee.id }),
    ).resolves.toMatchObject({ activo: true });

    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${employeeMembershipA.id}/estado`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ activo: true })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${employeeTokenA}`)
      .expect(200);

    await expect(
      auditEvents.findOneByOrFail({
        action: AUDIT_ACTIONS.MEMBERSHIP_DEACTIVATED,
        resourceId: employeeMembershipA.id,
      }),
    ).resolves.toMatchObject({
      empresaId: empresaA.id,
      actorUsuarioId: ownerA1.id,
      sessionId: ownerSessionA1,
      metadata: { previousActive: true, newActive: false },
    });
    await expect(
      auditEvents.findOneByOrFail({
        action: AUDIT_ACTIONS.MEMBERSHIP_ACTIVATED,
        resourceId: employeeMembershipA.id,
      }),
    ).resolves.toMatchObject({
      empresaId: empresaA.id,
      actorUsuarioId: ownerA1.id,
      sessionId: ownerSessionA1,
      metadata: { previousActive: false, newActive: true },
    });
  });

  it('rejects EMPLOYEE mutations and memberships from another empresa', async () => {
    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${ownerMembershipA1.id}/rol`)
      .set('Authorization', `Bearer ${employeeTokenA}`)
      .send({ rol: EmpresaUsuarioRol.EMPLOYEE })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${ownerMembershipB.id}/estado`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ activo: false })
      .expect(404);
  });

  it('rolls back a sensitive membership mutation when auditing fails', async () => {
    const eventsBefore = await auditEvents.countBy({
      action: AUDIT_ACTIONS.MEMBERSHIP_ROLE_CHANGED,
      resourceId: employeeMembershipA.id,
    });
    const auditFailure = vi
      .spyOn(auditService, 'record')
      .mockRejectedValueOnce(new Error('controlled audit failure'));

    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${employeeMembershipA.id}/rol`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ rol: EmpresaUsuarioRol.OWNER })
      .expect(500);

    await expect(
      membresiasRepository.findOneByOrFail({ id: employeeMembershipA.id }),
    ).resolves.toMatchObject({ rol: EmpresaUsuarioRol.EMPLOYEE });
    await expect(
      auditEvents.countBy({
        action: AUDIT_ACTIONS.MEMBERSHIP_ROLE_CHANGED,
        resourceId: employeeMembershipA.id,
      }),
    ).resolves.toBe(eventsBefore);
    auditFailure.mockRestore();
  });

  it('does not reactivate memberships for an inactive user or empresa', async () => {
    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${inactiveMembershipA.id}/estado`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ activo: true })
      .expect(409);

    await empresasRepository.update({ id: empresaA.id }, { activo: false });
    await expect(
      equipoService.updateEstado(empresaA.id, employeeMembershipA.id, true),
    ).rejects.toBeInstanceOf(ConflictException);
    await empresasRepository.update({ id: empresaA.id }, { activo: true });
  });

  it('protects the last active OWNER and rolls back both mutations', async () => {
    await membresiasRepository.update(
      { id: ownerMembershipA2.id },
      { rol: EmpresaUsuarioRol.EMPLOYEE },
    );

    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${ownerMembershipA1.id}/rol`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ rol: EmpresaUsuarioRol.EMPLOYEE })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${ownerMembershipA1.id}/estado`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ activo: false })
      .expect(409);

    await expect(
      membresiasRepository.findOneByOrFail({ id: ownerMembershipA1.id }),
    ).resolves.toMatchObject({ rol: EmpresaUsuarioRol.OWNER, activo: true });
  });

  it('does not count a globally inactive user as the remaining OWNER', async () => {
    await membresiasRepository.update(
      { id: ownerMembershipA2.id },
      { rol: EmpresaUsuarioRol.EMPLOYEE },
    );
    await membresiasRepository.update(
      { id: inactiveMembershipA.id },
      { rol: EmpresaUsuarioRol.OWNER, activo: true },
    );

    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${ownerMembershipA1.id}/estado`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ activo: false })
      .expect(409);
  });

  it('allows an OWNER to deactivate itself when another active OWNER remains', async () => {
    await request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${ownerMembershipA1.id}/estado`)
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .send({ activo: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', `Bearer ${ownerTokenA1}`)
      .expect(403);
  });

  it('serializes concurrent deactivations so one OWNER always remains', async () => {
    const eventsBefore =
      (await auditEvents.countBy({
        action: AUDIT_ACTIONS.MEMBERSHIP_DEACTIVATED,
        resourceId: ownerMembershipA1.id,
      })) +
      (await auditEvents.countBy({
        action: AUDIT_ACTIONS.MEMBERSHIP_DEACTIVATED,
        resourceId: ownerMembershipA2.id,
      }));
    const results = await Promise.allSettled([
      equipoService.updateEstado(empresaA.id, ownerMembershipA1.id, false),
      equipoService.updateEstado(empresaA.id, ownerMembershipA2.id, false),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    await expect(
      membresiasRepository.count({
        where: {
          empresaId: empresaA.id,
          rol: EmpresaUsuarioRol.OWNER,
          activo: true,
        },
      }),
    ).resolves.toBe(1);
    const eventsAfter =
      (await auditEvents.countBy({
        action: AUDIT_ACTIONS.MEMBERSHIP_DEACTIVATED,
        resourceId: ownerMembershipA1.id,
      })) +
      (await auditEvents.countBy({
        action: AUDIT_ACTIONS.MEMBERSHIP_DEACTIVATED,
        resourceId: ownerMembershipA2.id,
      }));
    expect(eventsAfter - eventsBefore).toBe(1);
  });
});
