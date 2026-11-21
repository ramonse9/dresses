import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { getAuthRateLimitOptions } from './auth-rate-limit.config.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getAuthRateLimitOptions,
    }),
  ],
  providers: [AuthRateLimitGuard],
  exports: [AuthRateLimitGuard, ThrottlerModule],
})
export class AuthRateLimitModule {}
