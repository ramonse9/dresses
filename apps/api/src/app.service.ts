import { Injectable } from '@nestjs/common';
import {
  DatabaseHealth,
  DatabaseHealthService,
} from './database/database-health.service.js';

export type AppHealth = {
  status: 'ok' | 'degraded';
  service: 'dresses-api';
  database: DatabaseHealth;
};

@Injectable()
export class AppService {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  async getHealth(): Promise<AppHealth> {
    const database = await this.databaseHealthService.checkConnection();

    return {
      status: database.status === 'up' ? 'ok' : 'degraded',
      service: 'dresses-api',
      database,
    };
  }
}
