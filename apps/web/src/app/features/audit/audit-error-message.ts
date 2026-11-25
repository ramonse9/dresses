import type { ApiError } from '../../core/http/api-error';

export function auditErrorMessage(error: ApiError | null, detail = false): string {
  if (error?.status === 403) {
    return 'No tienes autorización para consultar la auditoría de esta empresa.';
  }
  if (detail && error?.status === 404) {
    return 'El evento no existe o pertenece a otra empresa.';
  }
  if (error?.status === 0) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No fue posible cargar la auditoría. Intenta nuevamente.';
}
