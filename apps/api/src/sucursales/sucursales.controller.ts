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
import {
  parseCreateSucursalBody,
  parseEmpresaSlug,
  parseUpdateSucursalBody,
} from './dto/sucursal.dto.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';
import { SucursalesService } from './sucursales.service.js';

@Controller('empresas/:empresaSlug/sucursales')
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Post()
  create(
    @Param('empresaSlug') empresaSlug: string,
    @Body() body: unknown,
  ): Promise<Sucursal> {
    return this.sucursalesService.create(
      parseEmpresaSlug(empresaSlug),
      parseCreateSucursalBody(body),
    );
  }

  @Get()
  findAll(@Param('empresaSlug') empresaSlug: string): Promise<Sucursal[]> {
    return this.sucursalesService.findAll(parseEmpresaSlug(empresaSlug));
  }

  @Get(':id')
  findOne(
    @Param('empresaSlug') empresaSlug: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Sucursal> {
    return this.sucursalesService.findOne(parseEmpresaSlug(empresaSlug), id);
  }

  @Patch(':id')
  update(
    @Param('empresaSlug') empresaSlug: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<Sucursal> {
    return this.sucursalesService.update(
      parseEmpresaSlug(empresaSlug),
      id,
      parseUpdateSucursalBody(body),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Param('empresaSlug') empresaSlug: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Sucursal> {
    return this.sucursalesService.deactivate(parseEmpresaSlug(empresaSlug), id);
  }
}
