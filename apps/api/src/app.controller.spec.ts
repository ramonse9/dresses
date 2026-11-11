import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseHealthService } from './database/database-health.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DatabaseHealthService,
          useValue: {
            checkConnection: vi.fn().mockResolvedValue({ status: 'up' }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should report that the API and database are available', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        service: 'dresses-api',
        database: { status: 'up' },
      });
    });
  });
});
