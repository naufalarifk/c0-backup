import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { assertDefined, assertProp, check, isNumber, isString } from 'typeshaper';

import { Auth } from '../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';

@Controller('test')
@Auth({ public: true })
export class FinanceTestController {
  #logger = new TelemetryLogger(FinanceTestController.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly repo: CryptogadaiRepository,
  ) {}

  @Post('adjust-account-balance')
  async adjustAccountBalance(
    @Body()
    body: {
      userId: string;
      currencyBlockchainKey: string;
      currencyTokenId: string;
      amount: string;
      mutationDate?: string;
    },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    const { userId, currencyBlockchainKey, currencyTokenId, amount, mutationDate } = body;

    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('userId is required');
    }
    if (!currencyBlockchainKey || typeof currencyBlockchainKey !== 'string') {
      throw new BadRequestException('currencyBlockchainKey is required');
    }
    if (!currencyTokenId || typeof currencyTokenId !== 'string') {
      throw new BadRequestException('currencyTokenId is required');
    }
    if (!amount || typeof amount !== 'string') {
      throw new BadRequestException('amount is required');
    }

    const effectiveMutationDate = mutationDate ? new Date(mutationDate) : new Date();

    const result = await this.repo.testAdjustsAccountBalance({
      userId,
      currencyBlockchainKey,
      currencyTokenId,
      amount,
      mutationDate: effectiveMutationDate,
    });

    this.#logger.debug(
      `Adjusted account balance for user ${userId}: ${amount} ${currencyTokenId} on ${currencyBlockchainKey}`,
    );

    return {
      success: true,
      message: `Account balance adjusted for user ${userId}`,
      result,
    };
  }
}
