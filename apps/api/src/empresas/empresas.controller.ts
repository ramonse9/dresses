import { Body, Controller, Post } from '@nestjs/common';
import {
  CreateEmpresaDto,
  parseCreateEmpresaBody,
} from './dto/create-empresa.dto.js';
import { Empresa } from './entities/empresa.entity.js';
import { EmpresasService } from './empresas.service.js';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Post()
  create(@Body() body: unknown): Promise<Empresa> {
    const input: CreateEmpresaDto = parseCreateEmpresaBody(body);
    return this.empresasService.create(input);
  }
}
