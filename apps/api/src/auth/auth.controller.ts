import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AccessTokenResponse,
  AuthService,
  LoginResponse,
} from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import type { EmpresaAccessDto } from './dto/empresa-access.dto.js';
import { parseLoginBody } from './dto/login.dto.js';
import { parseRefreshTokenBody } from './dto/refresh-token.dto.js';
import { parseSelectEmpresaBody } from './dto/select-empresa.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AccessTokenPayload } from './types/access-token-payload.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: unknown): Promise<LoginResponse> {
    return this.authService.login(parseLoginBody(body));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown): Promise<LoginResponse> {
    return this.authService.refresh(parseRefreshTokenBody(body));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: AccessTokenPayload): Promise<void> {
    return this.authService.logout(user);
  }

  @Get('empresas')
  @UseGuards(JwtAuthGuard)
  empresas(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<EmpresaAccessDto[]> {
    return this.authService.listEmpresas(user);
  }

  @Post('select-empresa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  selectEmpresa(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
  ): Promise<AccessTokenResponse> {
    return this.authService.selectEmpresa(user, parseSelectEmpresaBody(body));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AccessTokenPayload): AccessTokenPayload {
    return this.authService.getProfile(user);
  }
}
