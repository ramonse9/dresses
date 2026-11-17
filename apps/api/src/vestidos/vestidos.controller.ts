import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentTenant } from '../auth/current-tenant.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantAuthenticated } from '../auth/tenant-authenticated.decorator.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { parseCreateVestidoBody } from './dto/create-vestido.dto.js';
import { parseDisponibilidadVestidosQuery } from './dto/disponibilidad-vestidos-query.dto.js';
import { parseListVestidosQuery } from './dto/list-vestidos-query.dto.js';
import type {
  DisponibilidadVestidosResponseDto,
  PaginatedVestidosResponseDto,
  VestidoResponseDto,
} from './dto/vestido-response.dto.js';
import { parseUpdateVestidoBody } from './dto/update-vestido.dto.js';
import { Vestido } from './entities/vestido.tenant-entity.js';
import { VestidosService } from './vestidos.service.js';

@Controller('vestidos')
@TenantAuthenticated()
export class VestidosController {
  constructor(private readonly vestidosService: VestidosService) {}

  @Post()
  @Roles(EmpresaUsuarioRol.OWNER)
  create(
    @CurrentTenant() tenant: TenantScope,
    @Body() body: unknown,
  ): Promise<Vestido> {
    return this.vestidosService.create(tenant, parseCreateVestidoBody(body));
  }

  @Get()
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findAll(
    @CurrentTenant() tenant: TenantScope,
    @Query() query: unknown,
  ): Promise<PaginatedVestidosResponseDto> {
    return this.vestidosService.findAll(tenant, parseListVestidosQuery(query));
  }

  @Get('disponibilidad')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findAvailability(
    @CurrentTenant() tenant: TenantScope,
    @Query() query: unknown,
  ): Promise<DisponibilidadVestidosResponseDto> {
    return this.vestidosService.findAvailability(
      tenant,
      parseDisponibilidadVestidosQuery(query),
    );
  }

  @Get(':id')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findOne(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<VestidoResponseDto> {
    return this.vestidosService.findOne(tenant, id);
  }

  @Patch(':id')
  @Roles(EmpresaUsuarioRol.OWNER)
  update(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<Vestido> {
    return this.vestidosService.update(
      tenant,
      id,
      parseUpdateVestidoBody(body),
    );
  }

  @Delete(':id')
  @Roles(EmpresaUsuarioRol.OWNER)
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Vestido> {
    return this.vestidosService.deactivate(tenant, id);
  }
}
