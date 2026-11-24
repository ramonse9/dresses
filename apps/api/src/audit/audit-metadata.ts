export type AuditMetadata = Readonly<Record<string, unknown>>;

const sensitiveKeyFragments = [
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'refreshtoken',
  'cookie',
  'authorization',
  'schemaname',
] as const;

export function buildAuditMetadata(
  source: AuditMetadata | undefined,
  safeFields: readonly string[],
): Record<string, unknown> {
  if (!source) {
    return {};
  }

  const metadata: Record<string, unknown> = {};
  for (const field of safeFields) {
    if (isSensitiveKey(field)) {
      continue;
    }
    if (!Object.hasOwn(source, field)) {
      continue;
    }

    const value = sanitizeJsonValue(source[field]);
    if (value !== undefined) {
      metadata[field] = value;
    }
  }

  return metadata;
}

function sanitizeJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeJsonValue(entry))
      .filter((entry) => entry !== undefined);
  }
  if (isPlainRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSensitiveKey(key))
        .map(([key, entry]) => [key, sanitizeJsonValue(entry)] as const)
        .filter(
          (entry): entry is readonly [string, unknown] =>
            entry[1] !== undefined,
        ),
    );
  }
  return undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
  return sensitiveKeyFragments.some((fragment) =>
    normalized.includes(fragment),
  );
}
