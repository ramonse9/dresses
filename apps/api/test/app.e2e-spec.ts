import { Test, TestingModule } from '@nestjs/testing';
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
import { AuthService } from './../src/auth/auth.service.js';
import { CurrentTenant } from './../src/auth/current-tenant.decorator.js';
import { JwtAuthGuard } from './../src/auth/jwt-auth.guard.js';
import { TenantAuthGuard } from './../src/auth/tenant-auth.guard.js';
import { TenantAuthenticated } from './../src/auth/tenant-authenticated.decorator.js';
import { ClientesController } from './../src/clientes/clientes.controller.js';
import { ClientesService } from './../src/clientes/clientes.service.js';
import { DatabaseHealthService } from './../src/database/database-health.service.js';
import { DevTenantAdminGuard } from './../src/empresas/dev-tenant-admin.guard.js';
import { EmpresasController } from './../src/empresas/empresas.controller.js';
import { EmpresasService } from './../src/empresas/empresas.service.js';
import { ReservacionEstado } from './../src/reservaciones/entities/reservacion.tenant-entity.js';
import { ReservacionesController } from './../src/reservaciones/reservaciones.controller.js';
import { ReservacionesService } from './../src/reservaciones/reservaciones.service.js';
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
    sub: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    email: 'owner@example.com',
    sessionId: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        AppController,
        AuthController,
        ClientesController,
        EmpresasController,
        ReservacionesController,
        SucursalesController,
        VestidosController,
        TenantProbeController,
      ],
      providers: [
        AppService,
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
            update: vi.fn().mockResolvedValue({
              ...reservacionResponse,
              notas: 'Actualizada',
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

  it('/api/auth/login (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'Owner@Example.COM', password: 'correct-password' })
      .expect(201)
      .expect({
        accessToken: 'signed.jwt.token',
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      });
  });

  it('/api/auth/refresh (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200)
      .expect({
        accessToken: 'rotated.jwt.token',
        refreshToken: rotatedRefreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      });
  });

  it('/api/auth/logout (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer signed.jwt.token')
      .expect(204);
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
