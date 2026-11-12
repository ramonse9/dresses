import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService, LoginResponse } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { parseLoginBody } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AccessTokenPayload } from './types/access-token-payload.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: unknown): Promise<LoginResponse> {
    return this.authService.login(parseLoginBody(body));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AccessTokenPayload): AccessTokenPayload {
    return this.authService.getProfile(user);
  }
}
