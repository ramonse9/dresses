import { Test, type TestingModule } from '@nestjs/testing';
import type { SmtpMailConfiguration } from './mail.config.js';
import { MAIL_CONFIGURATION, MAIL_TRANSPORT } from './mail.tokens.js';
import { InMemoryMailTransport } from './testing/in-memory-mail.transport.js';
import { TransactionalMailService } from './transactional-mail.service.js';

const configuration: SmtpMailConfiguration = {
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
};

describe('TransactionalMailService', () => {
  let moduleRef: TestingModule;
  let transport: InMemoryMailTransport;
  let service: TransactionalMailService;

  beforeEach(async () => {
    transport = new InMemoryMailTransport();
    moduleRef = await Test.createTestingModule({
      providers: [
        TransactionalMailService,
        { provide: MAIL_CONFIGURATION, useValue: configuration },
        { provide: MAIL_TRANSPORT, useValue: transport },
      ],
    }).compile();
    service = moduleRef.get(TransactionalMailService);
  });

  afterEach(async () => moduleRef.close());

  it('sends through a replaceable in-memory transport with an internal sender', async () => {
    await service.send({
      recipient: 'ana@example.test',
      subject: 'Mensaje transaccional',
      text: 'Contenido seguro',
      html: '<p>Contenido seguro</p>',
    });

    expect(transport.messages).toEqual([
      {
        from: configuration.from,
        to: 'ana@example.test',
        subject: 'Mensaje transaccional',
        text: 'Contenido seguro',
        html: '<p>Contenido seguro</p>',
      },
    ]);
  });

  it('ignores a forged sender property and exposes only the configured web origin', async () => {
    await service.send({
      recipient: 'ana@example.test',
      subject: 'Mensaje',
      text: 'Texto',
      html: '<p>Texto</p>',
      from: 'attacker@example.test',
    } as Parameters<TransactionalMailService['send']>[0] & { from: string });

    expect(transport.messages[0].from).toBe(configuration.from);
    expect(service.getWebAppOrigin()).toBe('https://app.example.test');
  });

  it('can clear the in-memory fake between tests', async () => {
    await service.send({
      recipient: 'a@example.test',
      subject: 'A',
      text: 'A',
      html: 'A',
    });
    transport.clear();
    expect(transport.messages).toEqual([]);
  });
});
