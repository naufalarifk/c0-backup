import { Controller, Get, HttpCode } from '@nestjs/common';

@Controller()
export class HealthcheckController {
  @Get('/health')
  @HttpCode(200)
  healthCheck() {
    return { status: 'ok' };
  }
}
