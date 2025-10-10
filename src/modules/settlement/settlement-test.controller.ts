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

import { SolService } from './currencies/sol.service';
import { SettlementWalletService } from './currencies/wallet.service';
import { SettlementService } from './settlement.service';

@Controller('test/settlement')
@ApiTags('Testing - Settlement')
export class SettlementTestController {
  constructor(
    private readonly settlementService: SettlementService,
    private readonly walletService: SettlementWalletService,
    private readonly solService: SolService,
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
      const balance = await this.walletService.getHotWalletBalance(blockchainKey);
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
      const balances = await this.walletService.getHotWalletBalances(body.blockchainKeys);
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
      const hotWalletBalances = await this.walletService.getHotWalletBalances(body.blockchainKeys);

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
        network: blockchainKey.includes('testnet') ? 'testnet' : 'mainnet',
        rpcUrl:
          process.env.SOLANA_RPC_URL ||
          (blockchainKey.includes('testnet')
            ? 'https://api.testnet.solana.com'
            : 'https://api.mainnet-beta.solana.com'),
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
        network: blockchainKey.includes('testnet') ? 'testnet' : 'mainnet',
        balanceAvailable: true,
        currentBalance: balance,
        currentBalanceSOL: balance / 1_000_000_000,
        rpcUrl:
          process.env.SOLANA_RPC_URL ||
          (blockchainKey.includes('testnet')
            ? 'https://api.testnet.solana.com'
            : 'https://api.mainnet-beta.solana.com'),
        message: 'Solana service is working correctly',
      };
    } catch (error) {
      const blockchainKey = this.solService.getBlockchainKey();
      return {
        success: false,
        status: 'unhealthy',
        blockchain: blockchainKey,
        network: blockchainKey.includes('testnet') ? 'testnet' : 'mainnet',
        balanceAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        rpcUrl:
          process.env.SOLANA_RPC_URL ||
          (blockchainKey.includes('testnet')
            ? 'https://api.testnet.solana.com'
            : 'https://api.mainnet-beta.solana.com'),
        message: 'Solana service encountered an error',
      };
    }
  }
}
