import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PasswordHashService } from '../src/auth/password-hash.service.js';
import type { AccessTokenPayload } from '../src/auth/types/access-token-payload.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import {
  EmpresaInvitacion,
  EmpresaInvitacionEstado,
} from '../src/invitaciones/entities/empresa-invitacion.entity.js';
import { MAIL_TRANSPORT } from '../src/mail/mail.tokens.js';
import type {
  MailTransport,
  TransportMailMessage,
} from '../src/mail/mail.types.js';
import {
  EmpresaUsuario,
  EmpresaUsuarioRol,
} from '../src/usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';

class ControllableMailTransport implements MailTransport {
  readonly messages: TransportMailMessage[] = [];
  fail = false;

  send(message: TransportMailMessage): Promise<void> {
    if (this.fail) {
      return Promise.reject(
        new Error(`SMTP unavailable ${extractToken(message)}`),
      );
    }
    this.messages.push({ ...message });
    return Promise.resolve();
  }

  reset(): void {
    this.fail = false;
    this.messages.length = 0;
  }
}

const integrationPassword = 'integration-password';

describe('PostgreSQL administración de invitaciones', () => {
  let moduleRef: TestingModule;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let invitations: Repository<EmpresaInvitacion>;
  let memberships: Repository<EmpresaUsuario>;
  let users: Repository<Usuario>;
  let companies: Repository<Empresa>;
  let mail: ControllableMailTransport;
  let empresaA: Empresa;
  let empresaB: Empresa;
  let ownerA: Usuario;
  let employeeA: Usuario;
  let existingMemberA: Usuario;
  let ownerB: Usuario;
  let ownerMembershipA: EmpresaUsuario;
  let employeeMembershipA: EmpresaUsuario;
  let ownerMembershipB: EmpresaUsuario;
  let ownerTokenA: string;
  let employeeTokenA: string;
  let ownerTokenB: string;

  const suffix = `${process.pid}-${Date.now()}`;

  beforeAll(async () => {
    mail = new ControllableMailTransport();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_TRANSPORT)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleRef.get(DataSource);
    invitations = dataSource.getRepository(EmpresaInvitacion);
    memberships = dataSource.getRepository(EmpresaUsuario);
    users = dataSource.getRepository(Usuario);
    companies = dataSource.getRepository(Empresa);

    const empresasService = moduleRef.get(EmpresasService);
    const passwordHashService = moduleRef.get(PasswordHashService);
    const authService = moduleRef.get(AuthService);
    const jwtService = moduleRef.get(JwtService);

    empresaA = await empresasService.create({
      nombre: 'Invitaciones Alpha',
      slug: `invitaciones-alpha-${suffix}`,
    });
    empresaB = await empresasService.create({
      nombre: 'Invitaciones Beta',
      slug: `invitaciones-beta-${suffix}`,
    });

    const passwordHash =
      await passwordHashService.hashPassword(integrationPassword);
    [ownerA, employeeA, existingMemberA, ownerB] = await users.save([
      users.create({
        email: `invite-owner-a-${suffix}@example.com`,
        passwordHash,
        nombre: 'Owner Alpha',
        activo: true,
      }),
      users.create({
        email: `invite-employee-a-${suffix}@example.com`,
        passwordHash,
        nombre: 'Employee Alpha',
        activo: true,
      }),
      users.create({
        email: `invite-existing-a-${suffix}@example.com`,
        passwordHash,
        nombre: 'Existing Alpha',
        activo: true,
      }),
      users.create({
        email: `invite-owner-b-${suffix}@example.com`,
        passwordHash,
        nombre: 'Owner Beta',
        activo: true,
      }),
    ]);

    [ownerMembershipA, employeeMembershipA, ownerMembershipB] =
      await memberships.save([
        memberships.create({
          empresaId: empresaA.id,
          usuarioId: ownerA.id,
          rol: EmpresaUsuarioRol.OWNER,
          activo: true,
        }),
        memberships.create({
          empresaId: empresaA.id,
          usuarioId: employeeA.id,
          rol: EmpresaUsuarioRol.EMPLOYEE,
          activo: true,
        }),
        memberships.create({
          empresaId: empresaB.id,
          usuarioId: ownerB.id,
          rol: EmpresaUsuarioRol.OWNER,
          activo: true,
        }),
      ]);
    await memberships.save(
      memberships.create({
        empresaId: empresaA.id,
        usuarioId: existingMemberA.id,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: true,
      }),
    );

    ownerTokenA = await tenantToken(authService, jwtService, ownerA, empresaA);
    employeeTokenA = await tenantToken(
      authService,
      jwtService,
      employeeA,
      empresaA,
    );
    ownerTokenB = await tenantToken(authService, jwtService, ownerB, empresaB);
  });

  beforeEach(async () => {
    mail.reset();
    await invitations.delete({ empresaId: In([empresaA.id, empresaB.id]) });
    await companies.update(
      { id: In([empresaA.id, empresaB.id]) },
      { activo: true },
    );
    await memberships.update(
      { id: ownerMembershipA.id },
      { rol: EmpresaUsuarioRol.OWNER, activo: true },
    );
    await memberships.update(
      { id: employeeMembershipA.id },
      { rol: EmpresaUsuarioRol.EMPLOYEE, activo: true },
    );
    await memberships.update(
      { id: ownerMembershipB.id },
      { rol: EmpresaUsuarioRol.OWNER, activo: true },
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const companyIds = [empresaA, empresaB]
        .filter(Boolean)
        .map(({ id }) => id);
      const userIds = [ownerA, employeeA, existingMemberA, ownerB]
        .filter(Boolean)
        .map(({ id }) => id);
      if (companyIds.length > 0) {
        await invitations.delete({ empresaId: In(companyIds) });
        await memberships.delete({ empresaId: In(companyIds) });
      }
      if (userIds.length > 0) {
        await users.delete(userIds);
      }
      for (const empresa of [empresaA, empresaB]) {
        if (empresa) {
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quoteTenantSchemaName(empresa.schemaName)} CASCADE`,
          );
          await companies.delete({ id: empresa.id });
        }
      }
    }
    await app?.close();
  });

  it('creates, normalizes, hashes and emails an invitation without exposing secrets', async () => {
    const email = `  NEW.PERSON-${suffix}@EXAMPLE.COM  `;
    const response = await request(app.getHttpServer())
      .post('/api/equipo/invitaciones')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .set('x-schema-name', 'tenant_untrusted')
      .send({ email, rol: EmpresaUsuarioRol.EMPLOYEE })
      .expect(201);

    expect(response.body).toMatchObject({
      empresaId: empresaA.id,
      email: email.trim().toLowerCase(),
      rol: EmpresaUsuarioRol.EMPLOYEE,
      estado: EmpresaInvitacionEstado.PENDIENTE,
      sendCount: 1,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /tokenHash|#token=|schemaName|tenant_/,
    );
    expect(mail.messages).toHaveLength(1);

    const token = extractToken(mail.messages[0]);
    const stored = await invitations
      .createQueryBuilder('invitation')
      .addSelect('invitation.tokenHash')
      .where('invitation.id = :id', { id: response.body.id })
      .getOneOrFail();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(stored.tokenHash).not.toContain(token);
    expect(stored.lastSentAt).toBeInstanceOf(Date);

    const url = extractUrl(mail.messages[0]);
    expect(url.search).toBe('');
    expect(url.pathname).toBe('/aceptar-invitacion');
    expect(url.hash).toBe(`#token=${token}`);
  });

  it('rejects EMPLOYEE, active memberships and a current duplicate', async () => {
    await request(app.getHttpServer())
      .post('/api/equipo/invitaciones')
      .set('Authorization', `Bearer ${employeeTokenA}`)
      .send({ email: `forbidden-${suffix}@example.com`, rol: 'EMPLOYEE' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/equipo/invitaciones')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ email: existingMemberA.email, rol: 'EMPLOYEE' })
      .expect(409);

    const duplicateEmail = `duplicate-${suffix}@example.com`;
    await createInvitation(ownerTokenA, duplicateEmail);
    await request(app.getHttpServer())
      .post('/api/equipo/invitaciones')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ email: duplicateEmail, rol: 'OWNER' })
      .expect(409);
    expect(await invitations.countBy({ empresaId: empresaA.id })).toBe(1);
  });

  it('revokes an expired invitation before creating its replacement', async () => {
    const email = `expired-${suffix}@example.com`;
    const expired = await invitations.save(
      invitations.create({
        empresaId: empresaA.id,
        email,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        tokenHash: hashToken('expired-token'),
        expiresAt: new Date(Date.now() - 60_000),
        acceptedAt: null,
        acceptedByUsuarioId: null,
        revokedAt: null,
        createdByUsuarioId: ownerA.id,
        lastSentAt: null,
        sendCount: 0,
      }),
    );
    const response = await createInvitation(ownerTokenA, email);

    expect(response.body.id).not.toBe(expired.id);
    await expect(
      invitations.findOneByOrFail({ id: expired.id }),
    ).resolves.toMatchObject({ revokedAt: expect.any(Date) });
    expect(await invitations.countBy({ empresaId: empresaA.id, email })).toBe(
      2,
    );
  });

  it('lists invitations with pagination, role, email and derived state filters', async () => {
    const pending = await createInvitation(
      ownerTokenA,
      `search-pending-${suffix}@example.com`,
      EmpresaUsuarioRol.OWNER,
    );
    const expired = await invitations.save(
      invitations.create({
        empresaId: empresaA.id,
        email: `search-expired-${suffix}@example.com`,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        tokenHash: hashToken('expired-search-token'),
        expiresAt: new Date(Date.now() - 60_000),
        acceptedAt: null,
        acceptedByUsuarioId: null,
        revokedAt: null,
        createdByUsuarioId: ownerA.id,
        lastSentAt: null,
        sendCount: 0,
      }),
    );
    const accepted = await invitations.save(
      invitations.create({
        empresaId: empresaA.id,
        email: `search-accepted-${suffix}@example.com`,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        tokenHash: hashToken('accepted-search-token'),
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: new Date(),
        acceptedByUsuarioId: employeeA.id,
        revokedAt: null,
        createdByUsuarioId: ownerA.id,
        lastSentAt: new Date(),
        sendCount: 1,
      }),
    );
    const revoked = await invitations.save(
      invitations.create({
        empresaId: empresaA.id,
        email: `search-revoked-${suffix}@example.com`,
        rol: EmpresaUsuarioRol.EMPLOYEE,
        tokenHash: hashToken('revoked-search-token'),
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        acceptedByUsuarioId: null,
        revokedAt: new Date(),
        createdByUsuarioId: ownerA.id,
        lastSentAt: new Date(),
        sendCount: 1,
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/equipo/invitaciones')
      .query({
        page: 1,
        limit: 10,
        estado: EmpresaInvitacionEstado.PENDIENTE,
        rol: EmpresaUsuarioRol.OWNER,
        q: 'SEARCH-PENDING',
      })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200);

    expect(response.body).toMatchObject({
      data: [{ id: pending.body.id, estado: 'PENDIENTE', rol: 'OWNER' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /tokenHash|#token=|schemaName|tenant_/,
    );

    await request(app.getHttpServer())
      .get('/api/equipo/invitaciones')
      .query({ estado: EmpresaInvitacionEstado.EXPIRADA })
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .expect(200)
      .expect((result) => {
        expect(result.body.data.map(({ id }: { id: string }) => id)).toContain(
          expired.id,
        );
      });

    for (const [estado, id] of [
      [EmpresaInvitacionEstado.ACEPTADA, accepted.id],
      [EmpresaInvitacionEstado.REVOCADA, revoked.id],
    ] as const) {
      await request(app.getHttpServer())
        .get('/api/equipo/invitaciones')
        .query({ estado })
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .expect(200)
        .expect((result) => {
          expect(
            result.body.data.map(
              ({ id: resultId }: { id: string }) => resultId,
            ),
          ).toContain(id);
        });
    }
  });

  it('rotates the token, renews expiration and applies the resend cooldown', async () => {
    const created = await createInvitation(
      ownerTokenA,
      `rotate-${suffix}@example.com`,
    );
    const invitationId = created.body.id as string;
    const oldToken = extractToken(mail.messages[0]);
    const old = await invitationWithHash(invitationId);
    await invitations.update(
      { id: invitationId },
      { lastSentAt: new Date(Date.now() - 600_000) },
    );

    const resent = await request(app.getHttpServer())
      .post(`/api/equipo/invitaciones/${invitationId}/reenviar`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(201);

    const newToken = extractToken(mail.messages[1]);
    const rotated = await invitationWithHash(invitationId);
    expect(newToken).not.toBe(oldToken);
    expect(rotated.tokenHash).not.toBe(old.tokenHash);
    expect(rotated.tokenHash).toBe(hashToken(newToken));
    expect(rotated.tokenHash).not.toBe(hashToken(oldToken));
    expect(rotated.expiresAt.getTime()).toBeGreaterThanOrEqual(
      old.expiresAt.getTime(),
    );
    expect(resent.body).toMatchObject({ sendCount: 2, estado: 'PENDIENTE' });

    await request(app.getHttpServer())
      .post(`/api/equipo/invitaciones/${invitationId}/reenviar`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(429);
    expect(mail.messages).toHaveLength(2);
  });

  it('logically revokes invitations and rejects accepted invitations', async () => {
    const created = await createInvitation(
      ownerTokenA,
      `revoke-${suffix}@example.com`,
    );
    const invitationId = created.body.id as string;

    const revoked = await request(app.getHttpServer())
      .delete(`/api/equipo/invitaciones/${invitationId}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(200);
    expect(revoked.body).toMatchObject({
      id: invitationId,
      estado: EmpresaInvitacionEstado.REVOCADA,
    });
    expect(await invitations.countBy({ id: invitationId })).toBe(1);
    await request(app.getHttpServer())
      .post(`/api/equipo/invitaciones/${invitationId}/reenviar`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(409);

    const accepted = await createInvitation(
      ownerTokenA,
      `accepted-${suffix}@example.com`,
    );
    await invitations.update(
      { id: accepted.body.id },
      { acceptedAt: new Date(), acceptedByUsuarioId: employeeA.id },
    );
    await request(app.getHttpServer())
      .delete(`/api/equipo/invitaciones/${accepted.body.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(409);
  });

  it('returns 404 for cross-company invitation identifiers', async () => {
    const created = await createInvitation(
      ownerTokenB,
      `cross-${suffix}@example.com`,
    );

    await request(app.getHttpServer())
      .post(`/api/equipo/invitaciones/${created.body.id}/reenviar`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/equipo/invitaciones/${created.body.id}`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(404);
  });

  it('serializes concurrent creation of the same pending invitation', async () => {
    const email = `concurrent-${suffix}@example.com`;
    const results = await Promise.all([
      request(app.getHttpServer())
        .post('/api/equipo/invitaciones')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ email, rol: 'EMPLOYEE' }),
      request(app.getHttpServer())
        .post('/api/equipo/invitaciones')
        .set('Authorization', `Bearer ${ownerTokenA}`)
        .send({ email, rol: 'EMPLOYEE' }),
    ]);

    expect(results.map(({ status }) => status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      await invitations.countBy({
        empresaId: empresaA.id,
        email,
        acceptedAt: IsNull(),
        revokedAt: IsNull(),
      }),
    ).toBe(1);
    expect(mail.messages).toHaveLength(1);
  });

  it('keeps a safe persisted invitation after SMTP failure and allows resend', async () => {
    const email = `smtp-failure-${suffix}@example.com`;
    const consoleSpies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    mail.fail = true;

    const failure = await request(app.getHttpServer())
      .post('/api/equipo/invitaciones')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ email, rol: 'EMPLOYEE' })
      .expect(503);
    expect(JSON.stringify(failure.body)).not.toMatch(/#token=|tokenHash/);
    expect(consoleSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);

    const stored = await invitationByEmailWithHash(empresaA.id, email);
    expect(stored).toMatchObject({ sendCount: 0, lastSentAt: null });
    const failedHash = stored.tokenHash;

    mail.fail = false;
    const resent = await request(app.getHttpServer())
      .post(`/api/equipo/invitaciones/${stored.id}/reenviar`)
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({})
      .expect(201);
    const after = await invitationWithHash(stored.id);
    expect(resent.body).toMatchObject({ sendCount: 1 });
    expect(after.tokenHash).not.toBe(failedHash);
    expect(after.tokenHash).toBe(hashToken(extractToken(mail.messages[0])));
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  function createInvitation(
    token: string,
    email: string,
    rol: EmpresaUsuarioRol = EmpresaUsuarioRol.EMPLOYEE,
  ) {
    return request(app.getHttpServer())
      .post('/api/equipo/invitaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({ email, rol })
      .expect(201);
  }

  function invitationWithHash(id: string): Promise<EmpresaInvitacion> {
    return invitations
      .createQueryBuilder('invitation')
      .addSelect('invitation.tokenHash')
      .where('invitation.id = :id', { id })
      .getOneOrFail();
  }

  function invitationByEmailWithHash(
    empresaId: string,
    email: string,
  ): Promise<EmpresaInvitacion> {
    return invitations
      .createQueryBuilder('invitation')
      .addSelect('invitation.tokenHash')
      .where('invitation.empresaId = :empresaId', { empresaId })
      .andWhere('invitation.email = :email', { email })
      .getOneOrFail();
  }
});

async function tenantToken(
  authService: AuthService,
  jwtService: JwtService,
  user: Usuario,
  empresa: Empresa,
): Promise<string> {
  const login = await authService.login({
    email: user.email,
    password: integrationPassword,
  });
  const payload = await jwtService.verifyAsync<AccessTokenPayload>(
    login.accessToken,
  );
  return (await authService.selectEmpresa(payload, { empresaId: empresa.id }))
    .accessToken;
}

function extractUrl(message: TransportMailMessage): URL {
  const match = message.text.match(/https?:\/\/\S+/);
  if (!match) {
    throw new Error('Invitation URL missing from test message');
  }
  return new URL(match[0]);
}

function extractToken(message: TransportMailMessage): string {
  const token = new URLSearchParams(extractUrl(message).hash.slice(1)).get(
    'token',
  );
  if (!token) {
    throw new Error('Invitation token missing from test message');
  }
  return token;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
