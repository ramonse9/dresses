import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentTenant } from '../auth/current-tenant.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantAuthenticated } from '../auth/tenant-authenticated.decorator.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import {
  parseListMiembrosQuery,
  parseUpdateMiembroEstadoBody,
  parseUpdateMiembroRolBody,
  type MiembroResponseDto,
  type PaginatedMiembrosResponseDto,
} from './dto/miembro.dto.js';
import { EquipoService } from './equipo.service.js';

@Controller('equipo/miembros')
@TenantAuthenticated()
@Roles(EmpresaUsuarioRol.OWNER)
export class EquipoController {
  constructor(private readonly equipoService: EquipoService) {}

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantScope,
    @Query() query: unknown,
  ): Promise<PaginatedMiembrosResponseDto> {
    return this.equipoService.findAll(
      tenant.empresaId,
      parseListMiembrosQuery(query),
    );
  }

  @Get(':id')
  findOne(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<MiembroResponseDto> {
    return this.equipoService.findOne(tenant.empresaId, id);
  }

  @Patch(':id/rol')
  updateRol(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<MiembroResponseDto> {
    const input = parseUpdateMiembroRolBody(body);
    return this.equipoService.updateRol(tenant.empresaId, id, input.rol);
  }

  @Patch(':id/estado')
  updateEstado(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<MiembroResponseDto> {
    const input = parseUpdateMiembroEstadoBody(body);
    return this.equipoService.updateEstado(tenant.empresaId, id, input.activo);
  }
}
