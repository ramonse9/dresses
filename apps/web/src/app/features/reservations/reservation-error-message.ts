import type { ApiError } from '../../core/http/api-error';

export function reservationErrorMessage(error: ApiError | null, detail = false): string {
  if (error?.status === 403) return 'Perdiste acceso a las reservaciones de esta empresa.';
  if (error?.status === 404 && detail)
    return 'La reservación no existe o no está disponible en esta empresa.';
  if (error?.status === 0)
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  return detail
    ? 'No fue posible cargar la reservación. Intenta nuevamente.'
    : 'No fue posible cargar las reservaciones. Intenta nuevamente.';
}
