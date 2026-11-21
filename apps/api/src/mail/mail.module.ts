import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { DisabledMailTransport } from './disabled-mail.transport.js';
import { getMailConfiguration, type MailConfiguration } from './mail.config.js';
import {
  MAIL_CONFIGURATION,
  MAIL_TRANSPORT,
  SMTP_CLIENT,
} from './mail.tokens.js';
import type { MailTransport, SmtpClient } from './mail.types.js';
import { SmtpMailTransport } from './smtp-mail.transport.js';
import { TransactionalMailService } from './transactional-mail.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MAIL_CONFIGURATION,
      inject: [ConfigService],
      useFactory: getMailConfiguration,
    },
    {
      provide: SMTP_CLIENT,
      inject: [MAIL_CONFIGURATION],
      useFactory: (configuration: MailConfiguration): SmtpClient | null => {
        if (configuration.mode !== 'smtp') {
          return null;
        }
        return nodemailer.createTransport({
          host: configuration.smtp.host,
          port: configuration.smtp.port,
          secure: configuration.smtp.secure,
          auth: {
            user: configuration.smtp.username,
            pass: configuration.smtp.password,
          },
        });
      },
    },
    DisabledMailTransport,
    SmtpMailTransport,
    {
      provide: MAIL_TRANSPORT,
      inject: [MAIL_CONFIGURATION, DisabledMailTransport, SmtpMailTransport],
      useFactory: (
        configuration: MailConfiguration,
        disabledTransport: DisabledMailTransport,
        smtpTransport: SmtpMailTransport,
      ): MailTransport =>
        configuration.mode === 'smtp' ? smtpTransport : disabledTransport,
    },
    TransactionalMailService,
  ],
  exports: [MAIL_TRANSPORT, TransactionalMailService],
})
export class MailModule {}
