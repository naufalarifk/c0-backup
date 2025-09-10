import { Controller, Get } from '@nestjs/common';

import { CryptogadaiRepository } from './shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from './telemetry.logger';

@Controller()
export class TestController {
  #logger = new TelemetryLogger(TestController.name);

  constructor(private readonly repo: CryptogadaiRepository) {}

  @Get('test')
  getTest() {
    if (Math.random() < 0.2) {
      throw new Error('Random test error occurred');
    }

    const pendingKycs = this.repo.adminViewsPendingKYCs();

    this.#logger.debug(`Pending KYCs:`, pendingKycs);

    return {
      status: 'ok',
      message: 'This endpoint is expected to have 20% chance of error',
    };
  }
}
