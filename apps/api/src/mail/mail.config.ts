import type { ConfigService } from '@nestjs/config';

export type DisabledMailConfiguration = {
  readonly mode: 'disabled';
  readonly from: null;
  readonly webAppUrl: string;
};

export type SmtpMailConfiguration = {
  readonly mode: 'smtp';
  readonly from: string;
  readonly webAppUrl: string;
  readonly smtp: {
    readonly host: string;
    readonly port: number;
    readonly secure: boolean;
    readonly username: string;
    readonly password: string;
  };
};

export type MailConfiguration =
  DisabledMailConfiguration | SmtpMailConfiguration;
export type MailEnvironmentReader = (key: string) => string | undefined;

const defaultDevelopmentWebAppUrl = 'http://localhost:4200';

export function createMailConfiguration(
  readEnvironment: MailEnvironmentReader = (key) => process.env[key],
): MailConfiguration {
  const production = readEnvironment('NODE_ENV') === 'production';
  const modeValue =
    readEnvironment('MAIL_MODE') ?? (production ? undefined : 'disabled');

  if (modeValue !== 'disabled' && modeValue !== 'smtp') {
    throw new Error('MAIL_MODE must be disabled or smtp');
  }
  if (production && modeValue !== 'smtp') {
    throw new Error('MAIL_MODE must be smtp in production');
  }

  const webAppUrl = parseWebAppOrigin(
    readEnvironment('WEB_APP_URL') ??
      (production ? undefined : defaultDevelopmentWebAppUrl),
  );

  if (modeValue === 'disabled') {
    return { mode: 'disabled', from: null, webAppUrl };
  }

  return {
    mode: 'smtp',
    from: requiredSafeValue(readEnvironment, 'MAIL_FROM'),
    webAppUrl,
    smtp: {
      host: requiredSafeValue(readEnvironment, 'MAIL_HOST'),
      port: parsePort(requiredSafeValue(readEnvironment, 'MAIL_PORT')),
      secure: parseBoolean(
        requiredSafeValue(readEnvironment, 'MAIL_SECURE'),
        'MAIL_SECURE',
      ),
      username: requiredSafeValue(readEnvironment, 'MAIL_USERNAME'),
      password: requiredSafeValue(readEnvironment, 'MAIL_PASSWORD'),
    },
  };
}

export function getMailConfiguration(
  configService: ConfigService,
): MailConfiguration {
  return createMailConfiguration((key) => configService.get<string>(key));
}

export function validateMailEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  createMailConfiguration((key) => {
    const value = environment[key];
    return typeof value === 'string' ? value : undefined;
  });
  return environment;
}

function requiredSafeValue(
  readEnvironment: MailEnvironmentReader,
  key: string,
): string {
  const value = readEnvironment(key)?.trim();
  if (!value) {
    throw new Error(`${key} is required when MAIL_MODE=smtp`);
  }
  if (value.includes('\r') || value.includes('\n')) {
    throw new Error(`${key} is invalid`);
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('MAIL_PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseBoolean(value: string, key: string): boolean {
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${key} must be true or false`);
  }
  return value === 'true';
}

function parseWebAppOrigin(value: string | undefined): string {
  if (!value) {
    throw new Error('WEB_APP_URL is required');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('WEB_APP_URL must be a valid HTTP(S) origin');
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    value.includes('*')
  ) {
    throw new Error('WEB_APP_URL must be a valid HTTP(S) origin');
  }

  return url.origin;
}
