import type { DynamicModule, INestApplicationContext, Provider, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { randomBytes } from 'node:crypto';

import { DiscoveryModule } from '@nestjs/core';

import { WithdrawalsModule } from 'src/modules/withdrawals/withdrawals.module.js';
import { WithdrawalsProcessor } from 'src/modules/withdrawals/withdrawals.processor.js';

import { DocumentModule } from '../modules/documents/document.module';
import { DocumentProcessor } from '../modules/documents/document.processor';
import { IndexerModule } from '../modules/indexer/indexer.module';
import { IndexerProcessor } from '../modules/indexer/indexer.processor';
import { InvoiceExpirationModule } from '../modules/invoice-expiration/invoice-expiration.module';
import { InvoicePaymentModule } from '../modules/invoice-payments/invoice-payment.module';
import { InvoicePaymentProcessor } from '../modules/invoice-payments/invoice-payment.processor';
import { LoanMatcherModule } from '../modules/loan-matcher/loan-matcher.module';
import { NotificationModule } from '../modules/notifications/notification.module';
import { PricefeedModule } from '../modules/pricefeed/pricefeed.module';
import { PricefeedScheduler } from '../modules/pricefeed/pricefeed.scheduler';
import { SettlementScheduler } from '../modules/settlement/schedulers/settlement.scheduler';
import { SettlementModule } from '../modules/settlement/settlement.module';
import { ValuationModule } from '../modules/valuation/valuation.module';
import { ValuationProcessor } from '../modules/valuation/valuation.processor';
import { WalletBalanceCollectorModule } from '../modules/wallet-balance-collector/wallet-balance-collector.module';
import { WalletBalanceCollectorProcessor } from '../modules/wallet-balance-collector/wallet-balance-collector.processor';
import { CryptographyService } from '../shared/cryptography/cryptography.service';
import { CryptogadaiRepository } from '../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../shared/services/app-config.service';
import { SharedModule } from '../shared/shared.module';
import { TelemetryLogger } from '../shared/telemetry.logger';
import { WalletFactory } from '../shared/wallets/wallet.factory';
import { bootstrapUserApi } from './user-api.bootstrap';
import { AppModule } from './user-api.module';

export type CommandKey =
  | 'api'
  | 'document'
  | 'indexer'
  | 'invoice-expiration'
  | 'invoice-payment'
  | 'list-wallets'
  | 'loan-matcher'
  | 'migration'
  | 'notification'
  | 'pricefeed'
  | 'platform-wallet-init'
  | 'settlement'
  | 'valuation'
  | 'wallet-balance-collector'
  | 'withdrawals';

export interface BootstrapContext {
  app: INestApplicationContext;
}

export interface BootstrapResult {
  cleanup?: () => Promise<void> | void;
  exitAfterBootstrap?: number;
}

export interface CommandDefinition {
  imports?: Array<Type | DynamicModule>;
  providers?: Provider[];
  usesBull?: boolean;
  requiresHttp?: boolean;
  bootstrap?: (context: BootstrapContext) => Promise<BootstrapResult | void>;
}

export const COMMAND_DEFINITIONS: Record<CommandKey, CommandDefinition> = {
  api: {
    imports: [AppModule],
    usesBull: true,
    requiresHttp: true,
    async bootstrap({ app }) {
      const httpApp = app as NestExpressApplication;
      await bootstrapUserApi(httpApp);
    },
  },
  notification: {
    imports: [NotificationModule],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('NotificationWorker');
      logger.log('Notification worker started successfully');
      return {
        cleanup: () => {
          logger.log('Notification worker shutting down');
        },
      };
    },
  },
  pricefeed: {
    imports: [PricefeedModule],
    providers: [PricefeedScheduler],
    async bootstrap() {
      const logger = new TelemetryLogger('PriceFeedWorker');
      logger.log('Price feed worker started successfully');
      return {
        cleanup: () => {
          logger.log('Price feed worker shutting down');
        },
      };
    },
  },
  settlement: {
    imports: [SettlementModule],
    providers: [SettlementScheduler],
    async bootstrap() {
      const logger = new TelemetryLogger('SettlementWorker');
      logger.log('Settlement worker started successfully');
      logger.log('Scheduled to run daily at midnight (00:00 UTC)');
      return {
        cleanup: () => {
          logger.log('Settlement worker shutting down');
        },
      };
    },
  },
  valuation: {
    imports: [ValuationModule],
    providers: [ValuationProcessor],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('ValuationWorker');
      logger.log('Valuation worker started successfully');
      return {
        cleanup: () => {
          logger.log('Valuation worker shutting down');
        },
      };
    },
  },
  'invoice-expiration': {
    imports: [InvoiceExpirationModule],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('InvoiceExpirationWorker');
      logger.log('Invoice expiration worker started successfully');
      return {
        cleanup: () => {
          logger.log('Invoice expiration worker shutting down');
        },
      };
    },
  },
  'invoice-payment': {
    imports: [InvoicePaymentModule],
    providers: [InvoicePaymentProcessor],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('InvoicePaymentWorker');
      logger.log('Invoice payment worker started successfully');
      return {
        cleanup: () => {
          logger.log('Invoice payment worker shutting down');
        },
      };
    },
  },
  'loan-matcher': {
    imports: [LoanMatcherModule],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('LoanMatcherWorker');
      logger.log('Starting Loan Matcher Worker...');

      const handleUncaughtException = (error: Error) => {
        logger.error('Uncaught Exception:', error);
      };

      const handleUnhandledRejection = (reason: unknown, promise: Promise<unknown>) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      };

      process.on('uncaughtException', handleUncaughtException);
      process.on('unhandledRejection', handleUnhandledRejection);

      logger.log('Loan Matcher Worker started successfully');

      return {
        cleanup: () => {
          process.off('uncaughtException', handleUncaughtException);
          process.off('unhandledRejection', handleUnhandledRejection);
          logger.log('Loan Matcher Worker shutting down');
        },
      };
    },
  },
  indexer: {
    imports: [IndexerModule, DiscoveryModule],
    providers: [IndexerProcessor],
    async bootstrap() {
      const logger = new TelemetryLogger('IndexerWorker');
      logger.log('Indexer worker started successfully');

      return {
        cleanup: () => {
          logger.log('Indexer worker shutting down');
        },
      };
    },
  },
  document: {
    imports: [DocumentModule],
    providers: [DocumentProcessor],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('DocumentWorker');
      logger.log('Document worker started successfully');
      return {
        cleanup: () => {
          logger.log('Document worker shutting down');
        },
      };
    },
  },
  'wallet-balance-collector': {
    imports: [WalletBalanceCollectorModule],
    providers: [WalletBalanceCollectorProcessor],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('WalletBalanceCollectorWorker');
      logger.log('Wallet balance collector worker started successfully');
      return {
        cleanup: () => {
          logger.log('Wallet balance collector worker shutting down');
        },
      };
    },
  },
  withdrawals: {
    imports: [WithdrawalsModule],
    providers: [WithdrawalsProcessor],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('WithdrawalsWorker');
      logger.log('Withdrawals worker started successfully');
      return {
        cleanup: () => {
          logger.log('Withdrawals worker shutting down');
        },
      };
    },
  },
  migration: {
    async bootstrap({ app }) {
      const logger = new TelemetryLogger('MigrationRunner');
      logger.log('Starting migration...');
      const repository = app.get(CryptogadaiRepository);
      await repository.migrate();
      logger.log('Migration completed.');
      return {
        cleanup: () => {
          /** ignore */
        },
      };
    },
  },
  'list-wallets': {
    imports: [SharedModule],
    async bootstrap({ app }) {
      const logger = new TelemetryLogger('WalletListCommand');
      const repository = app.get(CryptogadaiRepository);
      const walletFactory = app.get(WalletFactory);

      logger.log('Listing all active wallet addresses...');
      logger.log('');

      const allBlockchains = walletFactory.getAllBlockchains();

      console.log('═'.repeat(80));
      console.log('🔐 ACTIVE WALLET ADDRESSES');
      console.log('═'.repeat(80));
      console.log('');

      // Get root addresses (hot wallets) for each blockchain
      console.log('📍 ROOT ADDRESSES (Hot Wallets)');
      console.log('─'.repeat(80));

      for (const { blockchainKey, blockchain } of allBlockchains) {
        try {
          const hotWallet = await blockchain.getHotWallet();
          const address = await hotWallet.getAddress();
          const derivationPath = `m/44'/${blockchain.bip44CoinType}'/0'/0/0`;

          console.log(`\nblockchainKey: ${blockchainKey}`);
          console.log(`address: ${address}`);
          console.log(`derivationPath: ${derivationPath}`);
        } catch (error) {
          console.log(`\nblockchainKey: ${blockchainKey}`);
          console.log(`address: ERROR - ${error.message}`);
        }
      }

      console.log('');
      console.log('─'.repeat(80));
      console.log('');

      // Get active invoice addresses
      console.log('📫 ACTIVE INVOICE ADDRESSES');
      console.log('─'.repeat(80));

      try {
        const activeInvoices = await repository.platformViewsActiveInvoices({});

        if (activeInvoices.length === 0) {
          console.log('\nNo active invoices found.');
        } else {
          // Group by blockchain
          const groupedByBlockchain = new Map<string, typeof activeInvoices>();
          for (const invoice of activeInvoices) {
            const key = invoice.currencyBlockchainKey;
            if (!groupedByBlockchain.has(key)) {
              groupedByBlockchain.set(key, []);
            }
            groupedByBlockchain.get(key)!.push(invoice);
          }

          for (const [blockchainKey, invoices] of groupedByBlockchain.entries()) {
            console.log(`\nBlockchain: ${blockchainKey}`);
            for (const invoice of invoices) {
              console.log(`  - Invoice #${invoice.id}`);
              console.log(`    blockchainKey: ${blockchainKey}`);
              console.log(`    address: ${invoice.walletAddress}`);
              console.log(`    derivationPath: ${invoice.walletDerivationPath}`);
            }
          }
        }
      } catch (error) {
        console.log(`\nERROR fetching active invoices: ${error.message}`);
      }

      console.log('');
      console.log('═'.repeat(80));
      logger.log('');
      logger.log('Wallet listing completed.');

      return {
        exitAfterBootstrap: 0,
      };
    },
  },
  'platform-wallet-init': {
    imports: [SharedModule],
    async bootstrap({ app }) {
      const logger = new TelemetryLogger('PlatformWalletInitializer');
      logger.log('Starting platform wallet initialization...');

      const appConfig = app.get(AppConfigService);
      const cryptography = app.get(CryptographyService);

      const cryptographyConfig = appConfig.cryptographyConfig;

      if (cryptographyConfig.engine !== 'vault') {
        logger.error(
          'Platform wallet initialization requires Vault-based cryptography. Set CRYPTOGRAPHY_ENGINE=vault',
        );
        return {
          exitAfterBootstrap: 1,
        };
      }

      try {
        // Check if platform wallet seed already exists
        logger.log('Checking if platform wallet seed exists...');
        const existingSecret = await cryptography.getSecret('wallet/platform-seed');

        if (existingSecret && typeof existingSecret === 'object') {
          const encryptedSeed = (existingSecret as Record<string, unknown>).encrypted_seed;
          if (typeof encryptedSeed === 'string' && encryptedSeed.length > 0) {
            logger.warn('Platform wallet seed already exists at wallet/platform-seed');
            logger.warn('Initialization skipped. Delete the existing secret first to regenerate.');
            return {
              exitAfterBootstrap: 0,
            };
          }
        }
      } catch (_error) {
        // Secret doesn't exist, proceed with generation
        logger.log('Platform wallet seed does not exist, proceeding with generation...');
      } // Generate a cryptographically secure 64-byte (512-bit) random seed
      logger.log('Generating 64-byte cryptographically secure random seed...');
      const seedBuffer = randomBytes(64);
      const seedHex = seedBuffer.toString('hex');

      logger.log(`Generated seed length: ${seedBuffer.length} bytes`);
      logger.log('⚠️  IMPORTANT: Save this seed securely! It cannot be recovered if lost.');
      logger.log('─'.repeat(80));
      logger.log(`PLATFORM WALLET SEED (HEX): ${seedHex}`);
      logger.log('─'.repeat(80));

      try {
        // Encrypt the seed using Vault's transit engine
        logger.log('Encrypting seed with transit key: platform-wallet...');
        const encryptionResult = await cryptography.encrypt('platform-wallet', seedHex);

        logger.log('Seed encrypted successfully');
        logger.log(`Ciphertext: ${encryptionResult.ciphertext}`);

        // Store the encrypted seed in Vault KV store
        logger.log('Storing encrypted seed in Vault at: wallet/platform-seed...');
        await cryptography.writeSecret('wallet/platform-seed', {
          encrypted_seed: encryptionResult.ciphertext,
        });

        logger.log('Platform wallet seed stored successfully!');
        logger.log('');
        logger.log('Platform wallet initialization completed successfully!');
        logger.log('');
        logger.log('Next steps:');
        logger.log('1. Store the seed hex shown above in a secure offline location');
        logger.log(
          '2. Verify the seed is retrievable: vault kv get secret/data/wallet/platform-seed',
        );
        logger.log('3. Test decryption to ensure it works correctly');
        logger.log('4. Start the API server to verify wallet initialization');

        return {
          exitAfterBootstrap: 0,
        };
      } catch (error) {
        logger.error('Failed to initialize platform wallet:', error);

        if (error.message?.includes('transit key not found')) {
          logger.error('');
          logger.error('Transit key "platform-wallet" does not exist.');
          logger.error(
            'Create it first with: vault write transit/keys/platform-wallet type=aes256-gcm96',
          );
        }

        return {
          exitAfterBootstrap: 1,
        };
      }
    },
  },
};
