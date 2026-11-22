import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PasswordHashService } from '../auth/password-hash.service.js';
import { Empresa } from '../empresas/entities/empresa.entity.js';
import {
  EmpresaUsuario,
  type EmpresaUsuarioRol,
} from '../usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { INVITACION_INVALIDA_MESSAGE } from './dto/aceptar-invitacion.dto.js';
import type {
  AceptarInvitacionDto,
  InvitacionAceptadaResponseDto,
  InvitacionVerificadaResponseDto,
  VerificarInvitacionDto,
} from './dto/aceptar-invitacion.dto.js';
import { EmpresaInvitacion } from './entities/empresa-invitacion.entity.js';
import { InvitacionTokenService } from './invitacion-token.service.js';

@Injectable()
export class InvitacionesAceptacionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tokenService: InvitacionTokenService,
    private readonly passwordHashService: PasswordHashService,
  ) {}

  async verify(
    input: VerificarInvitacionDto,
  ): Promise<InvitacionVerificadaResponseDto> {
    const invitation = await this.dataSource
      .getRepository(EmpresaInvitacion)
      .createQueryBuilder('invitacion')
      .innerJoinAndSelect('invitacion.empresa', 'empresa')
      .where('invitacion.tokenHash = :tokenHash', {
        tokenHash: this.tokenService.hash(input.token),
      })
      .getOne();

    this.assertUsable(invitation);

    const accountExists = await this.dataSource
      .getRepository(Usuario)
      .existsBy({
        email: invitation.email,
      });

    return {
      empresaNombre: invitation.empresa.nombre,
      email: this.maskEmail(invitation.email),
      rol: invitation.rol,
      expiresAt: invitation.expiresAt,
      accountExists,
    };
  }

  async accept(
    input: AceptarInvitacionDto,
  ): Promise<InvitacionAceptadaResponseDto> {
    const tokenHash = this.tokenService.hash(input.token);

    await this.dataSource.transaction(async (manager) => {
      const candidate = await manager
        .getRepository(EmpresaInvitacion)
        .createQueryBuilder('invitacion')
        .select(['invitacion.id', 'invitacion.empresaId'])
        .where('invitacion.tokenHash = :tokenHash', { tokenHash })
        .getOne();
      if (!candidate) {
        throw this.invalidInvitation();
      }

      const empresa = await manager
        .getRepository(Empresa)
        .createQueryBuilder('empresa')
        .where('empresa.id = :empresaId', { empresaId: candidate.empresaId })
        .setLock('pessimistic_write')
        .getOne();

      const invitation = await manager
        .getRepository(EmpresaInvitacion)
        .createQueryBuilder('invitacion')
        .addSelect('invitacion.tokenHash')
        .where('invitacion.id = :invitationId', {
          invitationId: candidate.id,
        })
        .andWhere('invitacion.tokenHash = :tokenHash', { tokenHash })
        .setLock('pessimistic_write')
        .getOne();

      this.assertUsable(invitation, empresa);
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`invitation-user:${invitation.email}`],
      );

      const usuario = await this.findUserForAcceptance(
        manager,
        invitation.email,
      );
      const acceptedBy = usuario
        ? await this.acceptForExistingUser(manager, invitation, usuario, input)
        : await this.acceptForNewUser(manager, invitation, input);

      invitation.acceptedAt = new Date();
      invitation.acceptedByUsuarioId = acceptedBy.id;
      await manager.getRepository(EmpresaInvitacion).save(invitation);
    });

    return {
      accepted: true,
      message: 'Invitación aceptada. Ya puedes iniciar sesión.',
    };
  }

  private async acceptForExistingUser(
    manager: EntityManager,
    invitation: EmpresaInvitacion,
    usuario: Usuario,
    input: AceptarInvitacionDto,
  ): Promise<Usuario> {
    if (!usuario.activo) {
      throw new ForbiddenException('La cuenta no está disponible');
    }
    const validPassword = await this.passwordHashService.verifyPassword(
      input.password,
      usuario.passwordHash,
    );
    if (!validPassword) {
      throw new UnauthorizedException('No fue posible aceptar la invitación');
    }

    const membership = await this.findLockedMembership(
      manager,
      usuario.id,
      invitation.empresaId,
    );
    if (membership?.activo) {
      throw new ConflictException(
        'El usuario ya tiene una membresía activa en la empresa',
      );
    }
    if (membership) {
      membership.activo = true;
      membership.rol = invitation.rol;
      await manager.getRepository(EmpresaUsuario).save(membership);
    } else {
      await this.createMembership(
        manager,
        usuario.id,
        invitation.empresaId,
        invitation.rol,
      );
    }
    return usuario;
  }

  private async acceptForNewUser(
    manager: EntityManager,
    invitation: EmpresaInvitacion,
    input: AceptarInvitacionDto,
  ): Promise<Usuario> {
    if (!input.nombre) {
      throw new BadRequestException(
        'nombre es requerido para una cuenta nueva',
      );
    }
    const usuario = await manager.getRepository(Usuario).save(
      manager.getRepository(Usuario).create({
        email: invitation.email,
        nombre: input.nombre,
        passwordHash: await this.passwordHashService.hashPassword(
          input.password,
        ),
        activo: true,
      }),
    );
    await this.createMembership(
      manager,
      usuario.id,
      invitation.empresaId,
      invitation.rol,
    );
    return usuario;
  }

  private findUserForAcceptance(
    manager: EntityManager,
    email: string,
  ): Promise<Usuario | null> {
    return manager
      .getRepository(Usuario)
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('usuario.email = :email', { email })
      .setLock('pessimistic_write')
      .getOne();
  }

  private findLockedMembership(
    manager: EntityManager,
    usuarioId: string,
    empresaId: string,
  ): Promise<EmpresaUsuario | null> {
    return manager
      .getRepository(EmpresaUsuario)
      .createQueryBuilder('membresia')
      .where('membresia.usuarioId = :usuarioId', { usuarioId })
      .andWhere('membresia.empresaId = :empresaId', { empresaId })
      .setLock('pessimistic_write')
      .getOne();
  }

  private async createMembership(
    manager: EntityManager,
    usuarioId: string,
    empresaId: string,
    rol: EmpresaUsuarioRol,
  ): Promise<void> {
    await manager.getRepository(EmpresaUsuario).save(
      manager.getRepository(EmpresaUsuario).create({
        usuarioId,
        empresaId,
        rol,
        activo: true,
      }),
    );
  }

  private assertUsable(
    invitation: EmpresaInvitacion | null,
    empresa: Empresa | null = invitation?.empresa ?? null,
  ): asserts invitation is EmpresaInvitacion {
    if (!invitation?.isUsable(empresa?.activo === true)) {
      throw this.invalidInvitation();
    }
  }

  private invalidInvitation(): BadRequestException {
    return new BadRequestException(INVITACION_INVALIDA_MESSAGE);
  }

  private maskEmail(email: string): string {
    const separator = email.lastIndexOf('@');
    const local = email.slice(0, separator);
    const domain = email.slice(separator + 1);
    const visible = local.length === 1 ? '*' : `${local[0]}***`;
    return `${visible}@${domain}`;
  }
}
