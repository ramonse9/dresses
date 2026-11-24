import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentTenant } from '../auth/current-tenant.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantAuthenticated } from '../auth/tenant-authenticated.decorator.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import {
  type AuditEventResponseDto,
  type PaginatedAuditEventsResponseDto,
  parseListAuditEventsQuery,
} from './dto/auditoria.dto.js';
import { AuditoriaService } from './auditoria.service.js';

@Controller('auditoria')
@TenantAuthenticated()
@Roles(EmpresaUsuarioRol.OWNER)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantScope,
    @Query() query: unknown,
  ): Promise<PaginatedAuditEventsResponseDto> {
    return this.auditoriaService.findAll(
      tenant.empresaId,
      parseListAuditEventsQuery(query),
    );
  }

  @Get(':id')
  findOne(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AuditEventResponseDto> {
    return this.auditoriaService.findOne(tenant.empresaId, id);
  }
}
