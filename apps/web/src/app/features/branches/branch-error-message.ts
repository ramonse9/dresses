import type { ApiError } from '../../core/http/api-error';

export function branchErrorMessage(error: ApiError | null, detail = false): string {
  if (!error) {
    return 'No fue posible cargar la información de sucursales.';
  }
  if (error.status === 403) {
    return 'Ya no tienes acceso a las sucursales de esta empresa.';
  }
  if (detail && error.status === 404) {
    return 'La sucursal no existe o no está disponible en esta empresa.';
  }
  if (error.status === 0) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No fue posible cargar la información de sucursales. Intenta nuevamente.';
}

export function branchMutationErrorMessage(error: ApiError | null): string {
  if (error?.status === 403) {
    return 'No tienes autorización para modificar sucursales en esta empresa.';
  }
  if (error?.status === 409) {
    return 'Ya existe una sucursal con ese nombre en esta empresa.';
  }
  if (error?.status === 404) {
    return 'La sucursal no existe o ya no está disponible.';
  }
  if (error?.status === 0) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No fue posible guardar los cambios. Intenta nuevamente.';
}
