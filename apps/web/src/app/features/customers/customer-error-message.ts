import type { ApiError } from '../../core/http/api-error';

export function customerErrorMessage(error: ApiError | null, detail = false): string {
  if (error?.status === 403) {
    return 'Ya no tienes acceso a los clientes de esta empresa.';
  }
  if (detail && error?.status === 404) {
    return 'El cliente no existe o no está disponible en esta empresa.';
  }
  if (error?.status === 0) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No fue posible cargar la información de clientes. Intenta nuevamente.';
}
