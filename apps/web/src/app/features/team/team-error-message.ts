import type { ApiError } from '../../core/http/api-error';

export function teamErrorMessage(error: ApiError | null, detail = false): string {
  if (error?.status === 403) {
    return 'No tienes autorización para administrar el equipo de esta empresa.';
  }
  if (detail && error?.status === 404) {
    return 'La membresía no existe o pertenece a otra empresa.';
  }
  if (error?.status === 0) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No fue posible cargar la información del equipo. Intenta nuevamente.';
}

export function teamMutationErrorMessage(error: ApiError): string {
  if (error.status === 403) {
    return 'No tienes autorización vigente para modificar esta membresía.';
  }
  if (error.status === 404) {
    return 'La membresía no existe o pertenece a otra empresa.';
  }
  if (error.status === 409) {
    return 'La empresa debe conservar al menos un propietario activo.';
  }
  if (error.status === 0) {
    return 'No fue posible conectar con el servidor. No se aplicaron cambios locales.';
  }
  return 'No fue posible actualizar la membresía. Intenta nuevamente.';
}
