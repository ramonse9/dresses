import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { getRefreshTokenTtlSeconds } from './auth.config.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { RefreshTokenService } from './refresh-token.service.js';
import type { SessionMetadata } from './session-metadata.js';
import type {
  AuthSessionResponseDto,
  ListAuthSessionsQueryDto,
} from './dto/auth-session.dto.js';

export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
  usuario?: Usuario;
}

@Injectable()
export class AuthSessionsService {
  constructor(
    @InjectRepository(AuthSession)
    private readonly sessionsRepository: Repository<AuthSession>,
    private readonly dataSource: DataSource,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    usuarioId: string,
    metadata: SessionMetadata = { ipAddress: null, userAgent: null },
  ): Promise<IssuedSession> {
    const issuedToken = this.refreshTokenService.issue();
    const ttlSeconds = getRefreshTokenTtlSeconds(this.configService);
    const now = new Date();
    const session = this.sessionsRepository.create({
      id: randomUUID(),
      usuarioId,
      refreshTokenHash: issuedToken.hash,
      expiresAt: new Date(Date.now() + ttlSeconds * 1_000),
      revokedAt: null,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      lastSeenAt: now,
      revokedByUsuarioId: null,
    });

    await this.sessionsRepository.save(session);
    return { session, refreshToken: issuedToken.token };
  }

  async rotate(
    refreshToken: string,
    metadata: SessionMetadata = { ipAddress: null, userAgent: null },
  ): Promise<Required<IssuedSession>> {
    const presentedHash = this.refreshTokenService.hash(refreshToken);

    return this.dataSource.transaction(async (manager) => {
      const session = await this.findForRotation(manager, presentedHash);

      if (!this.isUsable(session)) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      const issuedToken = this.refreshTokenService.issue();
      session.refreshTokenHash = issuedToken.hash;
      session.ipAddress = metadata.ipAddress;
      session.userAgent = metadata.userAgent;
      session.lastSeenAt = new Date();
      await manager.getRepository(AuthSession).save(session);

      return {
        session,
        usuario: session.usuario,
        refreshToken: issuedToken.token,
      };
    });
  }

  async assertActive(sessionId: string, usuarioId: string): Promise<void> {
    const session = await this.sessionsRepository
      .createQueryBuilder('session')
      .innerJoin('session.usuario', 'usuario')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.usuarioId = :usuarioId', { usuarioId })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > :now', { now: new Date() })
      .andWhere('usuario.activo = true')
      .getOne();

    if (!session) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  async findOwned(
    usuarioId: string,
    currentSessionId: string,
    input: ListAuthSessionsQueryDto,
  ): Promise<AuthSessionResponseDto[]> {
    const query = this.sessionsRepository
      .createQueryBuilder('session')
      .select([
        'session.id',
        'session.createdAt',
        'session.lastSeenAt',
        'session.expiresAt',
        'session.revokedAt',
        'session.ipAddress',
        'session.userAgent',
      ])
      .where('session.usuarioId = :usuarioId', { usuarioId })
      .andWhere(
        input.revoked
          ? 'session.revokedAt IS NOT NULL'
          : 'session.revokedAt IS NULL',
      )
      .orderBy('session.lastSeenAt', 'DESC')
      .addOrderBy('session.id', 'DESC')
      .take(input.limit);

    const sessions = await query.getMany();
    return sessions.map((session) =>
      this.toResponse(session, session.id === currentSessionId),
    );
  }

  revokeOwned(
    sessionId: string,
    usuarioId: string,
    revokedByUsuarioId: string,
  ): Promise<void> {
    return this.revokeSession(sessionId, usuarioId, revokedByUsuarioId, true);
  }

  async revokeOthers(
    usuarioId: string,
    currentSessionId: string,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(AuthSession)
        .createQueryBuilder()
        .update(AuthSession)
        .set({
          revokedAt: new Date(),
          revokedByUsuarioId: usuarioId,
        })
        .where('usuario_id = :usuarioId', { usuarioId })
        .andWhere('id <> :currentSessionId', { currentSessionId })
        .andWhere('revoked_at IS NULL')
        .execute();

      return result.affected ?? 0;
    });
  }

  async revoke(
    sessionId: string,
    usuarioId: string,
    revokedByUsuarioId: string = usuarioId,
  ): Promise<void> {
    await this.revokeSession(sessionId, usuarioId, revokedByUsuarioId, false);
  }

  private async revokeSession(
    sessionId: string,
    usuarioId: string,
    revokedByUsuarioId: string,
    requireOwnedSession: boolean,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AuthSession);
      const session = await repository
        .createQueryBuilder('session')
        .where('session.id = :sessionId', { sessionId })
        .andWhere('session.usuarioId = :usuarioId', { usuarioId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) {
        if (requireOwnedSession) {
          throw new NotFoundException('Sesión no encontrada');
        }
        return;
      }
      if (session.revokedAt) {
        return;
      }

      session.revokedAt = new Date();
      session.revokedByUsuarioId = revokedByUsuarioId;
      await repository.save(session);
    });
  }

  private toResponse(
    session: AuthSession,
    current: boolean,
  ): AuthSessionResponseDto {
    return {
      id: session.id,
      current,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    };
  }

  private findForRotation(
    manager: EntityManager,
    refreshTokenHash: string,
  ): Promise<AuthSession | null> {
    return manager
      .getRepository(AuthSession)
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.usuario', 'usuario')
      .where('session.refreshTokenHash = :refreshTokenHash', {
        refreshTokenHash,
      })
      .setLock('pessimistic_write')
      .getOne();
  }

  private isUsable(session: AuthSession | null): session is AuthSession {
    return Boolean(
      session &&
      !session.revokedAt &&
      session.expiresAt.getTime() > Date.now() &&
      session.usuario.activo,
    );
  }
}
