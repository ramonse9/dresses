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
import { ClientesService } from './clientes.service.js';
import {
  parseCreateClienteBody,
  parseListClientesQuery,
  parseUpdateClienteBody,
  parseUpdateClienteEstadoBody,
  type PaginatedClientesResponseDto,
} from './dto/cliente.dto.js';
import { Cliente } from './entities/cliente.tenant-entity.js';

@Controller('clientes')
@TenantAuthenticated()
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  create(
    @CurrentTenant() tenant: TenantScope,
    @Body() body: unknown,
  ): Promise<Cliente> {
    return this.clientesService.create(tenant, parseCreateClienteBody(body));
  }

  @Get()
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findAll(
    @CurrentTenant() tenant: TenantScope,
    @Query() query: unknown,
  ): Promise<PaginatedClientesResponseDto> {
    return this.clientesService.findAll(tenant, parseListClientesQuery(query));
  }

  @Get(':id')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findOne(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Cliente> {
    return this.clientesService.findOne(tenant, id);
  }

  @Patch(':id/estado')
  @Roles(EmpresaUsuarioRol.OWNER)
  updateEstado(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<Cliente> {
    const input = parseUpdateClienteEstadoBody(body);
    return this.clientesService.updateEstado(tenant, id, input.activo);
  }

  @Patch(':id')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  update(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<Cliente> {
    return this.clientesService.update(
      tenant,
      id,
      parseUpdateClienteBody(body),
    );
  }

  @Delete(':id')
  @Roles(EmpresaUsuarioRol.OWNER)
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Cliente> {
    return this.clientesService.deactivate(tenant, id);
  }
}
