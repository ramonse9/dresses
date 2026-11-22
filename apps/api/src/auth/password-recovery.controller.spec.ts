import { PasswordRecoveryController } from './password-recovery.controller.js';
import { PasswordRecoveryService } from './password-recovery.service.js';

describe('PasswordRecoveryController', () => {
  const service = {
    request: vi.fn(),
    reset: vi.fn(),
  };
  const controller = new PasswordRecoveryController(
    service as unknown as PasswordRecoveryService,
  );

  beforeEach(() => vi.clearAllMocks());

  it('normalizes and forwards only the recovery email', async () => {
    service.request.mockResolvedValue({ message: 'generic' });
    await controller.request({ email: '  PERSON@Example.COM  ' });
    expect(service.request).toHaveBeenCalledWith({
      email: 'person@example.com',
    });
  });

  it('forwards only the opaque token and validated password', async () => {
    const token = 'A'.repeat(43);
    service.reset.mockResolvedValue({ message: 'done' });
    await controller.reset({ token, password: 'new-secure-password' });
    expect(service.reset).toHaveBeenCalledWith({
      token,
      password: 'new-secure-password',
    });
  });
});
