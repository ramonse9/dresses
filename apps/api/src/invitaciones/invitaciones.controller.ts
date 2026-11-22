import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentTenant } from '../auth/current-tenant.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantAuthenticated } from '../auth/tenant-authenticated.decorator.js';
import type { AccessTokenPayload } from '../auth/types/access-token-payload.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import {
  assertEmptyInvitacionBody,
  parseCreateInvitacionBody,
  parseListInvitacionesQuery,
  type InvitacionResponseDto,
  type PaginatedInvitacionesResponseDto,
} from './dto/invitacion.dto.js';
import { InvitacionesService } from './invitaciones.service.js';

@Controller('equipo/invitaciones')
@TenantAuthenticated()
@Roles(EmpresaUsuarioRol.OWNER)
export class InvitacionesController {
  constructor(private readonly invitacionesService: InvitacionesService) {}

  @Post()
  create(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ): Promise<InvitacionResponseDto> {
    return this.invitacionesService.create(
      tenant.empresaId,
      user.sub,
      parseCreateInvitacionBody(body),
    );
  }

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantScope,
    @Query() query: unknown,
  ): Promise<PaginatedInvitacionesResponseDto> {
    return this.invitacionesService.findAll(
      tenant.empresaId,
      parseListInvitacionesQuery(query),
    );
  }

  @Post(':id/reenviar')
  resend(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<InvitacionResponseDto> {
    assertEmptyInvitacionBody(body);
    return this.invitacionesService.resend(tenant.empresaId, user.sub, id);
  }

  @Delete(':id')
  revoke(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<InvitacionResponseDto> {
    assertEmptyInvitacionBody(body);
    return this.invitacionesService.revoke(tenant.empresaId, user.sub, id);
  }
}
