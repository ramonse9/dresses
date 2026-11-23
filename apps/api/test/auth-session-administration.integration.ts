import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { AuthSessionsService } from '../src/auth/auth-sessions.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthSession } from '../src/auth/entities/auth-session.entity.js';
import { PasswordHashService } from '../src/auth/password-hash.service.js';
import { AUTH_REFRESH_COOKIE_NAME } from '../src/auth/refresh-token-cookie.service.js';
import type { AccessTokenPayload } from '../src/auth/types/access-token-payload.js';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';

describe('PostgreSQL auth session administration', () => {
  let moduleRef: TestingModule;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let users: Repository<Usuario>;
  let sessions: Repository<AuthSession>;
  let authService: AuthService;
  let authSessionsService: AuthSessionsService;
  let jwtService: JwtService;
  let owner: Usuario;
  let otherUser: Usuario;

  const password = 'session-administration-password';
  const suffix = `${process.pid}-${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleRef.get(DataSource);
    users = dataSource.getRepository(Usuario);
    sessions = dataSource.getRepository(AuthSession);
    authService = moduleRef.get(AuthService);
    authSessionsService = moduleRef.get(AuthSessionsService);
    jwtService = moduleRef.get(JwtService);
    const passwordHashService = moduleRef.get(PasswordHashService);
    const passwordHash = await passwordHashService.hashPassword(password);

    [owner, otherUser] = await users.save([
      users.create({
        email: `sessions-owner-${suffix}@example.com`,
        passwordHash,
        nombre: 'Sessions Owner',
        activo: true,
        passwordChangedAt: null,
      }),
      users.create({
        email: `sessions-other-${suffix}@example.com`,
        passwordHash,
        nombre: 'Sessions Other',
        activo: true,
        passwordChangedAt: null,
      }),
    ]);
  });

  beforeEach(async () => {
    await sessions.delete({ usuarioId: owner.id });
    await sessions.delete({ usuarioId: otherUser.id });
    await users.update([owner.id, otherUser.id], { activo: true });
    owner.activo = true;
    otherUser.activo = true;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await sessions.delete({ usuarioId: owner.id });
      await sessions.delete({ usuarioId: otherUser.id });
      await users.delete([owner.id, otherUser.id]);
    }
    await app?.close();
    await moduleRef?.close();
  });

  it('lists safe active and revoked sessions in stable order and marks the current one', async () => {
    const older = await login(owner, 'Older Browser');
    const current = await login(owner, 'Current Browser');
    await sessions.update(older.payload.sessionId, {
      lastSeenAt: new Date('2026-11-20T12:00:00.000Z'),
    });
    await sessions.update(current.payload.sessionId, {
      lastSeenAt: new Date('2026-11-21T12:00:00.000Z'),
    });
    await authSessionsService.revokeOwned(
      older.payload.sessionId,
      owner.id,
      owner.id,
    );

    const active = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(200);
    expect(active.body).toHaveLength(1);
    expect(active.body[0]).toMatchObject({
      id: current.payload.sessionId,
      current: true,
      userAgent: 'Current Browser',
      revokedAt: null,
    });

    const revoked = await request(app.getHttpServer())
      .get('/api/auth/sessions?revoked=true&limit=10')
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(200);
    expect(revoked.body).toHaveLength(1);
    expect(revoked.body[0]).toMatchObject({
      id: older.payload.sessionId,
      current: false,
      userAgent: 'Older Browser',
    });
    expect(revoked.body[0]).not.toHaveProperty('revokedByUsuarioId');
    expect(JSON.stringify([...active.body, ...revoked.body])).not.toMatch(
      /refreshTokenHash|revokedByUsuarioId|schemaName|tenant_/,
    );

    await request(app.getHttpServer())
      .get('/api/auth/sessions?empresaId=untrusted')
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(400);
  });

  it('returns 404 for another user session and revokes an owned session idempotently under concurrency', async () => {
    const current = await login(owner, 'Current Browser');
    const target = await login(owner, 'Remote Browser');
    const foreign = await login(otherUser, 'Foreign Browser');

    await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${foreign.payload.sessionId}`)
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(404);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .delete(`/api/auth/sessions/${target.payload.sessionId}`)
        .set('Authorization', `Bearer ${current.accessToken}`),
      request(app.getHttpServer())
        .delete(`/api/auth/sessions/${target.payload.sessionId}`)
        .set('Authorization', `Bearer ${current.accessToken}`),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([204, 204]);

    await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${target.payload.sessionId}`)
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(204);
    await expect(
      sessions.findOneByOrFail({ id: target.payload.sessionId }),
    ).resolves.toMatchObject({
      revokedAt: expect.any(Date),
      revokedByUsuarioId: owner.id,
    });
    await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(200);
  });

  it('revokes the current session, clears its cookie and invalidates its access token', async () => {
    const current = await login(owner, 'Current Browser');
    const response = await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${current.payload.sessionId}`)
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(204);

    const cookie = response.headers['set-cookie']?.[0];
    expect(cookie).toContain(`${AUTH_REFRESH_COOKIE_NAME}=`);
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(401);
  });

  it('revokes every other session exactly once while preserving the current one', async () => {
    const current = await login(owner, 'Current Browser');
    await login(owner, 'Remote Browser 1');
    await login(owner, 'Remote Browser 2');
    await login(owner, 'Remote Browser 3');

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/sessions/revocar-otras')
        .set('Authorization', `Bearer ${current.accessToken}`)
        .send({}),
      request(app.getHttpServer())
        .post('/api/auth/sessions/revocar-otras')
        .set('Authorization', `Bearer ${current.accessToken}`)
        .send({}),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(
      responses.reduce(
        (total, response) => total + Number(response.body.revokedCount),
        0,
      ),
    ).toBe(3);
    expect(
      await sessions.countBy({ usuarioId: owner.id, revokedAt: IsNull() }),
    ).toBe(1);
    expect(
      await sessions.countBy({
        usuarioId: owner.id,
        id: Not(current.payload.sessionId),
        revokedByUsuarioId: owner.id,
      }),
    ).toBe(3);
    await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(200);
  });

  it('rejects session administration immediately for an inactive user', async () => {
    const current = await login(owner, 'Current Browser');
    await users.update(owner.id, { activo: false });
    owner.activo = false;

    await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${current.accessToken}`)
      .expect(401);
  });

  async function login(usuario: Usuario, userAgent: string) {
    const result = await authService.login(
      { email: usuario.email, password },
      { ipAddress: '203.0.113.10', userAgent },
    );
    return {
      accessToken: result.accessToken,
      payload: await jwtService.verifyAsync<AccessTokenPayload>(
        result.accessToken,
      ),
    };
  }
});
