import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { PasswordHashService } from '../src/auth/password-hash.service.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { EmpresaInvitacion } from '../src/invitaciones/entities/empresa-invitacion.entity.js';
import {
  EmpresaUsuario,
  EmpresaUsuarioRol,
} from '../src/usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';

const existingPassword = 'existing-password';
const newPassword = 'new-account-password';

describe('PostgreSQL aceptación de invitaciones', () => {
  let moduleRef: TestingModule;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let invitations: Repository<EmpresaInvitacion>;
  let memberships: Repository<EmpresaUsuario>;
  let users: Repository<Usuario>;
  let companies: Repository<Empresa>;
  let passwordHashService: PasswordHashService;
  let empresa: Empresa;
  let creator: Usuario;
  let existing: Usuario;
  let inactive: Usuario;
  const acceptedUserIds = new Set<string>();
  const suffix = `${process.pid}-${Date.now()}`;
  const originalAcceptanceLimit =
    process.env.AUTH_RATE_LIMIT_INVITATION_ACCEPTANCE_LIMIT;
  const originalVerificationLimit =
    process.env.AUTH_RATE_LIMIT_INVITATION_VERIFICATION_LIMIT;

  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT_INVITATION_ACCEPTANCE_LIMIT = '100';
    process.env.AUTH_RATE_LIMIT_INVITATION_VERIFICATION_LIMIT = '100';
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleRef.get(DataSource);
    invitations = dataSource.getRepository(EmpresaInvitacion);
    memberships = dataSource.getRepository(EmpresaUsuario);
    users = dataSource.getRepository(Usuario);
    companies = dataSource.getRepository(Empresa);
    passwordHashService = moduleRef.get(PasswordHashService);

    empresa = await moduleRef.get(EmpresasService).create({
      nombre: 'Aceptación Segura',
      slug: `aceptacion-segura-${suffix}`,
    });
    const passwordHash =
      await passwordHashService.hashPassword(existingPassword);
    [creator, existing, inactive] = await users.save([
      users.create({
        email: `accept-creator-${suffix}@example.com`,
        nombre: 'Creator',
        passwordHash,
        activo: true,
      }),
      users.create({
        email: `accept-existing-${suffix}@example.com`,
        nombre: 'Existing Name',
        passwordHash,
        activo: true,
      }),
      users.create({
        email: `accept-inactive-${suffix}@example.com`,
        nombre: 'Inactive User',
        passwordHash,
        activo: false,
      }),
    ]);
  });

  beforeEach(async () => {
    await invitations.delete({ empresaId: empresa.id });
    await memberships.delete({ empresaId: empresa.id });
    if (acceptedUserIds.size > 0) {
      await users.delete([...acceptedUserIds]);
      acceptedUserIds.clear();
    }
    await companies.update({ id: empresa.id }, { activo: true });
    await users.update(
      { id: existing.id },
      { activo: true, nombre: 'Existing Name' },
    );
    await users.update({ id: inactive.id }, { activo: false });
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && empresa) {
      await invitations.delete({ empresaId: empresa.id });
      await memberships.delete({ empresaId: empresa.id });
      if (acceptedUserIds.size > 0) {
        await users.delete([...acceptedUserIds]);
      }
      await users.delete([creator.id, existing.id, inactive.id]);
      await dataSource.query(
        `DROP SCHEMA IF EXISTS ${quoteTenantSchemaName(empresa.schemaName)} CASCADE`,
      );
      await companies.delete({ id: empresa.id });
    }
    await app?.close();
    restoreEnvironment(
      'AUTH_RATE_LIMIT_INVITATION_ACCEPTANCE_LIMIT',
      originalAcceptanceLimit,
    );
    restoreEnvironment(
      'AUTH_RATE_LIMIT_INVITATION_VERIFICATION_LIMIT',
      originalVerificationLimit,
    );
  });

  it('verifies a valid token with a masked email and minimal response', async () => {
    const token = opaqueToken('verify-valid');
    const existingToken = opaqueToken('verify-existing');
    await createInvitation(token, `new-${suffix}@example.com`);
    await createInvitation(existingToken, existing.email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/invitaciones/verificar')
      .send({ token })
      .expect(200);

    expect(response.body).toMatchObject({
      empresaNombre: empresa.nombre,
      email: `n***@example.com`,
      rol: EmpresaUsuarioRol.EMPLOYEE,
      accountExists: false,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /empresaId|usuarioId|token|passwordHash|schemaName|tenant_/,
    );

    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/verificar')
      .send({ token: existingToken })
      .expect(200)
      .expect(({ body }) => expect(body.accountExists).toBe(true));
  });

  it('returns the same generic error for invalid, expired, revoked and used tokens', async () => {
    const expiredToken = opaqueToken('expired');
    const revokedToken = opaqueToken('revoked');
    const usedToken = opaqueToken('used');
    await createInvitation(expiredToken, `expired-${suffix}@example.com`, {
      expiresAt: new Date(Date.now() - 60_000),
    });
    await createInvitation(revokedToken, `revoked-${suffix}@example.com`, {
      revokedAt: new Date(),
    });
    await createInvitation(usedToken, existing.email, {
      acceptedAt: new Date(),
      acceptedByUsuarioId: existing.id,
    });

    const messages = [];
    for (const token of [
      opaqueToken('invalid'),
      expiredToken,
      revokedToken,
      usedToken,
    ]) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/invitaciones/verificar')
        .send({ token })
        .expect(400);
      messages.push(response.body.message);
      expect(JSON.stringify(response.body)).not.toContain(token);
    }
    expect(new Set(messages).size).toBe(1);
  });

  it('creates a new Argon2id account and membership using the backend role', async () => {
    const token = opaqueToken('new-account');
    const email = `new-account-${suffix}@example.com`;
    const invitation = await createInvitation(token, email, {
      rol: EmpresaUsuarioRol.OWNER,
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token, nombre: '  Nueva Persona  ', password: newPassword })
      .expect(200);
    expect(response.body).toEqual({
      accepted: true,
      message: 'Invitación aceptada. Ya puedes iniciar sesión.',
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /token|passwordHash|empresaId|schemaName|tenant_/,
    );

    const usuario = await userWithPassword(email);
    acceptedUserIds.add(usuario.id);
    expect(usuario).toMatchObject({ nombre: 'Nueva Persona', activo: true });
    expect(usuario.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(
      passwordHashService.verifyPassword(newPassword, usuario.passwordHash),
    ).resolves.toBe(true);
    await expect(
      memberships.findOneByOrFail({
        usuarioId: usuario.id,
        empresaId: empresa.id,
      }),
    ).resolves.toMatchObject({ rol: EmpresaUsuarioRol.OWNER, activo: true });
    await expect(
      invitations.findOneByOrFail({ id: invitation.id }),
    ).resolves.toMatchObject({
      acceptedAt: expect.any(Date),
      acceptedByUsuarioId: usuario.id,
    });
  });

  it('accepts an existing active account without changing its profile or password', async () => {
    const token = opaqueToken('existing-account');
    const before = await userWithPassword(existing.email);
    await createInvitation(token, existing.email, {
      rol: EmpresaUsuarioRol.EMPLOYEE,
    });

    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({
        token,
        nombre: 'Must Not Replace Existing Name',
        password: existingPassword,
      })
      .expect(200);

    const after = await userWithPassword(existing.email);
    expect(after.nombre).toBe('Existing Name');
    expect(after.passwordHash).toBe(before.passwordHash);
    await expect(
      memberships.findOneByOrFail({
        usuarioId: existing.id,
        empresaId: empresa.id,
      }),
    ).resolves.toMatchObject({ rol: EmpresaUsuarioRol.EMPLOYEE, activo: true });
  });

  it('rejects an incorrect password and an inactive user without consuming tokens', async () => {
    const wrongPasswordToken = opaqueToken('wrong-password');
    const inactiveToken = opaqueToken('inactive-user');
    const wrongInvitation = await createInvitation(
      wrongPasswordToken,
      existing.email,
    );
    const inactiveInvitation = await createInvitation(
      inactiveToken,
      inactive.email,
    );

    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token: wrongPasswordToken, password: 'incorrect-password' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token: inactiveToken, password: existingPassword })
      .expect(403);

    for (const id of [wrongInvitation.id, inactiveInvitation.id]) {
      await expect(invitations.findOneByOrFail({ id })).resolves.toMatchObject({
        acceptedAt: null,
        acceptedByUsuarioId: null,
      });
    }
    expect(await memberships.countBy({ empresaId: empresa.id })).toBe(0);
  });

  it('reactivates an inactive membership with the invitation role', async () => {
    const token = opaqueToken('reactivate');
    const membership = await memberships.save(
      memberships.create({
        usuarioId: existing.id,
        empresaId: empresa.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: false,
      }),
    );
    await createInvitation(token, existing.email, {
      rol: EmpresaUsuarioRol.EMPLOYEE,
    });

    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token, password: existingPassword })
      .expect(200);
    await expect(
      memberships.findOneByOrFail({ id: membership.id }),
    ).resolves.toMatchObject({
      activo: true,
      rol: EmpresaUsuarioRol.EMPLOYEE,
    });
  });

  it('rejects an active duplicate membership and rolls back the invitation', async () => {
    const token = opaqueToken('active-duplicate');
    const invitation = await createInvitation(token, existing.email);
    await memberships.save(
      memberships.create({
        usuarioId: existing.id,
        empresaId: empresa.id,
        rol: EmpresaUsuarioRol.OWNER,
        activo: true,
      }),
    );

    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token, password: existingPassword })
      .expect(409);
    await expect(
      invitations.findOneByOrFail({ id: invitation.id }),
    ).resolves.toMatchObject({
      acceptedAt: null,
      acceptedByUsuarioId: null,
    });
  });

  it('rejects an inactive company and preserves all records', async () => {
    const token = opaqueToken('inactive-company');
    const email = `inactive-company-${suffix}@example.com`;
    const invitation = await createInvitation(token, email);
    await companies.update({ id: empresa.id }, { activo: false });

    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token, nombre: 'No Created', password: newPassword })
      .expect(400);
    expect(await users.countBy({ email })).toBe(0);
    await expect(
      invitations.findOneByOrFail({ id: invitation.id }),
    ).resolves.toMatchObject({
      acceptedAt: null,
    });
  });

  it('allows only one concurrent acceptance and makes the token single-use', async () => {
    const token = opaqueToken('concurrent');
    const email = `concurrent-${suffix}@example.com`;
    await createInvitation(token, email);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/invitaciones/aceptar')
        .send({ token, nombre: 'Concurrent User', password: newPassword }),
      request(app.getHttpServer())
        .post('/api/auth/invitaciones/aceptar')
        .send({ token, nombre: 'Concurrent User', password: newPassword }),
    ]);
    expect(
      responses.map(({ status }) => status).sort((left, right) => left - right),
    ).toEqual([200, 400]);
    expect(await users.countBy({ email })).toBe(1);
    const usuario = await users.findOneByOrFail({ email });
    acceptedUserIds.add(usuario.id);
    expect(
      await memberships.countBy({
        usuarioId: usuario.id,
        empresaId: empresa.id,
      }),
    ).toBe(1);

    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token, nombre: 'Again', password: newPassword })
      .expect(400);
  });

  async function createInvitation(
    token: string,
    email: string,
    overrides: Partial<EmpresaInvitacion> = {},
  ): Promise<EmpresaInvitacion> {
    return invitations.save(
      invitations.create({
        empresaId: empresa.id,
        email,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
        acceptedAt: null,
        acceptedByUsuarioId: null,
        revokedAt: null,
        createdByUsuarioId: creator.id,
        lastSentAt: new Date(),
        sendCount: 1,
        ...overrides,
      }),
    );
  }

  function userWithPassword(email: string): Promise<Usuario> {
    return users
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.email = :email', { email })
      .getOneOrFail();
  }
});

function opaqueToken(seed: string): string {
  return createHash('sha256').update(seed).digest('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function restoreEnvironment(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
