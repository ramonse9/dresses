import { isIP } from 'node:net';
import type { Request } from 'express';

export interface SessionMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

const maximumUserAgentLength = 512;

export function sessionMetadataFromRequest(
  request: Pick<Request, 'ip' | 'headers'>,
): SessionMetadata {
  return {
    ipAddress: normalizeIpAddress(request.ip),
    userAgent: normalizeUserAgent(request.headers['user-agent']),
  };
}

function normalizeIpAddress(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && isIP(normalized) !== 0 ? normalized : null;
}

function normalizeUserAgent(value: string | undefined): string | null {
  const sanitized = value
    ? Array.from(value, (character) => {
        const code = character.codePointAt(0) ?? 0;
        return code <= 31 || code === 127 ? ' ' : character;
      }).join('')
    : undefined;
  const normalized = sanitized?.trim().slice(0, maximumUserAgentLength);
  return normalized?.length ? normalized : null;
}
