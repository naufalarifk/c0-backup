import { Body, Controller, Get, Post } from '@nestjs/common';

import { Auth } from '../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';

@Controller('test')
@Auth({ public: true })
export class UserTestController {
  #logger = new TelemetryLogger(UserTestController.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly repo: CryptogadaiRepository,
  ) {}

  @Get('test')
  getTest() {
    if (Math.random() < 0.2) {
      throw new Error('Random test error occurred');
    }

    const pendingKycs = this.repo.adminViewsPendingKYCs();

    this.#logger.debug('Pending KYCs:', pendingKycs);

    return {
      status: 'ok',
      message: 'This endpoint is expected to have 20% chance of error',
    };
  }

  @Post('create-test-users')
  async createTestUsers(
    @Body() body: { users: Array<{ email: string; name: string; role?: string }> },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    const { users } = body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      throw new Error('users array is required');
    }

    const result = await this.repo.testCreatesUsers({ users });

    this.#logger.debug(`Created ${result.users.length} test users`);

    return {
      success: true,
      message: `Created ${result.users.length} test users`,
      users: result.users,
    };
  }
}
