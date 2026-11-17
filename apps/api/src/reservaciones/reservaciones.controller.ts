import { Body, Controller, Post } from '@nestjs/common';
import { CurrentTenant } from '../auth/current-tenant.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantAuthenticated } from '../auth/tenant-authenticated.decorator.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { parseCreateReservacionBody } from './dto/create-reservacion.dto.js';
import type { ReservacionResponseDto } from './dto/reservacion-response.dto.js';
import { ReservacionesService } from './reservaciones.service.js';

@Controller('reservaciones')
@TenantAuthenticated()
export class ReservacionesController {
  constructor(private readonly reservacionesService: ReservacionesService) {}

  @Post()
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  create(
    @CurrentTenant() tenant: TenantScope,
    @Body() body: unknown,
  ): Promise<ReservacionResponseDto> {
    return this.reservacionesService.create(
      tenant,
      parseCreateReservacionBody(body),
    );
  }
}
