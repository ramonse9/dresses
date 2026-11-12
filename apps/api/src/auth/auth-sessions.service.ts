import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { getRefreshTokenTtlSeconds } from './auth.config.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { RefreshTokenService } from './refresh-token.service.js';

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

  async create(usuarioId: string): Promise<IssuedSession> {
    const issuedToken = this.refreshTokenService.issue();
    const ttlSeconds = getRefreshTokenTtlSeconds(this.configService);
    const session = this.sessionsRepository.create({
      id: randomUUID(),
      usuarioId,
      refreshTokenHash: issuedToken.hash,
      expiresAt: new Date(Date.now() + ttlSeconds * 1_000),
      revokedAt: null,
    });

    await this.sessionsRepository.save(session);
    return { session, refreshToken: issuedToken.token };
  }

  async rotate(refreshToken: string): Promise<Required<IssuedSession>> {
    const presentedHash = this.refreshTokenService.hash(refreshToken);

    return this.dataSource.transaction(async (manager) => {
      const session = await this.findForRotation(manager, presentedHash);

      if (!this.isUsable(session)) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      const issuedToken = this.refreshTokenService.issue();
      session.refreshTokenHash = issuedToken.hash;
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

  async revoke(sessionId: string, usuarioId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AuthSession);
      const session = await repository
        .createQueryBuilder('session')
        .where('session.id = :sessionId', { sessionId })
        .andWhere('session.usuarioId = :usuarioId', { usuarioId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session || session.revokedAt) {
        return;
      }

      session.revokedAt = new Date();
      await repository.save(session);
    });
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
