import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthSession } from '../src/auth/entities/auth-session.entity.js';
import { PasswordResetToken } from '../src/auth/entities/password-reset-token.entity.js';
import { PasswordHashService } from '../src/auth/password-hash.service.js';
import { MAIL_TRANSPORT } from '../src/mail/mail.tokens.js';
import type {
  MailTransport,
  TransportMailMessage,
} from '../src/mail/mail.types.js';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';

class ControllableMailTransport implements MailTransport {
  readonly messages: TransportMailMessage[] = [];
  fail = false;

  send(message: TransportMailMessage): Promise<void> {
    if (this.fail) {
      return Promise.reject(
        new Error(`Provider failure ${extractToken(message)}`),
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

const currentPassword = 'current-password';
const newPassword = 'new-secure-password';

describe('PostgreSQL password recovery', () => {
  let moduleRef: TestingModule;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let users: Repository<Usuario>;
  let tokens: Repository<PasswordResetToken>;
  let sessions: Repository<AuthSession>;
  let passwordHashService: PasswordHashService;
  let authService: AuthService;
  let mail: ControllableMailTransport;
  let activeUser: Usuario;
  let inactiveUser: Usuario;
  const suffix = `${process.pid}-${Date.now()}`;
  const originalRequestLimit =
    process.env.AUTH_RATE_LIMIT_RECOVERY_REQUEST_LIMIT;
  const originalResetLimit = process.env.AUTH_RATE_LIMIT_PASSWORD_RESET_LIMIT;

  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT_RECOVERY_REQUEST_LIMIT = '100';
    process.env.AUTH_RATE_LIMIT_PASSWORD_RESET_LIMIT = '100';
    mail = new ControllableMailTransport();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_TRANSPORT)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleRef.get(DataSource);
    users = dataSource.getRepository(Usuario);
    tokens = dataSource.getRepository(PasswordResetToken);
    sessions = dataSource.getRepository(AuthSession);
    passwordHashService = moduleRef.get(PasswordHashService);
    authService = moduleRef.get(AuthService);

    const passwordHash =
      await passwordHashService.hashPassword(currentPassword);
    [activeUser, inactiveUser] = await users.save([
      users.create({
        email: `recovery-active-${suffix}@example.com`,
        passwordHash,
        nombre: 'Recovery Active',
        activo: true,
        passwordChangedAt: null,
      }),
      users.create({
        email: `recovery-inactive-${suffix}@example.com`,
        passwordHash,
        nombre: 'Recovery Inactive',
        activo: false,
        passwordChangedAt: null,
      }),
    ]);
  });

  beforeEach(async () => {
    mail.reset();
    await tokens.delete({ usuarioId: activeUser.id });
    await tokens.delete({ usuarioId: inactiveUser.id });
    await sessions.delete({ usuarioId: activeUser.id });
    await sessions.delete({ usuarioId: inactiveUser.id });
    await dataSource.query(
      `UPDATE "public"."usuarios" SET "password_hash" = $1, "password_changed_at" = NULL, "activo" = CASE WHEN "id" = $2 THEN true ELSE false END WHERE "id" IN ($2, $3)`,
      [
        await passwordHashService.hashPassword(currentPassword),
        activeUser.id,
        inactiveUser.id,
      ],
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await tokens.delete({ usuarioId: activeUser.id });
      await tokens.delete({ usuarioId: inactiveUser.id });
      await sessions.delete({ usuarioId: activeUser.id });
      await sessions.delete({ usuarioId: inactiveUser.id });
      await users.delete([activeUser.id, inactiveUser.id]);
    }
    await app?.close();
    restoreEnvironment(
      'AUTH_RATE_LIMIT_RECOVERY_REQUEST_LIMIT',
      originalRequestLimit,
    );
    restoreEnvironment(
      'AUTH_RATE_LIMIT_PASSWORD_RESET_LIMIT',
      originalResetLimit,
    );
  });

  it('returns the same public response for existing, missing and inactive users', async () => {
    const existing = await requestRecovery(
      `  ${activeUser.email.toUpperCase()}  `,
    );
    const missing = await requestRecovery(`missing-${suffix}@example.com`);
    const inactive = await requestRecovery(inactiveUser.email);

    expect(existing.status).toBe(202);
    expect(missing.status).toBe(202);
    expect(inactive.status).toBe(202);
    expect(existing.body).toEqual(missing.body);
    expect(missing.body).toEqual(inactive.body);
    expect(JSON.stringify(existing.body)).not.toMatch(
      /email|token|password|schemaName|tenant_/i,
    );
    expect(mail.messages).toHaveLength(1);
    expect(await tokens.count()).toBe(1);
  });

  it('emails a fragment token and persists only its SHA-256 hash', async () => {
    const response = await requestRecovery(activeUser.email);

    expect(response.status).toBe(202);
    expect(mail.messages).toHaveLength(1);
    const token = extractToken(mail.messages[0]);
    const url = extractUrl(mail.messages[0]);
    const stored = await tokens
      .createQueryBuilder('token')
      .addSelect('token.tokenHash')
      .where('token.usuarioId = :usuarioId', { usuarioId: activeUser.id })
      .getOneOrFail();

    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(stored.tokenHash).not.toContain(token);
    expect(url.pathname).toBe('/restablecer-password');
    expect(url.search).toBe('');
    expect(url.hash).toBe(`#token=${token}`);
  });

  it('applies cooldown and revokes the previous token before replacement', async () => {
    await requestRecovery(activeUser.email);
    const first = await tokens.findOneByOrFail({ usuarioId: activeUser.id });

    await requestRecovery(activeUser.email);
    expect(mail.messages).toHaveLength(1);
    expect(await tokens.countBy({ usuarioId: activeUser.id })).toBe(1);

    await dataSource.query(
      `UPDATE "public"."password_reset_tokens" SET "created_at" = now() - interval '301 seconds' WHERE "id" = $1`,
      [first.id],
    );
    await requestRecovery(activeUser.email);

    expect(mail.messages).toHaveLength(2);
    await expect(
      tokens.findOneByOrFail({ id: first.id }),
    ).resolves.toMatchObject({ revokedAt: expect.any(Date) });
    expect(
      await tokens.countBy({
        usuarioId: activeUser.id,
        revokedAt: IsNull(),
      }),
    ).toBe(1);
  });

  it('keeps the generic response and revokes an undelivered token', async () => {
    mail.fail = true;
    const response = await requestRecovery(activeUser.email);

    expect(response.status).toBe(202);
    expect(JSON.stringify(response.body)).not.toMatch(/token|email/i);
    await expect(
      tokens.findOneByOrFail({ usuarioId: activeUser.id }),
    ).resolves.toMatchObject({ revokedAt: expect.any(Date) });
  });

  it('returns one generic error for invalid, expired, revoked and used tokens', async () => {
    const cases = [
      { seed: 'invalid', stored: false },
      { seed: 'expired', expiresAt: new Date(Date.now() - 60_000) },
      { seed: 'revoked', revokedAt: new Date() },
      { seed: 'used', usedAt: new Date() },
    ];
    const messages: string[] = [];

    for (const scenario of cases) {
      await tokens.delete({ usuarioId: activeUser.id });
      const token = opaqueToken(scenario.seed);
      if (scenario.stored !== false) {
        await createToken(token, scenario);
      }
      const response = await request(app.getHttpServer())
        .post('/api/auth/password/restablecer')
        .send({ token, password: newPassword })
        .expect(400);
      messages.push(response.body.message);
      expect(JSON.stringify(response.body)).not.toContain(token);
    }
    expect(new Set(messages).size).toBe(1);
  });

  it('changes the password atomically and revokes access and refresh sessions', async () => {
    const login = await authService.login({
      email: activeUser.email,
      password: currentPassword,
    });
    await requestRecovery(activeUser.email);
    const token = extractToken(mail.messages[0]);

    await request(app.getHttpServer())
      .post('/api/auth/password/restablecer')
      .send({ token, password: newPassword })
      .expect(200)
      .expect({
        message: 'Contraseña restablecida. Ya puedes iniciar sesión.',
      });

    const usuario = await userWithPassword();
    expect(usuario.passwordHash).toMatch(/^\$argon2id\$/);
    expect(usuario.passwordChangedAt).toBeInstanceOf(Date);
    await expect(
      passwordHashService.verifyPassword(newPassword, usuario.passwordHash),
    ).resolves.toBe(true);
    await expect(
      passwordHashService.verifyPassword(currentPassword, usuario.passwordHash),
    ).resolves.toBe(false);
    await expect(
      tokens.findOneByOrFail({ usuarioId: activeUser.id }),
    ).resolves.toMatchObject({ usedAt: expect.any(Date) });
    expect(
      await sessions.countBy({
        usuarioId: activeUser.id,
        revokedAt: IsNull(),
      }),
    ).toBe(0);
    await expect(
      sessions.findOneByOrFail({ usuarioId: activeUser.id }),
    ).resolves.toMatchObject({
      revokedAt: expect.any(Date),
      revokedByUsuarioId: activeUser.id,
    });

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `vestidos_refresh=${login.refreshToken}`)
      .send({})
      .expect(401);
  });

  it('rejects the current password and rolls back token and session changes', async () => {
    const login = await authService.login({
      email: activeUser.email,
      password: currentPassword,
    });
    const token = opaqueToken('same-password');
    const stored = await createToken(token);

    await request(app.getHttpServer())
      .post('/api/auth/password/restablecer')
      .send({ token, password: currentPassword })
      .expect(409);

    await expect(
      tokens.findOneByOrFail({ id: stored.id }),
    ).resolves.toMatchObject({ usedAt: null, revokedAt: null });
    await expect(userWithPassword()).resolves.toMatchObject({
      passwordChangedAt: null,
    });
    await expect(
      authService.refresh(login.refreshToken),
    ).resolves.toBeDefined();
  });

  it('allows only one of two concurrent resets to consume the token', async () => {
    const token = opaqueToken('concurrent-reset');
    await createToken(token);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/password/restablecer')
        .send({ token, password: newPassword }),
      request(app.getHttpServer())
        .post('/api/auth/password/restablecer')
        .send({ token, password: newPassword }),
    ]);

    expect(
      responses.map(({ status }) => status).sort((left, right) => left - right),
    ).toEqual([200, 400]);
    await expect(
      tokens.findOneByOrFail({ usuarioId: activeUser.id }),
    ).resolves.toMatchObject({ usedAt: expect.any(Date) });
  });

  it('rejects untrusted origins and tenant selectors', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/password/solicitar')
      .set('Origin', 'https://evil.example')
      .send({ email: activeUser.email })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/auth/password/solicitar')
      .send({ email: activeUser.email, schemaName: 'tenant_untrusted' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/password/restablecer')
      .send({
        token: opaqueToken('selector'),
        password: newPassword,
        empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      })
      .expect(400);
  });

  it('applies independent request and reset rate limits with Retry-After', async () => {
    let limitedRequest: request.Response | undefined;
    for (let attempt = 0; attempt < 101; attempt += 1) {
      const response = await requestRecovery(`rate-${attempt}@example.com`);
      if (response.status === 429) {
        limitedRequest = response;
        break;
      }
    }

    expect(limitedRequest?.status).toBe(429);
    expect(limitedRequest?.headers['retry-after']).toBeDefined();
    expect(JSON.stringify(limitedRequest?.body)).not.toMatch(
      /email|token|password|schemaName/i,
    );

    let limitedReset: request.Response | undefined;
    for (let attempt = 0; attempt < 101; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/password/restablecer')
        .send({
          token: opaqueToken(`rate-reset-${attempt}`),
          password: newPassword,
        });
      if (response.status === 429) {
        limitedReset = response;
        break;
      }
    }
    expect(limitedReset?.status).toBe(429);
    expect(limitedReset?.headers['retry-after']).toBeDefined();
  });

  function requestRecovery(email: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/password/solicitar')
      .send({ email });
  }

  function createToken(
    token: string,
    overrides: Partial<PasswordResetToken> = {},
  ): Promise<PasswordResetToken> {
    return tokens.save(
      tokens.create({
        usuarioId: activeUser.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
        usedAt: null,
        revokedAt: null,
        ...overrides,
      }),
    );
  }

  function userWithPassword(): Promise<Usuario> {
    return users
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.id = :id', { id: activeUser.id })
      .getOneOrFail();
  }
});

function opaqueToken(seed: string): string {
  return createHash('sha256').update(seed).digest('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function extractUrl(message: TransportMailMessage): URL {
  const match = message.text.match(/https?:\/\/[^\s]+/);
  if (!match) {
    throw new Error('Expected internal recovery URL');
  }
  return new URL(match[0]);
}

function extractToken(message: TransportMailMessage): string {
  const token = extractUrl(message).hash.match(
    /^#token=([A-Za-z0-9_-]+)$/,
  )?.[1];
  if (!token) {
    throw new Error('Expected opaque recovery token');
  }
  return token;
}

function restoreEnvironment(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
