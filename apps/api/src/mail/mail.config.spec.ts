import {
  createMailConfiguration,
  validateMailEnvironment,
  type MailEnvironmentReader,
} from './mail.config.js';

const smtpEnvironment: Record<string, string> = {
  MAIL_MODE: 'smtp',
  MAIL_HOST: 'smtp.example.test',
  MAIL_PORT: '587',
  MAIL_SECURE: 'false',
  MAIL_USERNAME: 'smtp-user',
  MAIL_PASSWORD: 'smtp-password-secret',
  MAIL_FROM: 'Vestidos SaaS <no-reply@example.test>',
  WEB_APP_URL: 'https://app.example.test',
};

function reader(environment: Record<string, string>): MailEnvironmentReader {
  return (key) => environment[key];
}

describe('mail configuration', () => {
  it('parses a complete SMTP configuration', () => {
    expect(createMailConfiguration(reader(smtpEnvironment))).toEqual({
      mode: 'smtp',
      from: 'Vestidos SaaS <no-reply@example.test>',
      webAppUrl: 'https://app.example.test',
      smtp: {
        host: 'smtp.example.test',
        port: 587,
        secure: false,
        username: 'smtp-user',
        password: 'smtp-password-secret',
      },
    });
  });

  it.each([
    'MAIL_HOST',
    'MAIL_PORT',
    'MAIL_SECURE',
    'MAIL_USERNAME',
    'MAIL_PASSWORD',
    'MAIL_FROM',
  ])(
    'rejects incomplete SMTP configuration without exposing values: %s',
    (missing) => {
      const environment = { ...smtpEnvironment };
      delete environment[missing];

      expect(() => createMailConfiguration(reader(environment))).toThrow(
        missing,
      );
      try {
        createMailConfiguration(reader(environment));
      } catch (error) {
        expect(String(error)).not.toContain(smtpEnvironment.MAIL_PASSWORD);
        expect(String(error)).not.toContain(smtpEnvironment.MAIL_USERNAME);
      }
    },
  );

  it('allows disabled mode during development without SMTP credentials', () => {
    expect(
      createMailConfiguration(
        reader({ MAIL_MODE: 'disabled', WEB_APP_URL: 'http://localhost:4200' }),
      ),
    ).toEqual({
      mode: 'disabled',
      from: null,
      webAppUrl: 'http://localhost:4200',
    });
    expect(createMailConfiguration(reader({}))).toEqual({
      mode: 'disabled',
      from: null,
      webAppUrl: 'http://localhost:4200',
    });
  });

  it('requires complete SMTP mode in production', () => {
    expect(() =>
      createMailConfiguration(
        reader({
          NODE_ENV: 'production',
          MAIL_MODE: 'disabled',
          WEB_APP_URL: 'https://app.example.test',
        }),
      ),
    ).toThrow('MAIL_MODE must be smtp in production');
    expect(() =>
      validateMailEnvironment({
        NODE_ENV: 'production',
        MAIL_MODE: 'smtp',
        WEB_APP_URL: 'https://app.example.test',
      }),
    ).toThrow('is required when MAIL_MODE=smtp');
  });

  it.each([
    'ftp://app.example.test',
    'https://*.example.test',
    'https://user:password@app.example.test',
    'https://app.example.test/path',
    'https://app.example.test?token=secret',
    'not-a-url',
  ])(
    'rejects WEB_APP_URL that is not a strict HTTP(S) origin: %s',
    (webAppUrl) => {
      expect(() =>
        createMailConfiguration(
          reader({ MAIL_MODE: 'disabled', WEB_APP_URL: webAppUrl }),
        ),
      ).toThrow('WEB_APP_URL must be a valid HTTP(S) origin');
    },
  );

  it('normalizes the web origin without preserving a trailing slash', () => {
    expect(
      createMailConfiguration(
        reader({
          MAIL_MODE: 'disabled',
          WEB_APP_URL: 'https://app.example.test/',
        }),
      ).webAppUrl,
    ).toBe('https://app.example.test');
  });
});
