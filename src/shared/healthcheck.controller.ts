import { Controller, Get, HttpCode } from '@nestjs/common';

import { Auth } from '../decorators/auth.decorator';

@Controller()
@Auth({ public: true })
export class HealthcheckController {
  @Get('/health')
  @HttpCode(200)
  healthCheck() {
    return { status: 'ok' };
  }
}
