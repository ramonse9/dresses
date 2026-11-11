import { DataSource } from 'typeorm';
import { DatabaseHealthService } from './database-health.service.js';

describe('DatabaseHealthService', () => {
  it('reports an available database after a successful query', async () => {
    const query = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
    const dataSource = {
      isInitialized: true,
      query,
    } as unknown as DataSource;
    const service = new DatabaseHealthService(dataSource);

    await expect(service.checkConnection()).resolves.toEqual({ status: 'up' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports an unavailable database when the query fails', async () => {
    const dataSource = {
      isInitialized: true,
      query: vi.fn().mockRejectedValue(new Error('connection lost')),
    } as unknown as DataSource;
    const service = new DatabaseHealthService(dataSource);

    await expect(service.checkConnection()).resolves.toEqual({
      status: 'down',
    });
  });

  it('does not query an uninitialized data source', async () => {
    const query = vi.fn();
    const dataSource = {
      isInitialized: false,
      query,
    } as unknown as DataSource;
    const service = new DatabaseHealthService(dataSource);

    await expect(service.checkConnection()).resolves.toEqual({
      status: 'down',
    });
    expect(query).not.toHaveBeenCalled();
  });
});
