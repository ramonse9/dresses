import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, IsNull, Not } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import type {
  PasswordRecoveryPublicResponseDto,
  RequestPasswordRecoveryDto,
  ResetPasswordDto,
} from './dto/password-recovery.dto.js';
import {
  PASSWORD_RECOVERY_REQUEST_MESSAGE,
  PASSWORD_RESET_INVALID_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
} from './dto/password-recovery.dto.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { PasswordHashService } from './password-hash.service.js';
import { PasswordRecoveryMailService } from './password-recovery-mail.service.js';
import {
  getPasswordRecoveryConfiguration,
  type PasswordRecoveryConfiguration,
} from './password-recovery.config.js';
import { PasswordResetTokenService } from './password-reset-token.service.js';

type PreparedRecovery = Readonly<{
  id: string;
  email: string;
  token: string;
  tokenHash: string;
}>;

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);
  private readonly configuration: PasswordRecoveryConfiguration;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
    private readonly tokenService: PasswordResetTokenService,
    private readonly mailService: PasswordRecoveryMailService,
    private readonly passwordHashService: PasswordHashService,
    private readonly auditService: AuditService,
  ) {
    this.configuration = getPasswordRecoveryConfiguration(configService);
  }

  async request(
    input: RequestPasswordRecoveryDto,
  ): Promise<PasswordRecoveryPublicResponseDto> {
    const generated = this.tokenService.generate();
    const prepared = await this.prepareRequest(input, generated);
    if (!prepared) {
      return this.requestResponse();
    }

    try {
      await this.mailService.send({
        recipient: prepared.email,
        url: this.tokenService.buildResetUrl(prepared.token),
      });
    } catch {
      await this.revokeUndelivered(prepared.id, prepared.tokenHash);
      this.logger.error('PASSWORD_RECOVERY_MAIL_DELIVERY_FAILED');
    }

    return this.requestResponse();
  }

  async reset(
    input: ResetPasswordDto,
  ): Promise<PasswordRecoveryPublicResponseDto> {
    const tokenHash = this.tokenService.hash(input.token);

    await this.dataSource.transaction(async (manager) => {
      const candidate = await manager
        .getRepository(PasswordResetToken)
        .createQueryBuilder('token')
        .select(['token.id', 'token.usuarioId'])
        .where('token.tokenHash = :tokenHash', { tokenHash })
        .getOne();
      if (!candidate) {
        throw this.invalidToken();
      }

      const usuario = await manager
        .getRepository(Usuario)
        .createQueryBuilder('usuario')
        .addSelect('usuario.passwordHash')
        .where('usuario.id = :usuarioId', { usuarioId: candidate.usuarioId })
        .setLock('pessimistic_write')
        .getOne();
      const token = await manager
        .getRepository(PasswordResetToken)
        .createQueryBuilder('token')
        .addSelect('token.tokenHash')
        .where('token.id = :tokenId', { tokenId: candidate.id })
        .andWhere('token.tokenHash = :tokenHash', { tokenHash })
        .setLock('pessimistic_write')
        .getOne();

      if (!usuario || !token?.isUsable(usuario.activo)) {
        throw this.invalidToken();
      }
      if (
        await this.passwordHashService.verifyPassword(
          input.password,
          usuario.passwordHash,
        )
      ) {
        throw new ConflictException(
          'La nueva contraseña debe ser diferente de la contraseña actual',
        );
      }

      const now = new Date();
      usuario.passwordHash = await this.passwordHashService.hashPassword(
        input.password,
      );
      usuario.passwordChangedAt = now;
      token.usedAt = now;

      await manager.getRepository(Usuario).save(usuario);
      await manager.getRepository(PasswordResetToken).save(token);
      await manager.getRepository(PasswordResetToken).update(
        {
          usuarioId: usuario.id,
          id: Not(token.id),
          revokedAt: IsNull(),
        },
        { revokedAt: now },
      );
      const revokedSessions = await manager
        .getRepository(AuthSession)
        .update(
          { usuarioId: usuario.id, revokedAt: IsNull() },
          { revokedAt: now, revokedByUsuarioId: usuario.id },
        );
      await this.auditService.record(
        {
          empresaId: null,
          actorUsuarioId: usuario.id,
          sessionId: null,
          action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
          resourceType: AUDIT_RESOURCE_TYPES.USER,
          resourceId: usuario.id,
          metadata: { revokedSessionCount: revokedSessions.affected ?? 0 },
          safeMetadataFields: ['revokedSessionCount'],
        },
        manager,
      );
    });

    return { message: PASSWORD_RESET_SUCCESS_MESSAGE };
  }

  private async prepareRequest(
    input: RequestPasswordRecoveryDto,
    generated: Readonly<{ token: string; hash: string }>,
  ): Promise<PreparedRecovery | null> {
    return this.dataSource.transaction(async (manager) => {
      const usuario = await manager
        .getRepository(Usuario)
        .createQueryBuilder('usuario')
        .where('usuario.email = :email', { email: input.email })
        .setLock('pessimistic_write')
        .getOne();
      if (!usuario?.activo) {
        return null;
      }

      const latest = await manager
        .getRepository(PasswordResetToken)
        .createQueryBuilder('token')
        .where('token.usuarioId = :usuarioId', { usuarioId: usuario.id })
        .orderBy('token.createdAt', 'DESC')
        .addOrderBy('token.id', 'DESC')
        .setLock('pessimistic_write')
        .getOne();
      const now = new Date();
      if (
        latest &&
        latest.createdAt.getTime() +
          this.configuration.requestCooldownSeconds * 1_000 >
          now.getTime()
      ) {
        return null;
      }

      await this.revokePreviousTokens(manager, usuario.id, now);
      const token = await manager.getRepository(PasswordResetToken).save(
        manager.getRepository(PasswordResetToken).create({
          usuarioId: usuario.id,
          tokenHash: generated.hash,
          expiresAt: new Date(
            now.getTime() + this.configuration.ttlSeconds * 1_000,
          ),
          usedAt: null,
          revokedAt: null,
        }),
      );
      return {
        id: token.id,
        email: usuario.email,
        token: generated.token,
        tokenHash: generated.hash,
      };
    });
  }

  private revokePreviousTokens(
    manager: EntityManager,
    usuarioId: string,
    now: Date,
  ): Promise<unknown> {
    return manager
      .getRepository(PasswordResetToken)
      .update({ usuarioId, revokedAt: IsNull() }, { revokedAt: now });
  }

  private async revokeUndelivered(
    id: string,
    tokenHash: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const token = await manager
        .getRepository(PasswordResetToken)
        .createQueryBuilder('token')
        .addSelect('token.tokenHash')
        .where('token.id = :id', { id })
        .andWhere('token.tokenHash = :tokenHash', { tokenHash })
        .setLock('pessimistic_write')
        .getOne();
      if (token && token.usedAt === null && token.revokedAt === null) {
        token.revokedAt = new Date();
        await manager.getRepository(PasswordResetToken).save(token);
      }
    });
  }

  private requestResponse(): PasswordRecoveryPublicResponseDto {
    return { message: PASSWORD_RECOVERY_REQUEST_MESSAGE };
  }

  private invalidToken(): BadRequestException {
    return new BadRequestException(PASSWORD_RESET_INVALID_MESSAGE);
  }
}
