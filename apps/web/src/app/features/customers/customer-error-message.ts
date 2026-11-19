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

export function customerMutationErrorMessage(error: ApiError | null): string {
  if (error?.status === 400) {
    return 'Los datos del cliente no son válidos. Revisa el formulario e intenta nuevamente.';
  }
  if (error?.status === 403) {
    return 'No tienes autorización para realizar esta acción sobre clientes.';
  }
  if (error?.status === 404) {
    return 'El cliente no existe o ya no está disponible.';
  }
  if (error?.status === 0) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No fue posible guardar los cambios. Intenta nuevamente.';
}
