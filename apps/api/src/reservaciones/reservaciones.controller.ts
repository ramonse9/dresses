import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentTenant } from '../auth/current-tenant.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantAuthenticated } from '../auth/tenant-authenticated.decorator.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { AccessTokenPayload } from '../auth/types/access-token-payload.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { parseCancelReservacionBody } from './dto/cancel-reservacion.dto.js';
import { parseCreateReservacionBody } from './dto/create-reservacion.dto.js';
import { parseListMovimientosFinancierosQuery } from './dto/list-movimientos-financieros-query.dto.js';
import { parseListReservacionesQuery } from './dto/list-reservaciones-query.dto.js';
import type {
  PaginatedMovimientosFinancierosResponseDto,
  ReservacionFinanzasResponseDto,
} from './dto/reservacion-finanzas-response.dto.js';
import type {
  PaginatedReservacionesResponseDto,
  ReservacionResponseDto,
} from './dto/reservacion-response.dto.js';
import { parseUpdateReservacionBody } from './dto/update-reservacion.dto.js';
import { ReservacionesService } from './reservaciones.service.js';

@Controller('reservaciones')
@TenantAuthenticated()
export class ReservacionesController {
  constructor(private readonly reservacionesService: ReservacionesService) {}

  @Post()
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  create(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ): Promise<ReservacionResponseDto> {
    return this.reservacionesService.create(
      tenant,
      parseCreateReservacionBody(body),
      this.auditActor(user),
    );
  }

  @Get()
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findAll(
    @CurrentTenant() tenant: TenantScope,
    @Query() query: unknown,
  ): Promise<PaginatedReservacionesResponseDto> {
    return this.reservacionesService.findAll(
      tenant,
      parseListReservacionesQuery(query),
    );
  }

  @Get(':id')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findOne(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReservacionResponseDto> {
    return this.reservacionesService.findOne(tenant, id);
  }

  @Get(':id/finanzas')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findFinances(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReservacionFinanzasResponseDto> {
    return this.reservacionesService.findFinances(tenant, id);
  }

  @Get(':id/movimientos')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  findFinancialMovements(
    @CurrentTenant() tenant: TenantScope,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: unknown,
  ): Promise<PaginatedMovimientosFinancierosResponseDto> {
    return this.reservacionesService.findFinancialMovements(
      tenant,
      id,
      parseListMovimientosFinancierosQuery(query),
    );
  }

  @Patch(':id')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  update(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<ReservacionResponseDto> {
    return this.reservacionesService.update(
      tenant,
      id,
      parseUpdateReservacionBody(body),
      this.auditActor(user),
    );
  }

  @Post(':id/confirmar')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  confirm(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReservacionResponseDto> {
    return this.reservacionesService.confirm(tenant, id, this.auditActor(user));
  }

  @Post(':id/entregar')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  deliver(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReservacionResponseDto> {
    return this.reservacionesService.deliver(tenant, id, this.auditActor(user));
  }

  @Post(':id/devolver')
  @Roles(EmpresaUsuarioRol.OWNER, EmpresaUsuarioRol.EMPLOYEE)
  returnReservation(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ReservacionResponseDto> {
    return this.reservacionesService.returnReservation(
      tenant,
      id,
      this.auditActor(user),
    );
  }

  @Post(':id/cancelar')
  @Roles(EmpresaUsuarioRol.OWNER)
  cancel(
    @CurrentTenant() tenant: TenantScope,
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<ReservacionResponseDto> {
    return this.reservacionesService.cancel(
      tenant,
      id,
      parseCancelReservacionBody(body),
      this.auditActor(user),
    );
  }

  private auditActor(user: AccessTokenPayload) {
    return { actorUsuarioId: user.sub, sessionId: user.sessionId };
  }
}
