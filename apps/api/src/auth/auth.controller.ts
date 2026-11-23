import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthRateLimit } from '../security/auth-rate-limit/auth-rate-limit.decorator.js';
import { AUTH_RATE_LIMIT_POLICIES } from '../security/auth-rate-limit/auth-rate-limit.config.js';
import { AuthOriginGuard } from './auth-origin.guard.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { AccessTokenResponse, AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { assertEmptyAuthBody } from './dto/empty-auth-body.js';
import {
  assertEmptyAuthSessionsQuery,
  parseListAuthSessionsQuery,
  type AuthSessionResponseDto,
  type RevokeOtherSessionsResponseDto,
} from './dto/auth-session.dto.js';
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
    private readonly authSessionsService: AuthSessionsService,
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

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  sessions(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: unknown,
  ): Promise<AuthSessionResponseDto[]> {
    return this.authSessionsService.findOwned(
      user.sub,
      user.sessionId,
      parseListAuthSessionsQuery(query),
    );
  }

  @Post('sessions/revocar-otras')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: unknown,
    @Query() query: unknown,
  ): Promise<RevokeOtherSessionsResponseDto> {
    assertEmptyAuthBody(body);
    assertEmptyAuthSessionsQuery(query);
    return {
      revokedCount: await this.authSessionsService.revokeOthers(
        user.sub,
        user.sessionId,
      ),
    };
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    assertEmptyAuthBody(body);
    assertEmptyAuthSessionsQuery(query);
    await this.authSessionsService.revokeOwned(id, user.sub, user.sub);
    if (id === user.sessionId) {
      this.refreshTokenCookie.clear(response);
    }
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
