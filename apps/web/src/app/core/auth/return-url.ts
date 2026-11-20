const internalOrigin = 'http://angular.internal';

export function sanitizeReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  let candidate = value.trim();
  if (!candidate) {
    return null;
  }

  try {
    for (let index = 0; index < 2; index += 1) {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) {
        break;
      }
      candidate = decoded;
    }
  } catch {
    return null;
  }

  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    containsControlCharacter(candidate)
  ) {
    return null;
  }

  const parsed = new URL(candidate, internalOrigin);
  if (parsed.origin !== internalOrigin) {
    return null;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
