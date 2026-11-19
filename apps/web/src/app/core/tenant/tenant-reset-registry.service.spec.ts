import { TenantResetRegistry } from './tenant-reset-registry.service';

describe('TenantResetRegistry', () => {
  it('resets registered feature state and supports unregistering', () => {
    const registry = new TenantResetRegistry();
    const firstReset = vi.fn();
    const secondReset = vi.fn();
    registry.register(firstReset);
    const unregister = registry.register(secondReset);

    unregister();
    registry.resetAll();

    expect(firstReset).toHaveBeenCalledOnce();
    expect(secondReset).not.toHaveBeenCalled();
  });
});
