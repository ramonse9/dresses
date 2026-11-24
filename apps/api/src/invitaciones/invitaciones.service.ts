import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  type QueryRunner,
  Repository,
} from 'typeorm';
import { Empresa } from '../empresas/entities/empresa.entity.js';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import { MailDeliveryError } from '../mail/mail.errors.js';
import {
  EmpresaUsuario,
  EmpresaUsuarioRol,
} from '../usuarios/entities/empresa-usuario.entity.js';
import {
  type CreateInvitacionDto,
  type InvitacionResponseDto,
  type ListInvitacionesQueryDto,
  type PaginatedInvitacionesResponseDto,
} from './dto/invitacion.dto.js';
import {
  EmpresaInvitacion,
  EmpresaInvitacionEstado,
} from './entities/empresa-invitacion.entity.js';
import { InvitacionMailService } from './invitacion-mail.service.js';
import { InvitacionTokenService } from './invitacion-token.service.js';
import {
  getInvitacionesConfiguration,
  type InvitacionesConfiguration,
} from './invitaciones.config.js';

type DeliveryToken = Readonly<{
  token: string;
  hash: string;
}>;

@Injectable()
export class InvitacionesService {
  private readonly configuration: InvitacionesConfiguration;

  constructor(
    @InjectRepository(EmpresaInvitacion)
    private readonly invitacionesRepository: Repository<EmpresaInvitacion>,
    private readonly dataSource: DataSource,
    configService: ConfigService,
    private readonly tokenService: InvitacionTokenService,
    private readonly mailService: InvitacionMailService,
    private readonly auditService: AuditService,
  ) {
    this.configuration = getInvitacionesConfiguration(configService);
  }

  async create(
    empresaId: string,
    creatorUsuarioId: string,
    input: CreateInvitacionDto,
    actorSessionId?: string,
  ): Promise<InvitacionResponseDto> {
    const generated = this.tokenService.generate();
    let invitation: EmpresaInvitacion;

    try {
      invitation = await this.dataSource.transaction(async (manager) => {
        await this.lockActiveEmpresaAndOwner(
          manager,
          empresaId,
          creatorUsuarioId,
        );
        await this.assertNoActiveMembership(manager, empresaId, input.email);

        const existing = await manager
          .getRepository(EmpresaInvitacion)
          .createQueryBuilder('invitacion')
          .where('invitacion.empresaId = :empresaId', { empresaId })
          .andWhere('invitacion.email = :email', { email: input.email })
          .andWhere('invitacion.acceptedAt IS NULL')
          .andWhere('invitacion.revokedAt IS NULL')
          .setLock('pessimistic_write')
          .getOne();
        const now = new Date();

        if (existing && existing.expiresAt.getTime() > now.getTime()) {
          throw new ConflictException(
            'Ya existe una invitación vigente para este email',
          );
        }
        if (existing) {
          existing.revokedAt = now;
          await manager.getRepository(EmpresaInvitacion).save(existing);
        }

        const created = await manager.getRepository(EmpresaInvitacion).save(
          manager.getRepository(EmpresaInvitacion).create({
            empresaId,
            email: input.email,
            rol: input.rol,
            tokenHash: generated.hash,
            expiresAt: this.expirationFrom(now),
            acceptedAt: null,
            acceptedByUsuarioId: null,
            revokedAt: null,
            createdByUsuarioId: creatorUsuarioId,
            lastSentAt: null,
            sendCount: 0,
          }),
        );
        await this.auditService.record(
          {
            empresaId,
            actorUsuarioId: creatorUsuarioId,
            sessionId: actorSessionId ?? null,
            action: AUDIT_ACTIONS.INVITATION_CREATED,
            resourceType: AUDIT_RESOURCE_TYPES.INVITATION,
            resourceId: created.id,
            metadata: { role: created.rol },
            safeMetadataFields: ['role'],
          },
          manager,
        );
        return created;
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (this.isPendingInvitationConflict(error)) {
        throw new ConflictException(
          'Ya existe una invitación vigente para este email',
        );
      }
      throw error;
    }

    return this.withInvitationLock(empresaId, invitation.id, (queryRunner) =>
      this.deliverAndRecord(
        queryRunner,
        empresaId,
        creatorUsuarioId,
        invitation.id,
        generated,
      ),
    );
  }

  async findAll(
    empresaId: string,
    input: ListInvitacionesQueryDto,
  ): Promise<PaginatedInvitacionesResponseDto> {
    const query = this.invitacionesRepository
      .createQueryBuilder('invitacion')
      .where('invitacion.empresaId = :empresaId', { empresaId });

    if (input.rol !== undefined) {
      query.andWhere('invitacion.rol = :rol', { rol: input.rol });
    }
    if (input.q !== undefined) {
      query.andWhere(`invitacion.email ILIKE :search ESCAPE '\\'`, {
        search: `%${this.escapeLikePattern(input.q)}%`,
      });
    }
    if (input.estado !== undefined) {
      this.applyStateFilter(query, input.estado);
    }

    const [invitations, total] = await query
      .orderBy('invitacion.createdAt', 'DESC')
      .addOrderBy('invitacion.id', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit)
      .getManyAndCount();

    return {
      data: invitations.map((invitation) => this.toResponse(invitation)),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  resend(
    empresaId: string,
    requesterUsuarioId: string,
    invitationId: string,
    actorSessionId?: string,
  ): Promise<InvitacionResponseDto> {
    return this.withInvitationLock(
      empresaId,
      invitationId,
      async (queryRunner) => {
        const generated = this.tokenService.generate();
        await this.runQueryRunnerTransaction(queryRunner, async (manager) => {
          await this.lockActiveEmpresaAndOwner(
            manager,
            empresaId,
            requesterUsuarioId,
          );
          const invitation = await this.requireLockedInvitation(
            manager,
            empresaId,
            invitationId,
            true,
          );
          this.assertPending(invitation);
          this.assertOutsideCooldown(invitation);

          invitation.tokenHash = generated.hash;
          invitation.expiresAt = this.expirationFrom(new Date());
          await manager.getRepository(EmpresaInvitacion).save(invitation);
          await this.auditService.record(
            {
              empresaId,
              actorUsuarioId: requesterUsuarioId,
              sessionId: actorSessionId ?? null,
              action: AUDIT_ACTIONS.INVITATION_RESENT,
              resourceType: AUDIT_RESOURCE_TYPES.INVITATION,
              resourceId: invitation.id,
              metadata: { role: invitation.rol },
              safeMetadataFields: ['role'],
            },
            manager,
          );
        });

        return this.deliverAndRecord(
          queryRunner,
          empresaId,
          requesterUsuarioId,
          invitationId,
          generated,
        );
      },
    );
  }

  revoke(
    empresaId: string,
    requesterUsuarioId: string,
    invitationId: string,
    actorSessionId?: string,
  ): Promise<InvitacionResponseDto> {
    return this.withInvitationLock(empresaId, invitationId, (queryRunner) =>
      this.runQueryRunnerTransaction(queryRunner, async (manager) => {
        await this.lockActiveEmpresaAndOwner(
          manager,
          empresaId,
          requesterUsuarioId,
        );
        const invitation = await this.requireLockedInvitation(
          manager,
          empresaId,
          invitationId,
        );

        if (invitation.acceptedAt !== null) {
          throw new ConflictException(
            'Una invitación aceptada no puede revocarse',
          );
        }
        if (invitation.revokedAt === null) {
          invitation.revokedAt = new Date();
          await manager.getRepository(EmpresaInvitacion).save(invitation);
          await this.auditService.record(
            {
              empresaId,
              actorUsuarioId: requesterUsuarioId,
              sessionId: actorSessionId ?? null,
              action: AUDIT_ACTIONS.INVITATION_REVOKED,
              resourceType: AUDIT_RESOURCE_TYPES.INVITATION,
              resourceId: invitation.id,
              metadata: { role: invitation.rol },
              safeMetadataFields: ['role'],
            },
            manager,
          );
        }
        return this.toResponse(invitation);
      }),
    );
  }

  private async deliverAndRecord(
    queryRunner: QueryRunner,
    empresaId: string,
    requesterUsuarioId: string,
    invitationId: string,
    deliveryToken: DeliveryToken,
  ): Promise<InvitacionResponseDto> {
    const delivery = await this.runQueryRunnerTransaction(
      queryRunner,
      async (manager) => {
        const empresa = await this.lockActiveEmpresaAndOwner(
          manager,
          empresaId,
          requesterUsuarioId,
        );
        const invitation = await this.requireLockedInvitation(
          manager,
          empresaId,
          invitationId,
          true,
        );
        this.assertPending(invitation);
        if (invitation.tokenHash !== deliveryToken.hash) {
          throw new ConflictException('La invitación cambió durante el envío');
        }
        return {
          email: invitation.email,
          rol: invitation.rol,
          empresaNombre: empresa.nombre,
        };
      },
    );

    try {
      await this.mailService.send({
        recipient: delivery.email,
        empresaNombre: delivery.empresaNombre,
        rol: delivery.rol,
        url: this.tokenService.buildAcceptanceUrl(deliveryToken.token),
      });
    } catch (error) {
      if (error instanceof MailDeliveryError) {
        throw new ServiceUnavailableException(
          'No fue posible enviar la invitación. Puedes intentar reenviarla.',
        );
      }
      throw error;
    }

    return this.runQueryRunnerTransaction(queryRunner, async (manager) => {
      const invitation = await this.requireLockedInvitation(
        manager,
        empresaId,
        invitationId,
        true,
      );
      this.assertPending(invitation);
      if (invitation.tokenHash !== deliveryToken.hash) {
        throw new ConflictException('La invitación cambió durante el envío');
      }

      invitation.lastSentAt = new Date();
      invitation.sendCount += 1;
      const saved = await manager
        .getRepository(EmpresaInvitacion)
        .save(invitation);
      return this.toResponse(saved);
    });
  }

  private async lockActiveEmpresaAndOwner(
    manager: EntityManager,
    empresaId: string,
    usuarioId: string,
  ): Promise<Empresa> {
    const empresa = await manager
      .getRepository(Empresa)
      .createQueryBuilder('empresa')
      .where('empresa.id = :empresaId', { empresaId })
      .setLock('pessimistic_write')
      .getOne();

    if (!empresa?.activo) {
      throw new ForbiddenException('Empresa no autorizada');
    }

    const owner = await manager
      .getRepository(EmpresaUsuario)
      .createQueryBuilder('membresia')
      .innerJoin('membresia.usuario', 'usuario')
      .where('membresia.empresaId = :empresaId', { empresaId })
      .andWhere('membresia.usuarioId = :usuarioId', { usuarioId })
      .andWhere('membresia.rol = :rol', { rol: EmpresaUsuarioRol.OWNER })
      .andWhere('membresia.activo = true')
      .andWhere('usuario.activo = true')
      .getOne();

    if (!owner) {
      throw new ForbiddenException('No tienes permisos para esta operación');
    }
    return empresa;
  }

  private async assertNoActiveMembership(
    manager: EntityManager,
    empresaId: string,
    email: string,
  ): Promise<void> {
    const membership = await manager
      .getRepository(EmpresaUsuario)
      .createQueryBuilder('membresia')
      .innerJoin('membresia.usuario', 'usuario')
      .where('membresia.empresaId = :empresaId', { empresaId })
      .andWhere('membresia.activo = true')
      .andWhere('usuario.email = :email', { email })
      .getOne();

    if (membership) {
      throw new ConflictException(
        'El usuario ya tiene una membresía activa en la empresa',
      );
    }
  }

  private async requireLockedInvitation(
    manager: EntityManager,
    empresaId: string,
    invitationId: string,
    includeTokenHash = false,
  ): Promise<EmpresaInvitacion> {
    const query = manager
      .getRepository(EmpresaInvitacion)
      .createQueryBuilder('invitacion')
      .where('invitacion.id = :invitationId', { invitationId })
      .andWhere('invitacion.empresaId = :empresaId', { empresaId })
      .setLock('pessimistic_write');
    if (includeTokenHash) {
      query.addSelect('invitacion.tokenHash');
    }
    const invitation = await query.getOne();

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }
    return invitation;
  }

  private assertPending(invitation: EmpresaInvitacion): void {
    if (invitation.getEstado() !== EmpresaInvitacionEstado.PENDIENTE) {
      throw new ConflictException('La invitación ya no está pendiente');
    }
  }

  private assertOutsideCooldown(invitation: EmpresaInvitacion): void {
    if (!invitation.lastSentAt) {
      return;
    }
    const availableAt =
      invitation.lastSentAt.getTime() +
      this.configuration.resendCooldownSeconds * 1_000;
    if (availableAt > Date.now()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Debes esperar antes de reenviar la invitación',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private expirationFrom(now: Date): Date {
    return new Date(now.getTime() + this.configuration.ttlSeconds * 1_000);
  }

  private applyStateFilter(
    query: ReturnType<Repository<EmpresaInvitacion>['createQueryBuilder']>,
    state: EmpresaInvitacionEstado,
  ): void {
    if (state === EmpresaInvitacionEstado.ACEPTADA) {
      query.andWhere('invitacion.acceptedAt IS NOT NULL');
      return;
    }
    query.andWhere('invitacion.acceptedAt IS NULL');
    if (state === EmpresaInvitacionEstado.REVOCADA) {
      query.andWhere('invitacion.revokedAt IS NOT NULL');
      return;
    }
    query.andWhere('invitacion.revokedAt IS NULL');
    query.andWhere(
      state === EmpresaInvitacionEstado.PENDIENTE
        ? 'invitacion.expiresAt > CURRENT_TIMESTAMP'
        : 'invitacion.expiresAt <= CURRENT_TIMESTAMP',
    );
  }

  private async withInvitationLock<T>(
    empresaId: string,
    invitationId: string,
    operation: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    const lockKey = `empresa-invitacion:${empresaId}:${invitationId}`;
    await queryRunner.connect();
    let locked = false;

    try {
      await queryRunner.query(
        'SELECT pg_advisory_lock(hashtextextended($1, 0))',
        [lockKey],
      );
      locked = true;
      return await operation(queryRunner);
    } finally {
      if (locked) {
        await queryRunner
          .query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [
            lockKey,
          ])
          .catch(() => undefined);
      }
      await queryRunner.release();
    }
  }

  private async runQueryRunnerTransaction<T>(
    queryRunner: QueryRunner,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    await queryRunner.startTransaction();
    try {
      const result = await operation(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    }
  }

  private toResponse(invitation: EmpresaInvitacion): InvitacionResponseDto {
    return {
      id: invitation.id,
      empresaId: invitation.empresaId,
      email: invitation.email,
      rol: invitation.rol,
      estado: invitation.getEstado(),
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      acceptedByUsuarioId: invitation.acceptedByUsuarioId,
      revokedAt: invitation.revokedAt,
      createdByUsuarioId: invitation.createdByUsuarioId,
      lastSentAt: invitation.lastSentAt,
      sendCount: invitation.sendCount,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }

  private escapeLikePattern(value: string): string {
    return value
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_');
  }

  private isPendingInvitationConflict(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as {
      code?: string;
      constraint?: string;
    };
    return (
      driverError.code === '23505' &&
      driverError.constraint ===
        'UQ_empresa_invitaciones_pendiente_empresa_email'
    );
  }
}
