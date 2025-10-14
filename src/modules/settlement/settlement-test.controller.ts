/**
 * Settlement Test Controller
 *
 * Provides test endpoints for E2E testing of settlement functionality.
 * These endpoints are only available in non-production environments.
 *
 * @internal
 */

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
import { WalletService } from '../../shared/wallets/wallet.service';
import { BinanceClientService } from './services/binance/binance-client.service';
import { BinanceDepositVerificationService } from './services/binance/binance-deposit-verification.service';
import { SolService } from './services/blockchain/sol.service';
import { SettlementWalletService } from './services/blockchain/wallet.service';
import { SettlementService } from './services/core/settlement.service';
import { SettlementTransactionService } from './services/core/settlement-transaction.service';

@Controller('test/settlement')
@ApiTags('Testing - Settlement')
@Auth({ public: true })
export class SettlementTestController {
  constructor(
    private readonly settlementService: SettlementService,
    private readonly settlementWalletService: SettlementWalletService,
    private readonly walletService: WalletService,
    private readonly solService: SolService,
    private readonly binanceClient: BinanceClientService,
    private readonly settlementTransactionService: SettlementTransactionService,
    private readonly binanceDepositService: BinanceDepositVerificationService,
  ) {}

  /**
   * Get hot wallet for a specific blockchain
   */
  @Get('hot-wallet/:blockchainKey')
  async getHotWallet(@Param('blockchainKey') blockchainKey: string) {
    try {
      const hotWallet = await this.walletService.getHotWallet(blockchainKey);
      return {
        blockchainKey,
        address: hotWallet.address,
        type: hotWallet.wallet.constructor.name,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        blockchainKey,
      };
    }
  }

  /**
   * Get hot wallet balance from blockchain
   */
  @Get('hot-wallet-balance/:blockchainKey')
  async getHotWalletBalance(@Param('blockchainKey') blockchainKey: string) {
    try {
      const balance = await this.settlementWalletService.getHotWalletBalance(blockchainKey);
      const hotWallet = await this.walletService.getHotWallet(blockchainKey);
      return {
        blockchainKey,
        balance,
        address: hotWallet.address,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        blockchainKey,
        balance: '0',
        address: '',
      };
    }
  }

  /**
   * Get balances for multiple blockchains
   */
  @Post('hot-wallet-balances')
  async getHotWalletBalances(@Body() body: { blockchainKeys: string[] }) {
    try {
      const balances = await this.settlementWalletService.getHotWalletBalances(body.blockchainKeys);
      return balances;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        blockchainKeys: body.blockchainKeys,
      };
    }
  }

  /**
   * Calculate required Binance balance
   */
  @Post('calculate-required-binance')
  async calculateRequiredBinance(@Body() body: { hotWalletTotal: string; ratio: number }) {
    try {
      const requiredBinance = this.settlementService.calculateRequiredBinanceBalance(
        body.hotWalletTotal,
        body.ratio,
      );
      return {
        hotWalletTotal: body.hotWalletTotal,
        ratio: body.ratio,
        requiredBinance,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate settlement amount
   */
  @Post('calculate-settlement-amount')
  async calculateSettlementAmount(
    @Body() body: { hotWalletTotal: string; currentBinance: string; ratio: number },
  ) {
    try {
      const settlementAmount = this.settlementService.calculateSettlementAmount(
        body.hotWalletTotal,
        body.currentBinance,
        body.ratio,
      );
      return {
        hotWalletTotal: body.hotWalletTotal,
        currentBinance: body.currentBinance,
        ratio: body.ratio,
        settlementAmount,
        direction: Number.parseFloat(settlementAmount) > 0 ? 'TO_BINANCE' : 'FROM_BINANCE',
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Full settlement calculation flow
   */
  @Post('full-calculation')
  async fullCalculation(
    @Body()
    body: { currencyTokenId: string; blockchainKeys: string[]; ratio: number },
  ) {
    try {
      // Get hot wallet balances from blockchain
      const hotWalletBalances = await this.settlementWalletService.getHotWalletBalances(
        body.blockchainKeys,
      );

      // Calculate total
      const totalBalance = hotWalletBalances.reduce((sum, wallet) => {
        return sum + Number.parseFloat(wallet.balance);
      }, 0);

      // Get Binance balance (simulated or real)
      const binanceBalance = await this.settlementService.getBinanceBalance(body.currencyTokenId);

      // Calculate required and settlement amounts
      const requiredBinance = this.settlementService.calculateRequiredBinanceBalance(
        totalBalance.toString(),
        body.ratio,
      );
      const settlementAmount = this.settlementService.calculateSettlementAmount(
        totalBalance.toString(),
        binanceBalance,
        body.ratio,
      );

      return {
        currencyTokenId: body.currencyTokenId,
        hotWallets: hotWalletBalances,
        hotWalletTotal: totalBalance.toString(),
        binanceBalance,
        requiredBinance,
        settlementAmount,
        direction: Number.parseFloat(settlementAmount) > 0 ? 'TO_BINANCE' : 'FROM_BINANCE',
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        currencyTokenId: body.currencyTokenId,
      };
    }
  }

  /**
   * Get Solana balance using SolService
   * Tests that SolService is working properly and returning valid balance
   */
  @Get('solana-balance')
  async getSolanaBalance() {
    try {
      const blockchainKey = this.solService.getBlockchainKey();
      const balance = await this.solService.getBalance();

      // Get hot wallet details for additional context
      const hotWallet = await this.walletService.getHotWallet(blockchainKey);

      return {
        success: true,
        blockchain: blockchainKey,
        balance: balance,
        balanceInSOL: balance / 1_000_000_000, // Convert lamports to SOL
        unit: 'lamports',
        address: hotWallet.address,
        network: this.solService.getNetworkName(),
        rpcUrl: this.solService.getRpcUrl(),
        note: 'Balance is returned in lamports (1 SOL = 1,000,000,000 lamports)',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        blockchain: this.solService.getBlockchainKey(),
        balance: 0,
        balanceInSOL: 0,
      };
    }
  }

  /**
   * Test Solana service health
   * Verifies that Solana RPC connection is working and service is initialized
   */
  @Get('solana-health')
  async getSolanaHealth() {
    try {
      const blockchainKey = this.solService.getBlockchainKey();
      // Try to get balance to verify connection
      const balance = await this.solService.getBalance();
      const hotWallet = await this.walletService.getHotWallet(blockchainKey);

      return {
        success: true,
        status: 'healthy',
        blockchain: blockchainKey,
        address: hotWallet.address,
        network: this.solService.getNetworkName(),
        balanceAvailable: true,
        currentBalance: balance,
        currentBalanceSOL: balance / 1_000_000_000,
        rpcUrl: this.solService.getRpcUrl(),
        message: 'Solana service is working correctly',
      };
    } catch (error) {
      const blockchainKey = this.solService.getBlockchainKey();
      return {
        success: false,
        status: 'unhealthy',
        blockchain: blockchainKey,
        network: this.solService.getNetworkName(),
        balanceAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        rpcUrl:
          process.env.SOLANA_RPC_URL ||
          (blockchainKey.includes('devnet')
            ? 'https://api.devnet.solana.com'
            : blockchainKey.includes('testnet')
              ? 'https://api.testnet.solana.com'
              : 'https://api.mainnet-beta.solana.com'),
        message: 'Solana service encountered an error',
      };
    }
  }

  /**
   * Execute test settlement transfer from Solana to Binance
   * This endpoint performs an actual blockchain transfer - use with caution!
   *
   * @param body.amount - Amount of SOL to transfer
   * @param body.toAddress - Binance deposit address (optional, will fetch if not provided)
   */
  @Post('execute-transfer')
  async executeTransfer(@Body() body: { amount: string; toAddress?: string }) {
    try {
      const blockchainKey = this.solService.getBlockchainKey();
      const hotWallet = await this.walletService.getHotWallet(blockchainKey);

      // Get current balance
      const balanceBefore = await this.solService.getBalance();
      const solBalanceBefore = balanceBefore / 1_000_000_000;

      // Validate amount
      const transferAmount = Number.parseFloat(body.amount);
      if (transferAmount <= 0) {
        return {
          success: false,
          error: 'Transfer amount must be greater than 0',
        };
      }

      if (transferAmount > solBalanceBefore) {
        return {
          success: false,
          error: `Insufficient balance. Have: ${solBalanceBefore} SOL, Need: ${transferAmount} SOL`,
        };
      }

      // Determine destination address
      let toAddress = body.toAddress;
      let depositAddressInfo: any = null;

      if (!toAddress) {
        // Try to get Binance deposit address from API
        if (!this.binanceClient.isApiEnabled()) {
          return {
            success: false,
            error: 'Binance API is not enabled. Please provide toAddress parameter',
            hint: 'Either enable Binance API or provide explicit deposit address',
          };
        }

        try {
          // Get Solana deposit address from Binance
          // Note: Binance uses 'SOL' as the asset name for Solana
          depositAddressInfo = await this.binanceClient.getDepositAddress('SOL');
          toAddress = depositAddressInfo.address;

          if (!toAddress) {
            return {
              success: false,
              error: 'Failed to get Binance deposit address (address is empty)',
              hint: 'Please provide toAddress parameter manually',
            };
          }
        } catch (error) {
          return {
            success: false,
            error: `Failed to fetch Binance deposit address: ${error instanceof Error ? error.message : 'Unknown error'}`,
            hint: 'Please provide toAddress parameter manually',
          };
        }
      }

      // Execute transfer
      const transferStart = Date.now();
      const txResult = await hotWallet.wallet.transfer({
        tokenId: 'SOL',
        from: hotWallet.address,
        to: toAddress,
        value: body.amount,
      });
      const transferDuration = Date.now() - transferStart;

      // Get new balance
      const balanceAfter = await this.solService.getBalance();
      const solBalanceAfter = balanceAfter / 1_000_000_000;

      return {
        success: true,
        transfer: {
          from: hotWallet.address,
          to: toAddress,
          amount: body.amount,
          amountSOL: transferAmount,
          tokenId: 'SOL',
          blockchain: blockchainKey,
          network: blockchainKey.includes('devnet')
            ? 'devnet'
            : blockchainKey.includes('testnet')
              ? 'testnet'
              : 'mainnet',
        },
        transaction: {
          hash: txResult.txHash,
          duration: `${transferDuration}ms`,
          explorer: blockchainKey.includes('devnet')
            ? `https://explorer.solana.com/tx/${txResult.txHash}?cluster=devnet`
            : blockchainKey.includes('testnet')
              ? `https://explorer.solana.com/tx/${txResult.txHash}?cluster=testnet`
              : `https://explorer.solana.com/tx/${txResult.txHash}`,
        },
        balance: {
          before: solBalanceBefore,
          after: solBalanceAfter,
          difference: solBalanceBefore - solBalanceAfter,
          unit: 'SOL',
        },
        binanceDepositAddress: depositAddressInfo
          ? {
              address: depositAddressInfo.address,
              coin: depositAddressInfo.coin,
              tag: depositAddressInfo.tag,
              url: depositAddressInfo.url,
            }
          : body.toAddress
            ? {
                address: body.toAddress,
                note: 'Address provided manually',
              }
            : null,
        message: 'Transfer executed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Verify transaction on Solana blockchain
   */
  @Post('verify-transaction')
  async verifyTransaction(
    @Body() body: { signature: string; from: string; to: string; expectedAmount: string },
  ) {
    try {
      // Convert lamports to SOL for the service
      const amountInSOL = (Number.parseInt(body.expectedAmount) / 1_000_000_000).toString();

      const result = await this.settlementTransactionService.verifyTransfer({
        signature: body.signature,
        expectedFrom: body.from,
        expectedTo: body.to,
        expectedAmount: amountInSOL,
        currency: 'SOL',
      });

      const errors = result.errors || [];
      return {
        verified: result.verified && result.success,
        confirmed: result.verified,
        fromMatch: !errors.some(e => e.includes('from address')),
        toMatch: !errors.some(e => e.includes('to address')),
        amountMatch: !errors.some(e => e.includes('amount')),
        errors: errors,
        transaction: result.details
          ? {
              slot: result.details.slot,
              blockTime: result.details.blockTime,
              fee: result.details.fee,
            }
          : null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get Binance deposit address
   */
  @Post('binance-deposit-address')
  async getBinanceDepositAddress(@Body() body: { coin: string }) {
    try {
      if (!this.binanceClient.isApiEnabled()) {
        return {
          success: false,
          error: 'Binance API is not enabled',
          hint: 'Set BINANCE_API_KEY and BINANCE_API_SECRET environment variables',
        };
      }

      const depositAddress = await this.binanceClient.getDepositAddress(body.coin);

      return {
        success: true,
        coin: body.coin,
        address: depositAddress.address,
        tag: depositAddress.tag,
        network: process.env.BINANCE_USE_TESTNET === 'true' ? 'testnet' : 'mainnet',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Verify deposit on Binance
   */
  @Post('verify-binance-deposit')
  async verifyBinanceDeposit(
    @Body() body: { coin: string; txId: string; address: string; amount: string },
  ) {
    try {
      if (!this.binanceClient.isApiEnabled()) {
        return {
          success: false,
          error: 'Binance API is not enabled',
          hint: 'Set BINANCE_API_KEY and BINANCE_API_SECRET environment variables',
        };
      }

      const verification = await this.binanceDepositService.verifyDeposit({
        coin: body.coin,
        txId: body.txId,
        address: body.address,
        expectedAmount: body.amount,
      });

      return {
        success: true,
        found: verification.found,
        coin: verification.deposit?.coin,
        amount: verification.deposit?.amount,
        status: verification.deposit?.status,
        statusText:
          verification.deposit?.status === 0
            ? 'pending'
            : verification.deposit?.status === 6
              ? 'credited'
              : verification.deposit?.status === 1
                ? 'success'
                : 'unknown',
        confirmations: verification.deposit?.confirmTimes,
        network: verification.deposit?.network,
        insertTime: verification.deposit?.insertTime,
        unlockConfirm: verification.deposit?.unlockConfirm,
        message: verification.message,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate transfer report
   */
  @Post('transfer-report')
  async getTransferReport(@Body() body: { signature: string }) {
    try {
      // Get transaction details from blockchain
      const status = await this.solService.getTransactionStatus(body.signature);

      return {
        success: true,
        signature: body.signature,
        blockchainStatus: status.confirmed ? 'confirmed' : 'pending',
        network: this.solService.getBlockchainKey(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
