import { InvitacionesPublicasController } from './invitaciones-publicas.controller.js';
import { InvitacionesAceptacionService } from './invitaciones-aceptacion.service.js';

describe('InvitacionesPublicasController', () => {
  const service = {
    verify: vi.fn(),
    accept: vi.fn(),
  };
  const controller = new InvitacionesPublicasController(
    service as unknown as InvitacionesAceptacionService,
  );
  const token = 'A'.repeat(43);

  beforeEach(() => vi.clearAllMocks());

  it('passes only the verified token to the service', async () => {
    service.verify.mockResolvedValue({ accountExists: false });
    await controller.verificar({ token });
    expect(service.verify).toHaveBeenCalledWith({ token });
  });

  it('passes the strict acceptance input to the service', async () => {
    service.accept.mockResolvedValue({ accepted: true });
    await controller.aceptar({
      token,
      nombre: '  Ana  ',
      password: 'secure-password',
    });
    expect(service.accept).toHaveBeenCalledWith({
      token,
      nombre: 'Ana',
      password: 'secure-password',
    });
  });
});
