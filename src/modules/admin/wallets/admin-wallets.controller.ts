import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { assertDefined, assertPropNumber, assertPropString } from 'typeshaper';

import { Auth } from '../../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { WalletFactory } from '../../../shared/wallets/wallet.factory';

@Controller('admin/wallets')
@ApiTags('Admin - Wallet Management')
@Auth(['Admin'])
export class AdminWalletsController {
  private readonly logger = new TelemetryLogger(AdminWalletsController.name);

  constructor(
    private readonly repository: CryptogadaiRepository,
    private readonly walletFactory: WalletFactory,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all active wallet addresses',
    description:
      'Retrieve all active wallet addresses including hot wallets and invoice wallets across all blockchains',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet addresses retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            hotWallets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  blockchainKey: { type: 'string', example: 'eip155:56' },
                  address: { type: 'string', example: '0x742d35Cc6634C0532925a3b844c16c' },
                  derivationPath: { type: 'string', example: "m/44'/60'/0'/0/0" },
                  type: { type: 'string', example: 'hot_wallet' },
                },
              },
            },
            invoiceWallets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  blockchainKey: {
                    type: 'string',
                    example: 'eip155:56',
                    description: 'Blockchain identifier',
                  },
                  currencyTokenId: {
                    type: 'string',
                    example: 'slip44:714',
                    description: 'Currency token identifier',
                  },
                  address: {
                    type: 'string',
                    example: '0x742d35Cc6634C0532925a3b844c16c',
                    description: 'Wallet address',
                  },
                  derivationPath: {
                    type: 'string',
                    example: "m/44'/60'/0'/0/123",
                    description: 'BIP44 derivation path',
                  },
                  invoiceId: { type: 'number', example: 123, description: 'Associated invoice ID' },
                  type: { type: 'string', example: 'invoice_wallet' },
                },
              },
            },
            statistics: {
              type: 'object',
              properties: {
                totalHotWallets: { type: 'number', example: 5 },
                totalInvoiceWallets: { type: 'number', example: 15 },
                blockchainDistribution: {
                  type: 'object',
                  additionalProperties: { type: 'number' },
                  example: {
                    'eip155:56': 5,
                    'eip155:1': 8,
                    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 2,
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  async listWallets() {
    try {
      this.logger.log('Admin requesting wallet list');

      // Fetch all blockchains information
      const blockchainRows = await this.repository.sql`
        SELECT
          key,
          name,
          short_name AS "shortName",
          image
        FROM blockchains
        WHERE key != 'crosschain'
      `;

      const blockchainMap = new Map<string, { name: string; shortName: string; image: string }>();
      for (const row of blockchainRows) {
        assertDefined(row);
        assertPropString(row, 'key');
        assertPropString(row, 'name');
        assertPropString(row, 'shortName');
        assertPropString(row, 'image');
        blockchainMap.set(row.key, {
          name: row.name,
          shortName: row.shortName,
          image: row.image,
        });
      }

      // Fetch all currencies information
      const currencyRows = await this.repository.sql`
        SELECT
          blockchain_key,
          token_id,
          name,
          symbol,
          decimals,
          image
        FROM currencies
        ORDER BY blockchain_key, token_id
      `;

      const currencyMap = new Map<
        string,
        {
          name: string;
          symbol: string;
          decimals: number;
          image: string;
        }
      >();
      for (const row of currencyRows) {
        assertDefined(row);
        assertPropString(row, 'blockchain_key');
        assertPropString(row, 'token_id');
        assertPropString(row, 'name');
        assertPropString(row, 'symbol');
        assertPropNumber(row, 'decimals');
        assertPropString(row, 'image');
        const key = `${row.blockchain_key}:${row.token_id}`;
        currencyMap.set(key, {
          name: row.name,
          symbol: row.symbol,
          decimals: row.decimals,
          image: row.image,
        });
      }

      const allBlockchains = this.walletFactory.getAllBlockchains();

      // Get root addresses (hot wallets) for each blockchain
      const hotWallets: Array<{
        blockchainKey: string;
        blockchain: {
          name: string;
          shortName: string;
          image: string;
        };
        address: string;
        derivationPath: string;
        type: 'hot_wallet';
      }> = [];

      for (const { blockchainKey, blockchain } of allBlockchains) {
        try {
          const hotWallet = await blockchain.getHotWallet();
          const address = await hotWallet.getAddress();
          const derivationPath = `m/44'/${blockchain.bip44CoinType}'/0'/0/0`;

          const blockchainInfo = blockchainMap.get(blockchainKey);
          if (!blockchainInfo) {
            this.logger.warn(`Blockchain info not found for ${blockchainKey}`);
            continue;
          }

          hotWallets.push({
            blockchainKey,
            blockchain: blockchainInfo,
            address,
            derivationPath,
            type: 'hot_wallet',
          });
        } catch (error) {
          this.logger.warn(`Failed to get hot wallet for ${blockchainKey}: ${error.message}`);
        }
      }

      // Get active invoice addresses
      const activeInvoices = await this.repository.platformViewsActiveInvoices({});

      const invoiceWallets: Array<{
        blockchainKey: string;
        blockchain: {
          name: string;
          shortName: string;
          image: string;
        };
        currency: {
          tokenId: string;
          name: string;
          symbol: string;
          decimals: number;
          image: string;
        };
        address: string;
        derivationPath: string;
        invoiceId: number;
        type: 'invoice_wallet';
      }> = [];

      for (const invoice of activeInvoices) {
        const blockchainInfo = blockchainMap.get(invoice.currencyBlockchainKey);
        const currencyKey = `${invoice.currencyBlockchainKey}:${invoice.currencyTokenId}`;
        const currencyInfo = currencyMap.get(currencyKey);

        if (!blockchainInfo) {
          this.logger.warn(`Blockchain info not found for invoice ${invoice.id}`);
          continue;
        }

        if (!currencyInfo) {
          this.logger.warn(`Currency info not found for invoice ${invoice.id}: ${currencyKey}`);
          continue;
        }

        invoiceWallets.push({
          blockchainKey: invoice.currencyBlockchainKey,
          blockchain: blockchainInfo,
          currency: {
            tokenId: invoice.currencyTokenId,
            name: currencyInfo.name,
            symbol: currencyInfo.symbol,
            decimals: currencyInfo.decimals,
            image: currencyInfo.image,
          },
          address: invoice.walletAddress,
          derivationPath: invoice.walletDerivationPath,
          invoiceId: Number(invoice.id),
          type: 'invoice_wallet',
        });
      }

      // Calculate statistics
      const blockchainDistribution = new Map<string, { name: string; count: number }>();

      for (const wallet of hotWallets) {
        const existing = blockchainDistribution.get(wallet.blockchainKey);
        blockchainDistribution.set(wallet.blockchainKey, {
          name: wallet.blockchain.name,
          count: (existing?.count || 0) + 1,
        });
      }

      for (const wallet of invoiceWallets) {
        const existing = blockchainDistribution.get(wallet.blockchainKey);
        blockchainDistribution.set(wallet.blockchainKey, {
          name: wallet.blockchain.name,
          count: (existing?.count || 0) + 1,
        });
      }

      const statistics = {
        totalHotWallets: hotWallets.length,
        totalInvoiceWallets: invoiceWallets.length,
        blockchainDistribution: Object.fromEntries(
          Array.from(blockchainDistribution).map(([key, value]) => [key, value.count]),
        ),
      };

      this.logger.log('Wallet list retrieved successfully', {
        hotWallets: hotWallets.length,
        invoiceWallets: invoiceWallets.length,
      });

      return {
        success: true,
        data: {
          hotWallets,
          invoiceWallets,
          statistics,
        },
      };
    } catch (error) {
      this.logger.error('Failed to list wallets', { error: error.message });
      throw error;
    }
  }
}
