import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppController } from './../src/app.controller.js';
import { AppService } from './../src/app.service.js';
import { DatabaseHealthService } from './../src/database/database-health.service.js';
import { EmpresasController } from './../src/empresas/empresas.controller.js';
import { EmpresasService } from './../src/empresas/empresas.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, EmpresasController],
      providers: [
        AppService,
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
      ],
    }).compile();

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

  afterEach(async () => {
    await app.close();
  });
});
