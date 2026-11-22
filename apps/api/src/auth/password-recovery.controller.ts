import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthRateLimit } from '../security/auth-rate-limit/auth-rate-limit.decorator.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../security/auth-rate-limit/auth-rate-limit.config.js';
import { AuthOriginGuard } from './auth-origin.guard.js';
import {
  type PasswordRecoveryPublicResponseDto,
  parseRequestPasswordRecoveryBody,
  parseResetPasswordBody,
} from './dto/password-recovery.dto.js';
import { PasswordRecoveryService } from './password-recovery.service.js';

@Controller('auth/password')
@UseGuards(AuthOriginGuard)
export class PasswordRecoveryController {
  constructor(private readonly service: PasswordRecoveryService) {}

  @Post('solicitar')
  @HttpCode(HttpStatus.ACCEPTED)
  @AuthRateLimit(AUTH_RATE_LIMIT_POLICIES.PASSWORD_RECOVERY_REQUEST)
  request(@Body() body: unknown): Promise<PasswordRecoveryPublicResponseDto> {
    return this.service.request(parseRequestPasswordRecoveryBody(body));
  }

  @Post('restablecer')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit(AUTH_RATE_LIMIT_POLICIES.PASSWORD_RESET)
  reset(@Body() body: unknown): Promise<PasswordRecoveryPublicResponseDto> {
    return this.service.reset(parseResetPasswordBody(body));
  }
}
