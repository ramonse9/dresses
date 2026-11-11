import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type DatabaseHealth = {
  status: 'up' | 'down';
};

@Injectable()
export class DatabaseHealthService {
  constructor(private readonly dataSource: DataSource) {}

  async checkConnection(): Promise<DatabaseHealth> {
    if (!this.dataSource.isInitialized) {
      return { status: 'down' };
    }

    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch {
      return { status: 'down' };
    }
  }
}
