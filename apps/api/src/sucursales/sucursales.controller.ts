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
import { TenantAuthenticated } from '../auth/tenant-authenticated.decorator.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
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
  create(
    @CurrentTenant() tenant: TenantScope,
    @Body() body: unknown,
  ): Promise<Sucursal> {
    return this.sucursalesService.create(tenant, parseCreateSucursalBody(body));
  }

  @Get()
  findAll(@CurrentTenant() tenant: TenantScope): Promise<Sucursal[]> {
    return this.sucursalesService.findAll(tenant);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Sucursal> {
    return this.sucursalesService.findOne(tenant, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<Sucursal> {
    return this.sucursalesService.update(
      tenant,
      id,
      parseUpdateSucursalBody(body),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Sucursal> {
    return this.sucursalesService.deactivate(tenant, id);
  }
}
