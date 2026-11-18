import { HttpErrorResponse } from '@angular/common/http';
import { normalizeApiError } from './api-error';

describe('normalizeApiError', () => {
  it('normalizes API messages, codes and validation errors', () => {
    const result = normalizeApiError(
      new HttpErrorResponse({
        status: 400,
        error: {
          message: ['Nombre obligatorio', 'Email inválido'],
          code: 'VALIDATION_ERROR',
          errors: { email: ['Email inválido'] },
        },
      }),
    );

    expect(result).toEqual({
      status: 400,
      message: 'Nombre obligatorio Email inválido',
      code: 'VALIDATION_ERROR',
      validationErrors: { email: ['Email inválido'] },
    });
  });

  it('uses a useful message for connection and unexpected errors', () => {
    expect(
      normalizeApiError(new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })),
    ).toMatchObject({ status: 0, message: 'No fue posible conectar con el servidor.' });
    expect(normalizeApiError(new Error('boom'))).toEqual({
      status: 0,
      message: 'Ocurrió un error inesperado.',
    });
  });
});
