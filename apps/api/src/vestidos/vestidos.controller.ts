import { Body, Controller, Post } from '@nestjs/common';
import { CurrentTenant } from '../auth/current-tenant.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantAuthenticated } from '../auth/tenant-authenticated.decorator.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { parseCreateVestidoBody } from './dto/create-vestido.dto.js';
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
}
