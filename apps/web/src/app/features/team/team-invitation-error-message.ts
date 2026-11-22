import type { ApiError } from '../../core/http/api-error';

export function invitationListErrorMessage(error: ApiError | null): string {
  if (error?.status === 403) {
    return 'No tienes autorización para administrar invitaciones de esta empresa.';
  }
  if (error?.status === 0) {
    return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
  }
  return 'No fue posible cargar las invitaciones. Intenta nuevamente.';
}

export function invitationMutationErrorMessage(error: ApiError): string {
  if (error.status === 403) {
    return 'No tienes autorización vigente para administrar invitaciones.';
  }
  if (error.status === 409) {
    return 'El email ya tiene una membresía activa o una invitación pendiente.';
  }
  if (error.status === 429) {
    return 'Debes esperar antes de reenviar esta invitación.';
  }
  if (error.status === 503) {
    return 'El correo no pudo enviarse temporalmente. La invitación puede reenviarse después.';
  }
  if (error.status === 0) {
    return 'No fue posible conectar con el servidor. No se aplicaron cambios locales.';
  }
  return 'No fue posible completar la operación. Intenta nuevamente.';
}
