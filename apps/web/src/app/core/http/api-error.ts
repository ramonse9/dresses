import { HttpErrorResponse } from '@angular/common/http';

export type ApiValidationErrors = Readonly<Record<string, readonly string[]>>;

export interface ApiError {
  readonly status: number;
  readonly message: string;
  readonly code?: string;
  readonly validationErrors?: ApiValidationErrors;
}

type ErrorPayload = {
  readonly message?: unknown;
  readonly code?: unknown;
  readonly errors?: unknown;
};

export function normalizeApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      status: 0,
      message: 'Ocurrió un error inesperado.',
    };
  }

  const payload = isRecord(error.error) ? (error.error as ErrorPayload) : null;
  const message = normalizeMessage(payload?.message, error);
  const code = typeof payload?.code === 'string' ? payload.code : undefined;
  const validationErrors = normalizeValidationErrors(payload?.errors);

  return {
    status: error.status,
    message,
    ...(code ? { code } : {}),
    ...(validationErrors ? { validationErrors } : {}),
  };
}

function normalizeMessage(value: unknown, error: HttpErrorResponse): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const messages = value.filter(
      (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
    );

    if (messages.length > 0) {
      return messages.join(' ');
    }
  }
  if (typeof error.error === 'string' && error.error.trim().length > 0) {
    return error.error.trim();
  }
  if (error.status === 0) {
    return 'No fue posible conectar con el servidor.';
  }

  return error.message || 'La solicitud no pudo completarse.';
}

function normalizeValidationErrors(value: unknown): ApiValidationErrors | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([field, messages]) => {
    if (!Array.isArray(messages)) {
      return [];
    }

    const normalized = messages.filter(
      (message): message is string => typeof message === 'string' && message.trim().length > 0,
    );

    return normalized.length > 0 ? [[field, normalized] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
