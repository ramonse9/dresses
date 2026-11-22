import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthOriginGuard } from '../auth/auth-origin.guard.js';
import { AuthRateLimit } from '../security/auth-rate-limit/auth-rate-limit.decorator.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../security/auth-rate-limit/auth-rate-limit.config.js';
import {
  type InvitacionAceptadaResponseDto,
  type InvitacionVerificadaResponseDto,
  parseAceptarInvitacionBody,
  parseVerificarInvitacionBody,
} from './dto/aceptar-invitacion.dto.js';
import { InvitacionesAceptacionService } from './invitaciones-aceptacion.service.js';

@Controller('auth/invitaciones')
@UseGuards(AuthOriginGuard)
export class InvitacionesPublicasController {
  constructor(
    private readonly aceptacionService: InvitacionesAceptacionService,
  ) {}

  @Post('verificar')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit(AUTH_RATE_LIMIT_POLICIES.INVITATION_VERIFICATION)
  verificar(@Body() body: unknown): Promise<InvitacionVerificadaResponseDto> {
    return this.aceptacionService.verify(parseVerificarInvitacionBody(body));
  }

  @Post('aceptar')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit(AUTH_RATE_LIMIT_POLICIES.INVITATION_ACCEPTANCE)
  aceptar(@Body() body: unknown): Promise<InvitacionAceptadaResponseDto> {
    return this.aceptacionService.accept(parseAceptarInvitacionBody(body));
  }
}
