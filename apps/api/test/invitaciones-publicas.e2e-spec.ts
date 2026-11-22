import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AuthOriginGuard } from '../src/auth/auth-origin.guard.js';
import { EmpresaUsuarioRol } from '../src/usuarios/entities/empresa-usuario.entity.js';
import { InvitacionesAceptacionService } from '../src/invitaciones/invitaciones-aceptacion.service.js';
import { InvitacionesPublicasController } from '../src/invitaciones/invitaciones-publicas.controller.js';
import { createAuthRateLimitOptions } from '../src/security/auth-rate-limit/auth-rate-limit.config.js';
import { AuthRateLimitGuard } from '../src/security/auth-rate-limit/auth-rate-limit.guard.js';

describe('public invitation endpoints (e2e)', () => {
  let app: INestApplication<App>;
  const token = 'A'.repeat(43);
  const service = {
    verify: vi.fn().mockResolvedValue({
      empresaNombre: 'Atelier Norte',
      email: 'p***@example.com',
      rol: EmpresaUsuarioRol.EMPLOYEE,
      expiresAt: new Date('2026-12-01T12:00:00.000Z'),
      accountExists: false,
    }),
    accept: vi.fn().mockResolvedValue({
      accepted: true,
      message: 'Invitación aceptada. Ya puedes iniciar sesión.',
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot(
          createAuthRateLimitOptions((key) =>
            key.endsWith('_LIMIT') ? '1' : '60',
          ),
        ),
      ],
      controllers: [InvitacionesPublicasController],
      providers: [
        AuthOriginGuard,
        AuthRateLimitGuard,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            CORS_ALLOWED_ORIGINS: 'http://localhost:4200',
          }),
        },
        { provide: InvitacionesAceptacionService, useValue: service },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => app.close());

  it('returns only the safe verification contract and accepts a valid Origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/invitaciones/verificar')
      .set('Origin', 'http://localhost:4200')
      .send({ token })
      .expect(200);

    expect(response.body).toEqual({
      empresaNombre: 'Atelier Norte',
      email: 'p***@example.com',
      rol: 'EMPLOYEE',
      expiresAt: '2026-12-01T12:00:00.000Z',
      accountExists: false,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /empresaId|usuarioId|token|passwordHash|schemaName|tenant_/,
    );
  });

  it('rejects an unauthorized Origin and unknown fields', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/verificar')
      .set('Origin', 'https://evil.example')
      .send({ token })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token, password: 'secure-password', rol: 'OWNER' })
      .expect(400);
    expect(service.accept).not.toHaveBeenCalled();
  });

  it('applies independent verification and acceptance rate limits', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/verificar')
      .send({ token })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/verificar')
      .send({ token })
      .expect(429)
      .expect('Retry-After', /\d+/);

    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token, nombre: 'Ana', password: 'secure-password' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/invitaciones/aceptar')
      .send({ token, nombre: 'Ana', password: 'secure-password' })
      .expect(429)
      .expect('Retry-After', /\d+/);
  });
});
