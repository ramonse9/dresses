import { Controller, Get } from '@nestjs/common';
import { AppHealth, AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): Promise<AppHealth> {
    return this.appService.getHealth();
  }
}
