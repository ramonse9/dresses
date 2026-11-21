import { Test } from '@nestjs/testing';
import type { SmtpMailConfiguration } from './mail.config.js';
import { MailModule } from './mail.module.js';
import { MAIL_CONFIGURATION, MAIL_TRANSPORT } from './mail.tokens.js';
import { InMemoryMailTransport } from './testing/in-memory-mail.transport.js';
import { TransactionalMailService } from './transactional-mail.service.js';

describe('MailModule', () => {
  it('allows replacing the transport through dependency injection', async () => {
    const transport = new InMemoryMailTransport();
    const configuration: SmtpMailConfiguration = {
      mode: 'smtp',
      from: 'no-reply@example.test',
      webAppUrl: 'https://app.example.test',
      smtp: {
        host: 'smtp.example.test',
        port: 587,
        secure: false,
        username: 'test-user',
        password: 'test-password',
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [MailModule] })
      .overrideProvider(MAIL_CONFIGURATION)
      .useValue(configuration)
      .overrideProvider(MAIL_TRANSPORT)
      .useValue(transport)
      .compile();

    await moduleRef.get(TransactionalMailService).send({
      recipient: 'recipient@example.test',
      subject: 'Test',
      text: 'Test',
      html: '<p>Test</p>',
    });

    expect(transport.messages).toHaveLength(1);
    await moduleRef.close();
  });
});
