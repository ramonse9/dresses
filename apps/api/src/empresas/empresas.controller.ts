import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DevTenantAdminGuard } from './dev-tenant-admin.guard.js';
import {
  CreateEmpresaDto,
  parseCreateEmpresaBody,
} from './dto/create-empresa.dto.js';
import { Empresa } from './entities/empresa.entity.js';
import { EmpresasService } from './empresas.service.js';

@Controller('empresas')
@UseGuards(DevTenantAdminGuard)
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Post()
  create(@Body() body: unknown): Promise<Empresa> {
    const input: CreateEmpresaDto = parseCreateEmpresaBody(body);
    return this.empresasService.create(input);
  }
}
