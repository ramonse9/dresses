import type { ApiError } from '../../core/http/api-error';

export function dressErrorMessage(error: ApiError | null, detail = false): string {
  if (error?.status === 403) {
    return 'Ya no tienes acceso al catálogo de esta empresa.';
  }
  if (detail && error?.status === 404) {
    return 'El vestido no existe o no está disponible en esta empresa.';
  }
  if (error?.status === 0) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No fue posible cargar el catálogo. Intenta nuevamente.';
}

export function dressMutationErrorMessage(error: ApiError | null): string {
  if (error?.status === 400) {
    return 'Los datos del vestido no son válidos. Revisa el formulario e intenta nuevamente.';
  }
  if (error?.status === 403) {
    return 'No tienes autorización para modificar vestidos en esta empresa.';
  }
  if (error?.status === 404) {
    return 'El vestido o la sucursal seleccionada no existe o ya no está disponible.';
  }
  if (error?.status === 409) {
    return 'Ya existe un vestido con ese código en esta empresa.';
  }
  if (error?.status === 0) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No fue posible guardar los cambios. Intenta nuevamente.';
}
