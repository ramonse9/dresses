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
} from '@nestjs/common';
import { CurrentTenant } from '../auth/current-tenant.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantAuthenticated } from '../auth/tenant-authenticated.decorator.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { AccessTokenPayload } from '../auth/types/access-token-payload.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import {
  parseCreateSucursalBody,
  parseUpdateSucursalBody,
} from './dto/sucursal.dto.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';
import { SucursalesService } from './sucursales.service.js';

@Controller('sucursales')
@TenantAuthenticated()
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Post()
  @Roles(EmpresaUsuarioRol.OWNER)
  create(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ): Promise<Sucursal> {
    return this.sucursalesService.create(
      tenant,
      parseCreateSucursalBody(body),
      this.auditActor(user),
    );
  }

  @Get()
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findAll(@CurrentTenant() tenant: TenantScope): Promise<Sucursal[]> {
    return this.sucursalesService.findAll(tenant);
  }

  @Get(':id')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findOne(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Sucursal> {
    return this.sucursalesService.findOne(tenant, id);
  }

  @Patch(':id')
  @Roles(EmpresaUsuarioRol.OWNER)
  update(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<Sucursal> {
    return this.sucursalesService.update(
      tenant,
      id,
      parseUpdateSucursalBody(body),
      this.auditActor(user),
    );
  }

  @Delete(':id')
  @Roles(EmpresaUsuarioRol.OWNER)
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Sucursal> {
    return this.sucursalesService.deactivate(tenant, id, this.auditActor(user));
  }

  private auditActor(user: AccessTokenPayload) {
    return { actorUsuarioId: user.sub, sessionId: user.sessionId };
  }
}
