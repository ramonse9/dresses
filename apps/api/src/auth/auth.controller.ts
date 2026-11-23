import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthRateLimit } from '../security/auth-rate-limit/auth-rate-limit.decorator.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../security/auth-rate-limit/auth-rate-limit.config.js';
import { AuthOriginGuard } from './auth-origin.guard.js';
import { AccessTokenResponse, AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { assertEmptyAuthBody } from './dto/empty-auth-body.js';
import type { EmpresaAccessDto } from './dto/empresa-access.dto.js';
import { parseLoginBody } from './dto/login.dto.js';
import { parseSelectEmpresaBody } from './dto/select-empresa.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RefreshTokenCookieService } from './refresh-token-cookie.service.js';
import type { AccessTokenPayload } from './types/access-token-payload.js';
import { sessionMetadataFromRequest } from './session-metadata.js';

@Controller('auth')
@UseGuards(AuthOriginGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenCookie: RefreshTokenCookieService,
  ) {}

  @Post('login')
  @AuthRateLimit(AUTH_RATE_LIMIT_POLICIES.LOGIN)
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponse> {
    const { refreshToken, ...accessToken } = await this.authService.login(
      parseLoginBody(body),
      sessionMetadataFromRequest(request),
    );

    this.refreshTokenCookie.write(response, refreshToken);
    return accessToken;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenResponse> {
    assertEmptyAuthBody(body);
    const currentRefreshToken = this.refreshTokenCookie.read(request);
    const { refreshToken, ...accessToken } = await this.authService.refresh(
      currentRefreshToken,
      sessionMetadataFromRequest(request),
    );

    this.refreshTokenCookie.write(response, refreshToken);
    return accessToken;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(user);
    this.refreshTokenCookie.clear(response);
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
