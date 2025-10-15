import { BadRequestException, Body, Controller, NotFoundException, Post } from '@nestjs/common';

import { assertDefined, assertProp, check, isNumber, isString } from 'typeshaper';

import { Auth } from '../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../shared/telemetry.logger';

@Controller('test')
@Auth({ public: true })
export class AccountingTestController {
  #logger = new TelemetryLogger(AccountingTestController.name);

  constructor(private readonly repo: CryptogadaiRepository) {}

  @Post('setup-account-balance-by-email')
  async setupAccountBalanceByEmail(
    @Body()
    body: {
      email: string;
      currencyBlockchainKey: string;
      currencyTokenId: string;
      balance: string;
    },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email, currencyBlockchainKey, currencyTokenId, balance } = body;

    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    if (!currencyBlockchainKey || typeof currencyBlockchainKey !== 'string') {
      throw new BadRequestException('currencyBlockchainKey is required');
    }
    if (!currencyTokenId || typeof currencyTokenId !== 'string') {
      throw new BadRequestException('currencyTokenId is required');
    }
    if (!balance || typeof balance !== 'string') {
      throw new BadRequestException('balance is required');
    }

    const userRows = await this.repo.sql`
			SELECT id FROM users WHERE email = ${email}
		`;

    if (userRows.length === 0) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const user = userRows[0];
    assertDefined(user);
    assertProp(check(isString, isNumber), user, 'id');
    const userId = String(user.id);

    const { name, symbol, decimals } = this.#resolveCurrencyMeta(currencyTokenId);

    await this.repo.sql`
			INSERT INTO currencies (
				blockchain_key,
				token_id,
				name,
				symbol,
				decimals,
				image
			)
			VALUES (
				${currencyBlockchainKey},
				${currencyTokenId},
				${name},
				${symbol},
				${decimals},
				'https://assets.cryptogadai.com/currencies/default.png'
			)
			ON CONFLICT (blockchain_key, token_id)
			DO NOTHING
		`;

    await this.repo.sql`
			INSERT INTO user_accounts (
				user_id,
				currency_blockchain_key,
				currency_token_id,
				balance,
				account_type
			)
			VALUES (
				${userId},
				${currencyBlockchainKey},
				${currencyTokenId},
				0,
				'User'
			)
			ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type)
			DO NOTHING
		`;

    await this.repo.sql`
			INSERT INTO account_mutation_entries (
				user_id,
				currency_blockchain_key,
				currency_token_id,
				account_type,
				mutation_type,
				mutation_date,
				amount
			) VALUES (
				${userId},
				${currencyBlockchainKey},
				${currencyTokenId},
				'User',
				'InvoiceReceived',
				NOW(),
				${balance}
			)
		`;

    this.#logger.debug(
      `Set up account balance for user ${email}: ${balance} ${currencyTokenId} on ${currencyBlockchainKey}`,
    );

    return {
      success: true,
      message: `Account balance set up for ${email}`,
      userId: Number(userId),
      balance,
      currency: {
        blockchainKey: currencyBlockchainKey,
        tokenId: currencyTokenId,
      },
    };
  }

  @Post('setup-account-mutations-by-email')
  async setupAccountMutationsByEmail(
    @Body()
    body: {
      email: string;
      mutations: Array<{
        currencyBlockchainKey: string;
        currencyTokenId: string;
        mutationType: string;
        amount: string;
        mutationDate?: string;
      }>;
    },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email, mutations } = body;

    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    if (!mutations || !Array.isArray(mutations) || mutations.length === 0) {
      throw new BadRequestException('mutations array is required and must not be empty');
    }

    const userRows = await this.repo.sql`
			SELECT id FROM users WHERE email = ${email}
		`;

    if (userRows.length === 0) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const user = userRows[0];
    assertDefined(user);
    assertProp(check(isString, isNumber), user, 'id');
    const userId = String(user.id);

    for (const mutation of mutations) {
      const { currencyBlockchainKey, currencyTokenId, mutationType, amount, mutationDate } =
        mutation;

      if (!currencyBlockchainKey || typeof currencyBlockchainKey !== 'string') {
        throw new BadRequestException('currencyBlockchainKey is required for each mutation');
      }
      if (!currencyTokenId || typeof currencyTokenId !== 'string') {
        throw new BadRequestException('currencyTokenId is required for each mutation');
      }
      if (!mutationType || typeof mutationType !== 'string') {
        throw new BadRequestException('mutationType is required for each mutation');
      }
      if (!amount || typeof amount !== 'string') {
        throw new BadRequestException('amount is required for each mutation');
      }

      const effectiveMutationDate = mutationDate ? new Date(mutationDate) : new Date();

      const { name, symbol, decimals } = this.#resolveCurrencyMeta(currencyTokenId);

      await this.repo.sql`
				INSERT INTO currencies (
					blockchain_key,
					token_id,
					name,
					symbol,
					decimals,
					image
				)
				VALUES (
					${currencyBlockchainKey},
					${currencyTokenId},
					${name},
					${symbol},
					${decimals},
					'https://assets.cryptogadai.com/currencies/default.png'
				)
				ON CONFLICT (blockchain_key, token_id)
				DO NOTHING
			`;

      await this.repo.sql`
				INSERT INTO user_accounts (
					user_id,
					currency_blockchain_key,
					currency_token_id,
					balance,
					account_type
				)
				VALUES (
					${userId},
					${currencyBlockchainKey},
					${currencyTokenId},
					0,
					'User'
				)
				ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type)
				DO NOTHING
			`;

      await this.repo.sql`
				INSERT INTO account_mutation_entries (
					user_id,
					currency_blockchain_key,
					currency_token_id,
					account_type,
					mutation_type,
					mutation_date,
					amount
				) VALUES (
					${userId},
					${currencyBlockchainKey},
					${currencyTokenId},
					'User',
					${mutationType},
					${effectiveMutationDate},
					${amount}
				)
			`;
    }

    this.#logger.debug(`Set up ${mutations.length} account mutations for user ${email}`);

    return {
      success: true,
      message: `${mutations.length} account mutations set up for ${email}`,
      userId: Number(userId),
      mutationsCount: mutations.length,
    };
  }

  #resolveCurrencyMeta(tokenId: string) {
    let name = 'Test Currency';
    let symbol = 'TEST';
    let decimals = 18;

    if (tokenId === 'slip44:0') {
      name = 'Bitcoin';
      symbol = 'BTC';
      decimals = 8;
    } else if (tokenId === 'slip44:60') {
      name = 'Ethereum';
      symbol = 'ETH';
    } else if (tokenId.startsWith('erc20:0x8ac76a51')) {
      name = 'USD Coin';
      symbol = 'USDC';
    } else if (tokenId.startsWith('erc20:0x55d398')) {
      name = 'Tether USD';
      symbol = 'USDT';
    } else if (tokenId === 'slip44:501') {
      name = 'Solana';
      symbol = 'SOL';
      decimals = 9;
    } else if (tokenId === 'slip44:714') {
      name = 'Binance Coin';
      symbol = 'BNB';
    } else {
      symbol = tokenId.substring(0, 16);
    }

    return { name, symbol, decimals };
  }
}
