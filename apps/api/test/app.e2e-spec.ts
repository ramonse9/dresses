import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppController } from './../src/app.controller.js';
import { AppService } from './../src/app.service.js';
import { AuthController } from './../src/auth/auth.controller.js';
import { AuthOriginGuard } from './../src/auth/auth-origin.guard.js';
import { AuthSessionsService } from './../src/auth/auth-sessions.service.js';
import { AuthService } from './../src/auth/auth.service.js';
import { CurrentTenant } from './../src/auth/current-tenant.decorator.js';
import { JwtAuthGuard } from './../src/auth/jwt-auth.guard.js';
import {
  AUTH_REFRESH_COOKIE_NAME,
  RefreshTokenCookieService,
} from './../src/auth/refresh-token-cookie.service.js';
import { TenantAuthGuard } from './../src/auth/tenant-auth.guard.js';
import { TenantAuthenticated } from './../src/auth/tenant-authenticated.decorator.js';
import { ClientesController } from './../src/clientes/clientes.controller.js';
import { ClientesService } from './../src/clientes/clientes.service.js';
import { createCorsOptions } from './../src/config/cors.config.js';
import { DatabaseHealthService } from './../src/database/database-health.service.js';
import { EquipoController } from './../src/equipo/equipo.controller.js';
import { EquipoService } from './../src/equipo/equipo.service.js';
import { DevTenantAdminGuard } from './../src/empresas/dev-tenant-admin.guard.js';
import { EmpresasController } from './../src/empresas/empresas.controller.js';
import { EmpresasService } from './../src/empresas/empresas.service.js';
import { EmpresaInvitacionEstado } from './../src/invitaciones/entities/empresa-invitacion.entity.js';
import { InvitacionesController } from './../src/invitaciones/invitaciones.controller.js';
import { InvitacionesService } from './../src/invitaciones/invitaciones.service.js';
import { ReservacionEstado } from './../src/reservaciones/entities/reservacion.tenant-entity.js';
import { ReservacionesController } from './../src/reservaciones/reservaciones.controller.js';
import { ReservacionesService } from './../src/reservaciones/reservaciones.service.js';
import { createAuthRateLimitOptions } from './../src/security/auth-rate-limit/auth-rate-limit.config.js';
import { AuthRateLimitGuard } from './../src/security/auth-rate-limit/auth-rate-limit.guard.js';
import { SucursalesController } from './../src/sucursales/sucursales.controller.js';
import { SucursalesService } from './../src/sucursales/sucursales.service.js';
import type { TenantScope } from './../src/tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from './../src/usuarios/entities/empresa-usuario.entity.js';
import { VestidoEstadoOperativo } from './../src/vestidos/entities/vestido.tenant-entity.js';
import { VestidosController } from './../src/vestidos/vestidos.controller.js';
import { VestidosService } from './../src/vestidos/vestidos.service.js';

@Controller('_test/tenant')
class TenantProbeController {
  @Get()
  @TenantAuthenticated()
  probe(@CurrentTenant() tenant: TenantScope) {
    return {
      empresaId: tenant.empresaId,
      empresaSlug: tenant.empresaSlug,
    };
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const refreshToken = 'A'.repeat(43);
  const rotatedRefreshToken = 'B'.repeat(43);
  const selectedEmpresaId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
  const sucursalId = 'd18c2a56-d33f-4d88-a8e7-42931121e295';
  const vestidoId = 'e18c2a56-d33f-4d88-a8e7-42931121e295';
  const clienteId = 'f18c2a56-d33f-4d88-a8e7-42931121e295';
  const reservacionId = '918c2a56-d33f-4d88-a8e7-42931121e295';
  const miembroId = '818c2a56-d33f-4d88-a8e7-42931121e295';
  const invitationId = '718c2a56-d33f-4d88-a8e7-42931121e295';
  const authenticatedUserId = '019a6f33-82b7-7a22-971b-6a8d7c5e4f30';
  const miembroResponse = {
    id: miembroId,
    usuario: {
      id: authenticatedUserId,
      nombre: 'Owner',
      email: 'owner@example.com',
      activo: true,
    },
    rol: EmpresaUsuarioRol.OWNER,
    activo: true,
    createdAt: new Date('2026-11-20T12:00:00.000Z'),
  };
  const invitationResponse = {
    id: invitationId,
    empresaId: selectedEmpresaId,
    email: 'invited@example.com',
    rol: EmpresaUsuarioRol.EMPLOYEE,
    estado: EmpresaInvitacionEstado.PENDIENTE,
    expiresAt: new Date('2026-12-01T12:00:00.000Z'),
    acceptedAt: null,
    acceptedByUsuarioId: null,
    revokedAt: null,
    createdByUsuarioId: authenticatedUserId,
    lastSentAt: new Date('2026-11-22T12:00:00.000Z'),
    sendCount: 1,
    createdAt: new Date('2026-11-22T12:00:00.000Z'),
    updatedAt: new Date('2026-11-22T12:00:00.000Z'),
  };
  const clienteResponse = {
    id: clienteId,
    nombre: 'Ana López',
    telefono: null,
    email: 'ana@example.com',
    direccion: null,
    notas: null,
    activo: true,
  };
  const vestidoCreateResponse = {
    id: vestidoId,
    sucursalId,
    codigo: 'V-001',
    nombre: 'Vestido Azul',
    descripcion: null,
    talla: 'M',
    color: 'Azul',
    marca: null,
    precioRenta: '1250.50',
    deposito: null,
    estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    activo: true,
  };
  const vestidoResponse = {
    ...vestidoCreateResponse,
    createdAt: new Date('2026-11-14T12:00:00.000Z'),
    updatedAt: new Date('2026-11-14T12:00:00.000Z'),
    sucursal: { id: sucursalId, nombre: 'Centro', activo: true },
  };
  const vestidoUpdateResponse = {
    ...vestidoCreateResponse,
    codigo: 'V-002',
    nombre: 'Vestido Rojo',
    activo: true,
  };
  const reservacionResponse = {
    id: reservacionId,
    cliente: {
      id: clienteId,
      nombre: 'Ana López',
      telefono: null,
      email: 'ana@example.com',
    },
    sucursal: { id: sucursalId, nombre: 'Centro' },
    vestidos: [
      {
        id: vestidoId,
        codigo: 'V-001',
        nombre: 'Vestido Azul',
        talla: 'M',
        color: 'Azul',
        precioRenta: '1250.50',
        deposito: '0.00',
      },
    ],
    fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
    fechaFin: new Date('2026-12-12T23:00:00.000Z'),
    estado: ReservacionEstado.CONFIRMADA,
    notas: null,
    importeRenta: '1250.50',
    depositoRequerido: '0.00',
    confirmadaAt: new Date('2026-11-17T20:00:00.000Z'),
    entregadaAt: null,
    devueltaAt: null,
    canceladaAt: null,
    motivoCancelacion: null,
    createdAt: new Date('2026-11-17T20:00:00.000Z'),
    updatedAt: new Date('2026-11-17T20:00:00.000Z'),
  };

  const authenticatedUser = {
    sub: authenticatedUserId,
    email: 'owner@example.com',
    sessionId: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
  };
  const otherSessionId = '57ecf96a-8f2c-4e07-bd1f-93936f2cdb91';
  const sessionResponse = {
    id: authenticatedUser.sessionId,
    current: true,
    createdAt: new Date('2026-11-20T12:00:00.000Z'),
    lastSeenAt: new Date('2026-11-23T12:00:00.000Z'),
    expiresAt: new Date('2026-12-20T12:00:00.000Z'),
    revokedAt: null,
    ipAddress: '203.0.113.10',
    userAgent: 'Browser/1.0',
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(createAuthRateLimitOptions())],
      controllers: [
        AppController,
        AuthController,
        ClientesController,
        EquipoController,
        EmpresasController,
        InvitacionesController,
        ReservacionesController,
        SucursalesController,
        VestidosController,
        TenantProbeController,
      ],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            AUTH_REFRESH_TTL_SECONDS: '2592000',
            CORS_ALLOWED_ORIGINS: 'http://localhost:4200,http://127.0.0.1:4200',
            NODE_ENV: 'development',
          }),
        },
        AuthOriginGuard,
        AuthRateLimitGuard,
        RefreshTokenCookieService,
        {
          provide: AuthSessionsService,
          useValue: {
            findOwned: vi.fn().mockResolvedValue([sessionResponse]),
            revokeOwned: vi.fn().mockResolvedValue(undefined),
            revokeOthers: vi.fn().mockResolvedValue(2),
          },
        },
        {
          provide: AuthService,
          useValue: {
            login: vi.fn().mockResolvedValue({
              accessToken: 'signed.jwt.token',
              refreshToken,
              tokenType: 'Bearer',
              expiresIn: 900,
            }),
            refresh: vi.fn().mockResolvedValue({
              accessToken: 'rotated.jwt.token',
              refreshToken: rotatedRefreshToken,
              tokenType: 'Bearer',
              expiresIn: 900,
            }),
            logout: vi.fn().mockResolvedValue(undefined),
            listEmpresas: vi.fn().mockResolvedValue([
              {
                id: selectedEmpresaId,
                nombre: 'Atelier Norte',
                slug: 'atelier-norte',
                rol: 'OWNER',
              },
            ]),
            selectEmpresa: vi.fn().mockResolvedValue({
              accessToken: 'selected.jwt.token',
              tokenType: 'Bearer',
              expiresIn: 900,
            }),
            getProfile: vi.fn().mockReturnValue(authenticatedUser),
          },
        },
        {
          provide: ClientesService,
          useValue: {
            create: vi.fn().mockResolvedValue(clienteResponse),
            findAll: vi.fn().mockResolvedValue({
              data: [clienteResponse],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
            }),
            findOne: vi.fn().mockResolvedValue(clienteResponse),
            update: vi.fn().mockResolvedValue({
              ...clienteResponse,
              telefono: '555-0100',
            }),
            updateEstado: vi.fn().mockResolvedValue({
              ...clienteResponse,
              activo: false,
            }),
            deactivate: vi.fn().mockResolvedValue({
              ...clienteResponse,
              activo: false,
            }),
          },
        },
        {
          provide: DatabaseHealthService,
          useValue: {
            checkConnection: vi.fn().mockResolvedValue({ status: 'up' }),
          },
        },
        {
          provide: EmpresasService,
          useValue: {
            create: vi.fn().mockResolvedValue({
              id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
              nombre: 'Atelier Norte',
              slug: 'atelier-norte',
              schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
              activo: true,
            }),
          },
        },
        {
          provide: EquipoService,
          useValue: {
            findAll: vi.fn().mockResolvedValue({
              data: [miembroResponse],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
            }),
            findOne: vi.fn().mockResolvedValue(miembroResponse),
            updateRol: vi.fn().mockResolvedValue({
              ...miembroResponse,
              rol: EmpresaUsuarioRol.EMPLOYEE,
            }),
            updateEstado: vi.fn().mockResolvedValue({
              ...miembroResponse,
              activo: false,
            }),
          },
        },
        {
          provide: InvitacionesService,
          useValue: {
            create: vi.fn().mockResolvedValue(invitationResponse),
            findAll: vi.fn().mockResolvedValue({
              data: [invitationResponse],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
            }),
            resend: vi.fn().mockResolvedValue({
              ...invitationResponse,
              expiresAt: new Date('2026-12-08T12:00:00.000Z'),
              sendCount: 2,
            }),
            revoke: vi.fn().mockResolvedValue({
              ...invitationResponse,
              estado: EmpresaInvitacionEstado.REVOCADA,
              revokedAt: new Date('2026-11-22T13:00:00.000Z'),
            }),
          },
        },
        {
          provide: ReservacionesService,
          useValue: {
            create: vi.fn().mockResolvedValue(reservacionResponse),
            findAll: vi.fn().mockResolvedValue({
              data: [
                {
                  ...reservacionResponse,
                  vestidos: undefined,
                  vestidosCount: 1,
                },
              ],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
            }),
            findOne: vi.fn().mockResolvedValue(reservacionResponse),
            findFinances: vi.fn().mockResolvedValue({
              importeRenta: '1250.50',
              rentaCobrada: '1000.00',
              rentaReembolsada: '0.00',
              rentaPagadaNeta: '1000.00',
              saldoRenta: '250.50',
              depositoRequerido: '0.00',
              depositoRecibido: '0.00',
              depositoDevuelto: '0.00',
              depositoRetenido: '0.00',
              depositoPendienteCobro: '0.00',
              depositoPorDevolver: '0.00',
            }),
            findFinancialMovements: vi.fn().mockResolvedValue({
              data: [
                {
                  id: '611c2a56-d33f-4d88-a8e7-42931121e295',
                  tipo: 'PAGO_RENTA',
                  monto: '1000.00',
                  metodoPago: 'TARJETA',
                  referencia: 'TERMINAL-1',
                  notas: null,
                  movimientoOrigen: null,
                  actor: {
                    id: authenticatedUserId,
                    nombre: 'Owner',
                    email: 'owner@example.com',
                    activo: true,
                  },
                  createdAt: new Date('2026-11-20T12:00:00.000Z'),
                },
              ],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
            }),
            update: vi.fn().mockResolvedValue({
              ...reservacionResponse,
              notas: 'Actualizada',
            }),
            confirm: vi.fn().mockResolvedValue(reservacionResponse),
            deliver: vi.fn().mockResolvedValue({
              ...reservacionResponse,
              estado: ReservacionEstado.ENTREGADA,
              entregadaAt: new Date('2026-11-18T20:00:00.000Z'),
            }),
            returnReservation: vi.fn().mockResolvedValue({
              ...reservacionResponse,
              estado: ReservacionEstado.DEVUELTA,
              entregadaAt: new Date('2026-11-18T20:00:00.000Z'),
              devueltaAt: new Date('2026-11-19T20:00:00.000Z'),
            }),
            cancel: vi.fn().mockResolvedValue({
              ...reservacionResponse,
              estado: ReservacionEstado.CANCELADA,
              canceladaAt: new Date('2026-11-18T20:00:00.000Z'),
              motivoCancelacion: 'Cambio de planes',
            }),
          },
        },
        {
          provide: SucursalesService,
          useValue: {
            create: vi.fn().mockResolvedValue({
              id: sucursalId,
              nombre: 'Centro',
              direccion: null,
              telefono: null,
              activo: true,
            }),
            findAll: vi.fn().mockResolvedValue([
              {
                id: sucursalId,
                nombre: 'Centro',
                direccion: null,
                telefono: null,
                activo: true,
              },
            ]),
            findOne: vi.fn().mockResolvedValue({
              id: sucursalId,
              nombre: 'Centro',
              direccion: null,
              telefono: null,
              activo: true,
            }),
            update: vi.fn().mockResolvedValue({
              id: sucursalId,
              nombre: 'Centro Histórico',
              direccion: null,
              telefono: null,
              activo: true,
            }),
            deactivate: vi.fn().mockResolvedValue({
              id: sucursalId,
              nombre: 'Centro',
              direccion: null,
              telefono: null,
              activo: false,
            }),
          },
        },
        {
          provide: VestidosService,
          useValue: {
            create: vi.fn().mockResolvedValue(vestidoCreateResponse),
            findAll: vi.fn().mockResolvedValue({
              data: [vestidoResponse],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
            }),
            findOne: vi.fn().mockResolvedValue(vestidoResponse),
            findAvailability: vi.fn().mockResolvedValue({
              data: [vestidoResponse],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
              range: {
                fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
                fechaFin: new Date('2026-12-12T23:00:00.000Z'),
              },
            }),
            update: vi.fn().mockResolvedValue(vestidoUpdateResponse),
            deactivate: vi.fn().mockResolvedValue({
              ...vestidoUpdateResponse,
              activo: false,
            }),
          },
        },
      ],
    })
      .overrideGuard(DevTenantAdminGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const authenticatedRequest = context.switchToHttp().getRequest();

          if (!authenticatedRequest.headers.authorization) {
            throw new UnauthorizedException('Token inválido');
          }

          authenticatedRequest.user = authenticatedUser;
          return true;
        },
      })
      .overrideGuard(TenantAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const tenantRequest = context.switchToHttp().getRequest();

          if (tenantRequest.user !== authenticatedUser) {
            throw new Error('JwtAuthGuard did not run first');
          }

          tenantRequest.tenantScope = {
            empresaId: selectedEmpresaId,
            empresaSlug: 'atelier-norte',
            schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295',
          };
          tenantRequest.tenantMembership = {
            usuarioId: authenticatedUser.sub,
            empresaId: selectedEmpresaId,
            rol:
              tenantRequest.headers.authorization ===
              'Bearer employee.jwt.token'
                ? EmpresaUsuarioRol.EMPLOYEE
                : EmpresaUsuarioRol.OWNER,
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableCors(createCorsOptions(moduleFixture.get(ConfigService)));
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'dresses-api',
        database: { status: 'up' },
      });
  });

  it('/api/auth/login (POST) stores bounded request metadata and sets the HttpOnly cookie', async () => {
    const authService = app.get(AuthService) as AuthService & {
      login: ReturnType<typeof vi.fn>;
    };
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('User-Agent', 'Metadata Browser/1.0')
      .set('X-Forwarded-For', '203.0.113.10')
      .set('Cookie', 'unrelated_cookie=must-not-be-stored')
      .send({ email: 'Owner@Example.COM', password: 'correct-password' })
      .expect(201)
      .expect({
        accessToken: 'signed.jwt.token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });

    const cookie = response.headers['set-cookie']?.[0];
    expect(cookie).toContain(`${AUTH_REFRESH_COOKIE_NAME}=${refreshToken}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/auth');
    expect(cookie).toContain('Max-Age=2592000');
    expect(cookie).not.toContain('Secure');
    expect(response.body).not.toHaveProperty('refreshToken');

    const metadata = authService.login.mock.calls[0]?.[1];
    expect(metadata).toEqual({
      ipAddress: expect.any(String),
      userAgent: 'Metadata Browser/1.0',
    });
    expect(metadata.ipAddress).not.toBe('203.0.113.10');
    expect(metadata).not.toHaveProperty('cookie');
    expect(metadata).not.toHaveProperty('authorization');
  });

  it('uses forwarded IP only when trust proxy is explicitly enabled and bounds user-agent', async () => {
    const expressApplication = app.getHttpAdapter().getInstance() as {
      set(name: string, value: boolean): void;
    };
    expressApplication.set('trust proxy', true);
    const authService = app.get(AuthService) as AuthService & {
      login: ReturnType<typeof vi.fn>;
    };

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.20')
      .set('User-Agent', 'x'.repeat(600))
      .send({ email: 'Owner@Example.COM', password: 'correct-password' })
      .expect(201);

    expect(authService.login.mock.calls[0]?.[1]).toEqual({
      ipAddress: '203.0.113.20',
      userAgent: 'x'.repeat(512),
    });
  });

  it('/api/auth/login (POST) applies its rate limit without blocking refresh', async () => {
    const credentials = {
      email: 'owner@example.com',
      password: 'rate-limit-secret-password',
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(credentials)
        .expect(201);
    }

    const limited = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(credentials)
      .expect(429);

    expect(limited.headers['retry-after']).toMatch(/^\d+$/);
    expect(limited.body).toEqual({
      statusCode: 429,
      message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
    });
    expect(JSON.stringify(limited.body)).not.toContain(credentials.password);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${AUTH_REFRESH_COOKIE_NAME}=${refreshToken}`)
      .expect(200);
  });

  it('/api/auth/refresh (POST) rotates the cookie, updates metadata and returns only an access token', async () => {
    const authService = app.get(AuthService) as AuthService & {
      refresh: ReturnType<typeof vi.fn>;
    };
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${AUTH_REFRESH_COOKIE_NAME}=${refreshToken}`)
      .set('User-Agent', 'Refresh Browser/2.0')
      .expect(200)
      .expect({
        accessToken: 'rotated.jwt.token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });

    expect(response.headers['set-cookie']?.[0]).toContain(
      `${AUTH_REFRESH_COOKIE_NAME}=${rotatedRefreshToken}`,
    );
    expect(response.body).not.toHaveProperty('refreshToken');
    expect(authService.refresh).toHaveBeenCalledWith(refreshToken, {
      ipAddress: expect.any(String),
      userAgent: 'Refresh Browser/2.0',
    });
  });

  it('/api/auth/refresh (POST) rejects missing cookies and body tokens', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `${AUTH_REFRESH_COOKIE_NAME}=${refreshToken}`)
      .send({ refreshToken })
      .expect(400);
  });

  it('/api/auth/logout (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer signed.jwt.token')
      .set('Cookie', `${AUTH_REFRESH_COOKIE_NAME}=${rotatedRefreshToken}`)
      .expect(204)
      .expect((response) => {
        const cookie = response.headers['set-cookie']?.[0];
        expect(cookie).toContain(`${AUTH_REFRESH_COOKIE_NAME}=`);
        expect(cookie).toContain('Path=/api/auth');
        expect(cookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      });
  });

  it('/api/auth/sessions (GET) returns only the safe global session projection', async () => {
    const sessionsService = app.get(AuthSessionsService) as unknown as {
      findOwned: ReturnType<typeof vi.fn>;
    };
    const response = await request(app.getHttpServer())
      .get('/api/auth/sessions?revoked=false&limit=25')
      .set('Authorization', 'Bearer signed.jwt.token')
      .expect(200);

    expect(response.body).toEqual([
      {
        ...sessionResponse,
        createdAt: sessionResponse.createdAt.toISOString(),
        lastSeenAt: sessionResponse.lastSeenAt.toISOString(),
        expiresAt: sessionResponse.expiresAt.toISOString(),
      },
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(
      /refreshTokenHash|schemaName|tenant_/,
    );
    expect(sessionsService.findOwned).toHaveBeenCalledWith(
      authenticatedUser.sub,
      authenticatedUser.sessionId,
      { revoked: false, limit: 25 },
    );
  });

  it('/api/auth/sessions rejects tenant selectors', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/sessions?schemaName=tenant_untrusted')
      .set('Authorization', 'Bearer signed.jwt.token')
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/auth/sessions/revocar-otras?empresaId=untrusted')
      .set('Authorization', 'Bearer signed.jwt.token')
      .send({})
      .expect(400);
  });

  it('/api/auth/sessions/:id (DELETE) revokes an owned remote session', async () => {
    const sessionsService = app.get(AuthSessionsService) as unknown as {
      revokeOwned: ReturnType<typeof vi.fn>;
    };
    await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${otherSessionId}`)
      .set('Authorization', 'Bearer signed.jwt.token')
      .expect(204);

    expect(sessionsService.revokeOwned).toHaveBeenCalledWith(
      otherSessionId,
      authenticatedUser.sub,
      authenticatedUser.sub,
      authenticatedUser.sessionId,
    );
  });

  it('/api/auth/sessions/:id (DELETE) clears the cookie for the current session', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${authenticatedUser.sessionId}`)
      .set('Authorization', 'Bearer signed.jwt.token')
      .expect(204);

    expect(response.headers['set-cookie']?.[0]).toContain(
      `${AUTH_REFRESH_COOKIE_NAME}=`,
    );
    expect(response.headers['set-cookie']?.[0]).toContain(
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
  });

  it('/api/auth/sessions/revocar-otras (POST) preserves the current session', async () => {
    const sessionsService = app.get(AuthSessionsService) as unknown as {
      revokeOthers: ReturnType<typeof vi.fn>;
    };
    await request(app.getHttpServer())
      .post('/api/auth/sessions/revocar-otras')
      .set('Authorization', 'Bearer signed.jwt.token')
      .send({})
      .expect(200)
      .expect({ revokedCount: 2 });

    expect(sessionsService.revokeOthers).toHaveBeenCalledWith(
      authenticatedUser.sub,
      authenticatedUser.sessionId,
    );
  });

  it('allows configured and absent Origins but rejects untrusted auth Origins', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:4200')
      .send({ email: 'Owner@Example.COM', password: 'correct-password' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'Owner@Example.COM', password: 'correct-password' })
      .expect(403);
  });

  it('configures credentialed CORS with an explicit origin', () => {
    return request(app.getHttpServer())
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'http://localhost:4200')
      .expect('Access-Control-Allow-Credentials', 'true');
  });

  it('/api/auth/empresas (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/auth/empresas')
      .set('Authorization', 'Bearer signed.jwt.token')
      .expect(200)
      .expect([
        {
          id: selectedEmpresaId,
          nombre: 'Atelier Norte',
          slug: 'atelier-norte',
          rol: 'OWNER',
        },
      ]);
  });

  it('/api/auth/select-empresa (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/select-empresa')
      .set('Authorization', 'Bearer signed.jwt.token')
      .send({ empresaId: selectedEmpresaId })
      .expect(200)
      .expect({
        accessToken: 'selected.jwt.token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });
  });

  it('/api/auth/me (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer signed.jwt.token')
      .expect(200)
      .expect(authenticatedUser);
  });

  it('runs JwtAuthGuard before TenantAuthGuard and exposes TenantScope', () => {
    return request(app.getHttpServer())
      .get('/api/_test/tenant')
      .set('Authorization', 'Bearer selected.jwt.token')
      .set('x-empresa-id', 'b28c2a56-d33f-4d88-a8e7-42931121e295')
      .set('x-schema-name', 'tenant_untrusted')
      .expect(200)
      .expect({
        empresaId: selectedEmpresaId,
        empresaSlug: 'atelier-norte',
      });
  });

  it('/api/empresas (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/empresas')
      .send({ nombre: 'Atelier Norte', slug: 'Atelier-Norte' })
      .expect(201)
      .expect({
        id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
        nombre: 'Atelier Norte',
        slug: 'atelier-norte',
        schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
        activo: true,
      });
  });

  it('/api/sucursales (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/sucursales')
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ nombre: 'Centro' })
      .expect(201)
      .expect({
        id: sucursalId,
        nombre: 'Centro',
        direccion: null,
        telefono: null,
        activo: true,
      });
  });

  it('/api/sucursales (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(200)
      .expect([
        {
          id: sucursalId,
          nombre: 'Centro',
          direccion: null,
          telefono: null,
          activo: true,
        },
      ]);
  });

  it('/api/sucursales/:id (GET)', () => {
    return request(app.getHttpServer())
      .get(`/api/sucursales/${sucursalId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(200)
      .expect({
        id: sucursalId,
        nombre: 'Centro',
        direccion: null,
        telefono: null,
        activo: true,
      });
  });

  it('/api/sucursales/:id (PATCH)', () => {
    return request(app.getHttpServer())
      .patch(`/api/sucursales/${sucursalId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ nombre: 'Centro Histórico' })
      .expect(200)
      .expect({
        id: sucursalId,
        nombre: 'Centro Histórico',
        direccion: null,
        telefono: null,
        activo: true,
      });
  });

  it('/api/sucursales/:id (DELETE)', () => {
    return request(app.getHttpServer())
      .delete(`/api/sucursales/${sucursalId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(200)
      .expect({
        id: sucursalId,
        nombre: 'Centro',
        direccion: null,
        telefono: null,
        activo: false,
      });
  });

  it('allows EMPLOYEE to consult sucursales', () => {
    return request(app.getHttpServer())
      .get('/api/sucursales')
      .set('Authorization', 'Bearer employee.jwt.token')
      .expect(200);
  });

  it.each([
    ['post', '/api/sucursales'],
    ['patch', `/api/sucursales/${sucursalId}`],
    ['delete', `/api/sucursales/${sucursalId}`],
  ] as const)('returns 403 when EMPLOYEE uses %s %s', (method, path) => {
    const operation = request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer employee.jwt.token');

    if (method === 'post') {
      operation.send({ nombre: 'Centro' });
    } else if (method === 'patch') {
      operation.send({ nombre: 'Centro Histórico' });
    }

    return operation.expect(403);
  });

  it('/api/sucursales rejects requests without JWT', () => {
    return request(app.getHttpServer()).get('/api/sucursales').expect(401);
  });

  it('/api/equipo/miembros (GET) returns only the scoped safe projection for OWNER', () => {
    return request(app.getHttpServer())
      .get('/api/equipo/miembros?page=1&limit=20&rol=OWNER&activo=true&q=owner')
      .set('Authorization', 'Bearer selected.jwt.token')
      .set('x-empresa-id', 'b28c2a56-d33f-4d88-a8e7-42931121e295')
      .set('x-schema-name', 'tenant_untrusted')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          data: [
            {
              id: miembroId,
              usuario: {
                id: authenticatedUserId,
                nombre: 'Owner',
                email: 'owner@example.com',
                activo: true,
              },
              rol: EmpresaUsuarioRol.OWNER,
              activo: true,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          /passwordHash|refreshTokenHash|sessionId|schemaName|tenant_/,
        );
      });
  });

  it('/api/equipo/miembros/:id (GET) returns OWNER detail', () => {
    return request(app.getHttpServer())
      .get(`/api/equipo/miembros/${miembroId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: miembroId,
          usuario: { id: authenticatedUserId },
          rol: EmpresaUsuarioRol.OWNER,
        });
        expect(JSON.stringify(response.body)).not.toContain('schemaName');
      });
  });

  it.each(['/api/equipo/miembros', `/api/equipo/miembros/${miembroId}`])(
    'returns 403 when EMPLOYEE consults %s',
    (path) =>
      request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer employee.jwt.token')
        .expect(403),
  );

  it('/api/equipo/miembros rejects tenant selectors and missing JWT', async () => {
    for (const selector of [
      ['empresaId', selectedEmpresaId],
      ['empresaSlug', 'atelier-norte'],
      ['schemaName', 'tenant_untrusted'],
      ['usuarioId', authenticatedUserId],
    ]) {
      await request(app.getHttpServer())
        .get('/api/equipo/miembros')
        .query(Object.fromEntries([selector]))
        .set('Authorization', 'Bearer selected.jwt.token')
        .expect(400);
    }

    await request(app.getHttpServer()).get('/api/equipo/miembros').expect(401);
  });

  it('/api/equipo/miembros/:id/rol (PATCH) changes a membership role for OWNER', () => {
    return request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${miembroId}/rol`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ rol: EmpresaUsuarioRol.EMPLOYEE })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: miembroId,
          rol: EmpresaUsuarioRol.EMPLOYEE,
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          /passwordHash|refreshTokenHash|sessionId|schemaName|tenant_/,
        );
      });
  });

  it('/api/equipo/miembros/:id/estado (PATCH) changes membership state for OWNER', () => {
    return request(app.getHttpServer())
      .patch(`/api/equipo/miembros/${miembroId}/estado`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ activo: false })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ id: miembroId, activo: false });
      });
  });

  it.each(['rol', 'estado'])(
    'returns 403 when EMPLOYEE changes membership %s',
    (operation) =>
      request(app.getHttpServer())
        .patch(`/api/equipo/miembros/${miembroId}/${operation}`)
        .set('Authorization', 'Bearer employee.jwt.token')
        .send(
          operation === 'rol'
            ? { rol: EmpresaUsuarioRol.OWNER }
            : { activo: false },
        )
        .expect(403),
  );

  it('/api/equipo/miembros mutations reject empty, protected and tenant fields', async () => {
    for (const body of [
      {},
      { rol: 'ADMIN' },
      { rol: EmpresaUsuarioRol.OWNER, usuarioId: authenticatedUserId },
      { rol: EmpresaUsuarioRol.OWNER, empresaId: selectedEmpresaId },
      { rol: EmpresaUsuarioRol.OWNER, email: 'other@example.com' },
      { rol: EmpresaUsuarioRol.OWNER, nombre: 'Other' },
      { rol: EmpresaUsuarioRol.OWNER, password: 'secret' },
      { rol: EmpresaUsuarioRol.OWNER, schemaName: 'tenant_untrusted' },
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/equipo/miembros/${miembroId}/rol`)
        .set('Authorization', 'Bearer selected.jwt.token')
        .send(body)
        .expect(400);
    }

    for (const body of [
      {},
      { activo: 'false' },
      { activo: false, empresaSlug: 'untrusted' },
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/equipo/miembros/${miembroId}/estado`)
        .set('Authorization', 'Bearer selected.jwt.token')
        .send(body)
        .expect(400);
    }
  });

  it('/api/equipo/invitaciones (POST) creates a safe invitation for OWNER', () => {
    return request(app.getHttpServer())
      .post('/api/equipo/invitaciones')
      .set('Authorization', 'Bearer selected.jwt.token')
      .set('x-schema-name', 'tenant_untrusted')
      .send({ email: ' INVITED@EXAMPLE.COM ', rol: 'EMPLOYEE' })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: invitationId,
          email: 'invited@example.com',
          rol: EmpresaUsuarioRol.EMPLOYEE,
          estado: EmpresaInvitacionEstado.PENDIENTE,
          sendCount: 1,
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          /tokenHash|#token=|schemaName|tenant_/,
        );
      });
  });

  it('/api/equipo/invitaciones (GET) lists filtered invitations for OWNER', () => {
    return request(app.getHttpServer())
      .get(
        '/api/equipo/invitaciones?page=1&limit=20&estado=PENDIENTE&rol=EMPLOYEE&q=invited',
      )
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          data: [{ id: invitationId, email: 'invited@example.com' }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          /tokenHash|#token=|schemaName|tenant_/,
        );
      });
  });

  it('resends and logically revokes invitations for OWNER', async () => {
    await request(app.getHttpServer())
      .post(`/api/equipo/invitaciones/${invitationId}/reenviar`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({})
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: invitationId,
          sendCount: 2,
          estado: EmpresaInvitacionEstado.PENDIENTE,
        });
      });

    await request(app.getHttpServer())
      .delete(`/api/equipo/invitaciones/${invitationId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({})
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: invitationId,
          estado: EmpresaInvitacionEstado.REVOCADA,
        });
      });
  });

  it.each([
    ['post', '/api/equipo/invitaciones'],
    ['get', '/api/equipo/invitaciones'],
    ['post', `/api/equipo/invitaciones/${invitationId}/reenviar`],
    ['delete', `/api/equipo/invitaciones/${invitationId}`],
  ] as const)('returns 403 when EMPLOYEE uses %s %s', (method, path) => {
    const operation = request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer employee.jwt.token');
    if (method === 'post' && path === '/api/equipo/invitaciones') {
      operation.send({ email: 'invited@example.com', rol: 'EMPLOYEE' });
    } else if (method !== 'get') {
      operation.send({});
    }
    return operation.expect(403);
  });

  it('/api/equipo/invitaciones rejects tenant selectors and protected fields', async () => {
    for (const body of [
      {
        email: 'invited@example.com',
        rol: 'EMPLOYEE',
        empresaId: selectedEmpresaId,
      },
      {
        email: 'invited@example.com',
        rol: 'EMPLOYEE',
        empresaSlug: 'atelier-norte',
      },
      {
        email: 'invited@example.com',
        rol: 'EMPLOYEE',
        schemaName: 'tenant_untrusted',
      },
      {
        email: 'invited@example.com',
        rol: 'EMPLOYEE',
        tokenHash: 'a'.repeat(64),
      },
    ]) {
      await request(app.getHttpServer())
        .post('/api/equipo/invitaciones')
        .set('Authorization', 'Bearer selected.jwt.token')
        .send(body)
        .expect(400);
    }

    await request(app.getHttpServer())
      .get('/api/equipo/invitaciones?schemaName=tenant_untrusted')
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/equipo/invitaciones/${invitationId}/reenviar`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ empresaId: selectedEmpresaId })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/api/equipo/invitaciones/${invitationId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ schemaName: 'tenant_untrusted' })
      .expect(400);
  });

  it('/api/clientes (POST) allows OWNER and normalizes email', () => {
    return request(app.getHttpServer())
      .post('/api/clientes')
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ nombre: ' Ana López ', email: ' ANA@EXAMPLE.COM ' })
      .expect(201)
      .expect(clienteResponse);
  });

  it('/api/clientes (POST) allows EMPLOYEE', () => {
    return request(app.getHttpServer())
      .post('/api/clientes')
      .set('Authorization', 'Bearer employee.jwt.token')
      .send({ nombre: 'Ana López', telefono: '555-0100' })
      .expect(201);
  });

  it('/api/clientes (GET) returns the paginated list for OWNER', () => {
    return request(app.getHttpServer())
      .get('/api/clientes?page=1&limit=20&activo=true&q=ana')
      .set('Authorization', 'Bearer selected.jwt.token')
      .set('x-empresa-id', 'b28c2a56-d33f-4d88-a8e7-42931121e295')
      .set('x-schema-name', 'tenant_untrusted')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          data: [clienteResponse],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
        expect(JSON.stringify(response.body)).not.toContain('schemaName');
        expect(JSON.stringify(response.body)).not.toContain('tenant_');
      });
  });

  it('/api/clientes (GET) and detail allow EMPLOYEE', async () => {
    await request(app.getHttpServer())
      .get('/api/clientes')
      .set('Authorization', 'Bearer employee.jwt.token')
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/clientes/${clienteId}`)
      .set('Authorization', 'Bearer employee.jwt.token')
      .expect(200)
      .expect(clienteResponse);
  });

  it('/api/clientes/:id (PATCH) allows EMPLOYEE contact updates', () => {
    return request(app.getHttpServer())
      .patch(`/api/clientes/${clienteId}`)
      .set('Authorization', 'Bearer employee.jwt.token')
      .send({ telefono: ' 555-0100 ' })
      .expect(200)
      .expect({ ...clienteResponse, telefono: '555-0100' });
  });

  it('/api/clientes/:id/estado (PATCH) allows OWNER', () => {
    return request(app.getHttpServer())
      .patch(`/api/clientes/${clienteId}/estado`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ activo: false })
      .expect(200)
      .expect({ ...clienteResponse, activo: false });
  });

  it('/api/clientes/:id (DELETE) soft-deletes for OWNER', () => {
    return request(app.getHttpServer())
      .delete(`/api/clientes/${clienteId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(200)
      .expect({ ...clienteResponse, activo: false });
  });

  it.each([
    ['patch', `/api/clientes/${clienteId}/estado`],
    ['delete', `/api/clientes/${clienteId}`],
  ] as const)('returns 403 when EMPLOYEE uses %s %s', (method, path) => {
    const operation = request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer employee.jwt.token');

    if (method === 'patch') {
      operation.send({ activo: true });
    }

    return operation.expect(403);
  });

  it('/api/clientes/:id (PATCH) rejects activo and tenant selectors', async () => {
    await request(app.getHttpServer())
      .patch(`/api/clientes/${clienteId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ activo: false })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/clientes?empresaId=${selectedEmpresaId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(400);
  });

  it('/api/clientes rejects requests without JWT', () => {
    return request(app.getHttpServer()).get('/api/clientes').expect(401);
  });

  it.each(['selected.jwt.token', 'employee.jwt.token'])(
    '/api/reservaciones (POST) allows an authenticated tenant role with %s',
    (token) =>
      request(app.getHttpServer())
        .post('/api/reservaciones')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clienteId,
          sucursalId,
          vestidoIds: [vestidoId],
          fechaInicio: '2026-12-10T16:00:00-07:00',
          fechaFin: '2026-12-12T16:00:00-07:00',
        })
        .expect(201)
        .expect((response) => {
          expect(response.body).toMatchObject({
            id: reservacionId,
            estado: ReservacionEstado.CONFIRMADA,
            importeRenta: '1250.50',
          });
          expect(JSON.stringify(response.body)).not.toContain('schemaName');
          expect(JSON.stringify(response.body)).not.toContain('tenant_');
        }),
  );

  it('/api/reservaciones rejects client-controlled totals and tenant selectors', async () => {
    for (const extra of [
      { importeRenta: '1.00' },
      { estado: 'CONFIRMADA' },
      { empresaId: selectedEmpresaId },
      { empresaSlug: 'atelier-untrusted' },
      { schemaName: 'tenant_untrusted' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/reservaciones')
        .set('Authorization', 'Bearer selected.jwt.token')
        .send({
          clienteId,
          sucursalId,
          vestidoIds: [vestidoId],
          fechaInicio: '2026-12-10T16:00:00-07:00',
          fechaFin: '2026-12-12T16:00:00-07:00',
          ...extra,
        })
        .expect(400);
    }
  });

  it('/api/reservaciones rejects requests without JWT', () => {
    return request(app.getHttpServer()).post('/api/reservaciones').expect(401);
  });

  it.each(['selected.jwt.token', 'employee.jwt.token'])(
    '/api/reservaciones (GET) allows tenant role with %s',
    (token) =>
      request(app.getHttpServer())
        .get('/api/reservaciones')
        .query({
          page: '1',
          limit: '20',
          estado: ReservacionEstado.CONFIRMADA,
          fechaDesde: '2026-12-10T16:00:00-07:00',
          fechaHasta: '2026-12-12T16:00:00-07:00',
          q: 'ana',
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((response) => {
          expect(response.body).toMatchObject({
            data: [
              expect.objectContaining({
                id: reservacionId,
                vestidosCount: 1,
              }),
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          });
          expect(JSON.stringify(response.body)).not.toContain('schemaName');
          expect(JSON.stringify(response.body)).not.toContain('tenant_');
        }),
  );

  it('/api/reservaciones/:id returns complete detail for EMPLOYEE', () => {
    return request(app.getHttpServer())
      .get(`/api/reservaciones/${reservacionId}`)
      .set('Authorization', 'Bearer employee.jwt.token')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: reservacionId,
          cliente: { id: clienteId },
          sucursal: { id: sucursalId },
          vestidos: [
            expect.objectContaining({
              id: vestidoId,
              precioRenta: '1250.50',
            }),
          ],
          entregadaAt: null,
          devueltaAt: null,
          canceladaAt: null,
        });
      });
  });

  it.each(['selected.jwt.token', 'employee.jwt.token'])(
    '/api/reservaciones/:id/finanzas allows tenant role with %s',
    (token) =>
      request(app.getHttpServer())
        .get(`/api/reservaciones/${reservacionId}/finanzas`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((response) => {
          expect(response.body).toMatchObject({
            importeRenta: '1250.50',
            rentaPagadaNeta: '1000.00',
            saldoRenta: '250.50',
          });
          expect(JSON.stringify(response.body)).not.toContain('schemaName');
        }),
  );

  it.each(['selected.jwt.token', 'employee.jwt.token'])(
    '/api/reservaciones/:id/movimientos allows tenant role with %s',
    (token) =>
      request(app.getHttpServer())
        .get(`/api/reservaciones/${reservacionId}/movimientos`)
        .query({
          page: '1',
          limit: '20',
          tipo: 'PAGO_RENTA',
          metodoPago: 'TARJETA',
          fechaDesde: '2026-11-01T00:00:00-07:00',
          fechaHasta: '2026-12-01T00:00:00-07:00',
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((response) => {
          expect(response.body).toMatchObject({
            data: [
              expect.objectContaining({
                tipo: 'PAGO_RENTA',
                monto: '1000.00',
                actor: expect.objectContaining({ nombre: 'Owner' }),
              }),
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          });
          expect(JSON.stringify(response.body)).not.toContain('schemaName');
        }),
  );

  it('rejects financial tenant selectors and unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .get(`/api/reservaciones/${reservacionId}/movimientos`)
      .query({ empresaId: selectedEmpresaId })
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/reservaciones/${reservacionId}/movimientos`)
      .query({ schemaName: 'tenant_untrusted' })
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/reservaciones/${reservacionId}/finanzas`)
      .expect(401);
  });

  it.each(['selected.jwt.token', 'employee.jwt.token'])(
    '/api/reservaciones/:id (PATCH) allows editable fields with %s',
    (token) =>
      request(app.getHttpServer())
        .patch(`/api/reservaciones/${reservacionId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notas: ' Actualizada ' })
        .expect(200)
        .expect((response) => {
          expect(response.body).toMatchObject({
            id: reservacionId,
            notas: 'Actualizada',
            estado: ReservacionEstado.CONFIRMADA,
          });
        }),
  );

  it('/api/reservaciones rejects protected fields and tenant selectors on list and update', async () => {
    for (const body of [
      { estado: ReservacionEstado.CANCELADA },
      { importeRenta: '1.00' },
      { confirmadaAt: null },
      { empresaId: selectedEmpresaId },
      { empresaSlug: 'atelier-untrusted' },
      { schemaName: 'tenant_untrusted' },
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/reservaciones/${reservacionId}`)
        .set('Authorization', 'Bearer selected.jwt.token')
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .get(`/api/reservaciones?empresaId=${selectedEmpresaId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(400);
  });

  it.each(['selected.jwt.token', 'employee.jwt.token'])(
    '/api/reservaciones/:id/confirmar allows %s',
    (token) =>
      request(app.getHttpServer())
        .post(`/api/reservaciones/${reservacionId}/confirmar`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201)
        .expect((response) => {
          expect(response.body).toMatchObject({
            id: reservacionId,
            estado: ReservacionEstado.CONFIRMADA,
          });
        }),
  );

  it.each([
    ['entregar', ReservacionEstado.ENTREGADA],
    ['devolver', ReservacionEstado.DEVUELTA],
  ] as const)(
    '/api/reservaciones/:id/%s allows OWNER and EMPLOYEE',
    async (operation, estado) => {
      for (const token of ['selected.jwt.token', 'employee.jwt.token']) {
        await request(app.getHttpServer())
          .post(`/api/reservaciones/${reservacionId}/${operation}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(201)
          .expect((response) => {
            expect(response.body).toMatchObject({ id: reservacionId, estado });
          });
      }
    },
  );

  it('/api/reservaciones/:id/cancelar allows OWNER with a normalized reason', () => {
    return request(app.getHttpServer())
      .post(`/api/reservaciones/${reservacionId}/cancelar`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ motivo: '  Cambio de planes  ' })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: reservacionId,
          estado: ReservacionEstado.CANCELADA,
          motivoCancelacion: 'Cambio de planes',
        });
      });
  });

  it('/api/reservaciones/:id/cancelar returns 403 for EMPLOYEE', () => {
    return request(app.getHttpServer())
      .post(`/api/reservaciones/${reservacionId}/cancelar`)
      .set('Authorization', 'Bearer employee.jwt.token')
      .send({ motivo: 'No autorizado' })
      .expect(403);
  });

  it('/api/reservaciones lifecycle rejects unknown fields and requests without JWT', async () => {
    await request(app.getHttpServer())
      .post(`/api/reservaciones/${reservacionId}/cancelar`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ estado: ReservacionEstado.CANCELADA })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/reservaciones/${reservacionId}/confirmar`)
      .expect(401);
  });

  it('/api/vestidos (POST) creates a dress for OWNER', () => {
    return request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({
        sucursalId,
        codigo: ' v-001 ',
        nombre: 'Vestido Azul',
        talla: 'M',
        color: 'Azul',
        precioRenta: '1250.50',
      })
      .expect(201)
      .expect({
        id: vestidoId,
        sucursalId,
        codigo: 'V-001',
        nombre: 'Vestido Azul',
        descripcion: null,
        talla: 'M',
        color: 'Azul',
        marca: null,
        precioRenta: '1250.50',
        deposito: null,
        estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
        activo: true,
      });
  });

  it('/api/vestidos (POST) returns 403 for EMPLOYEE', () => {
    return request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', 'Bearer employee.jwt.token')
      .send({
        sucursalId,
        codigo: 'V-001',
        nombre: 'Vestido Azul',
        talla: 'M',
        color: 'Azul',
        precioRenta: '1250.50',
      })
      .expect(403);
  });

  it('/api/vestidos (POST) rejects tenant selectors', () => {
    return request(app.getHttpServer())
      .post('/api/vestidos')
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({
        sucursalId,
        codigo: 'V-001',
        nombre: 'Vestido Azul',
        talla: 'M',
        color: 'Azul',
        precioRenta: '1250.50',
        schemaName: 'tenant_untrusted',
      })
      .expect(400);
  });

  it('/api/vestidos rejects requests without JWT', () => {
    return request(app.getHttpServer()).post('/api/vestidos').expect(401);
  });

  it('/api/vestidos (GET) returns a paginated catalog for OWNER', () => {
    return request(app.getHttpServer())
      .get('/api/vestidos?page=1&limit=20&activo=true&q=azul')
      .set('Authorization', 'Bearer selected.jwt.token')
      .set('x-empresa-id', 'b28c2a56-d33f-4d88-a8e7-42931121e295')
      .set('x-schema-name', 'tenant_untrusted')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          data: [
            {
              id: vestidoId,
              sucursal: { id: sucursalId, nombre: 'Centro', activo: true },
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
        expect(JSON.stringify(response.body)).not.toContain('tenant_');
        expect(JSON.stringify(response.body)).not.toContain('schemaName');
      });
  });

  it('/api/vestidos (GET) allows EMPLOYEE', () => {
    return request(app.getHttpServer())
      .get('/api/vestidos')
      .set('Authorization', 'Bearer employee.jwt.token')
      .expect(200);
  });

  it.each(['selected.jwt.token', 'employee.jwt.token'])(
    '/api/vestidos/disponibilidad allows tenant role with %s',
    (token) =>
      request(app.getHttpServer())
        .get('/api/vestidos/disponibilidad')
        .query({
          sucursalId,
          fechaInicio: '2026-12-10T16:00:00-07:00',
          fechaFin: '2026-12-12T16:00:00-07:00',
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((response) => {
          expect(response.body).toMatchObject({
            data: [expect.objectContaining({ id: vestidoId })],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            range: {
              fechaInicio: '2026-12-10T23:00:00.000Z',
              fechaFin: '2026-12-12T23:00:00.000Z',
            },
          });
          expect(JSON.stringify(response.body)).not.toContain('schemaName');
          expect(JSON.stringify(response.body)).not.toContain('tenant_');
        }),
  );

  it('/api/vestidos/disponibilidad rejects unknown tenant selectors', async () => {
    for (const selector of [
      { empresaId: selectedEmpresaId },
      { empresaSlug: 'atelier-norte' },
      { schemaName: 'tenant_untrusted' },
    ]) {
      await request(app.getHttpServer())
        .get('/api/vestidos/disponibilidad')
        .query({
          sucursalId,
          fechaInicio: '2026-12-10T16:00:00-07:00',
          fechaFin: '2026-12-12T16:00:00-07:00',
          ...selector,
        })
        .set('Authorization', 'Bearer selected.jwt.token')
        .expect(400);
    }
  });

  it('/api/vestidos/:id (GET) allows EMPLOYEE', () => {
    return request(app.getHttpServer())
      .get(`/api/vestidos/${vestidoId}`)
      .set('Authorization', 'Bearer employee.jwt.token')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: vestidoId,
          sucursal: { id: sucursalId, nombre: 'Centro', activo: true },
        });
      });
  });

  it('/api/vestidos (GET) rejects unknown tenant selectors', () => {
    return request(app.getHttpServer())
      .get(`/api/vestidos?empresaId=${selectedEmpresaId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(400);
  });

  it('/api/vestidos/:id (GET) validates UUIDs', () => {
    return request(app.getHttpServer())
      .get('/api/vestidos/not-a-uuid')
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(400);
  });

  it('/api/vestidos/:id (PATCH) updates a dress for OWNER', () => {
    return request(app.getHttpServer())
      .patch(`/api/vestidos/${vestidoId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ codigo: ' v-002 ', nombre: 'Vestido Rojo', activo: true })
      .expect(200)
      .expect(vestidoUpdateResponse);
  });

  it('/api/vestidos/:id (DELETE) soft-deletes a dress for OWNER', () => {
    return request(app.getHttpServer())
      .delete(`/api/vestidos/${vestidoId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .expect(200)
      .expect({ ...vestidoUpdateResponse, activo: false });
  });

  it.each([
    ['patch', { activo: true }],
    ['delete', undefined],
  ] as const)(
    'returns 403 when EMPLOYEE uses %s /api/vestidos/:id',
    (method, body) => {
      const operation = request(app.getHttpServer())
        [method](`/api/vestidos/${vestidoId}`)
        .set('Authorization', 'Bearer employee.jwt.token');

      if (body !== undefined) {
        operation.send(body);
      }

      return operation.expect(403);
    },
  );

  it('/api/vestidos/:id (PATCH) rejects tenant selectors', () => {
    return request(app.getHttpServer())
      .patch(`/api/vestidos/${vestidoId}`)
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ empresaId: selectedEmpresaId, activo: true })
      .expect(400);
  });

  it('does not expose the previous empresaSlug route', () => {
    return request(app.getHttpServer())
      .post('/api/empresas/atelier-norte/sucursales')
      .set('Authorization', 'Bearer selected.jwt.token')
      .send({ nombre: 'Centro' })
      .expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
