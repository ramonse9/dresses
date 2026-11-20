import type { ApiError } from '../../core/http/api-error';

export function availabilityErrorMessage(error: ApiError | null): string {
  if (error?.status === 403)
    return 'Perdiste acceso a esta empresa o no puedes consultar su disponibilidad.';
  if (error?.status === 404)
    return 'La sucursal no existe, está inactiva o no pertenece a esta empresa.';
  if (error?.status === 400) return 'El rango o los filtros enviados no son válidos.';
  if (error?.status === 0)
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  return 'No fue posible consultar la disponibilidad. Intenta nuevamente.';
}
