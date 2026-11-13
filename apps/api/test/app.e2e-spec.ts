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
import { DatabaseHealthService } from './../src/database/database-health.service.js';
import { DevTenantAdminGuard } from './../src/empresas/dev-tenant-admin.guard.js';
import { EmpresasController } from './../src/empresas/empresas.controller.js';
import { EmpresasService } from './../src/empresas/empresas.service.js';
import { SucursalesController } from './../src/sucursales/sucursales.controller.js';
import { SucursalesService } from './../src/sucursales/sucursales.service.js';
import type { TenantScope } from './../src/tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from './../src/usuarios/entities/empresa-usuario.entity.js';

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
        EmpresasController,
        SucursalesController,
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
