import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AccountBalance, AccountMutation } from '../../shared/repositories/finance.types';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import {
  AccountBalanceDto,
  AccountBalancesResponseDto,
  AccountMutationDto,
  AccountMutationsResponseDto,
  AccountMutationType,
  AssetAllocationDto,
  GetAccountMutationsQueryDto,
  MonetaryValueDto,
  PaginationMetaDto,
  PaymentAlertDto,
  PaymentAlertsDto,
  PerformanceMetricDto,
  PortfolioAnalyticsDto,
  // Portfolio DTOs
  PortfolioAnalyticsResponseDto,
  PortfolioOverviewDto,
  PortfolioOverviewResponseDto,
  PortfolioPerformanceDto,
} from './dto/accounts.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new TelemetryLogger(AccountsService.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
  ) {}

  /**
   * Get account balances for a user
   */
  async getAccountBalances(userId: string): Promise<AccountBalancesResponseDto> {
    try {
      const result = await this.repository.userRetrievesAccountBalances({ userId });

      const accounts: AccountBalanceDto[] = result.accounts.map(account => {
        const accountDto: AccountBalanceDto = {
          id: Number(account.id),
          currency: this.mapToCurrencyDto(account),
          balance: account.balance,
          lastUpdated: account.updatedDate?.toISOString() || new Date().toISOString(),
        };

        // Add valuation data if available
        if (account.valuationAmount && account.exchangeRate && account.rateDate) {
          const quoteCurrencyDecimals = account.quoteCurrencyDecimals || 6;
          const valuationBigInt = BigInt(account.valuationAmount);
          const divisor = BigInt(10 ** quoteCurrencyDecimals);
          const integerPart = valuationBigInt / divisor;
          const fractionalPart = valuationBigInt % divisor;
          const valuationFormatted = `${integerPart}.${fractionalPart.toString().padStart(quoteCurrencyDecimals, '0')}`;

          accountDto.valuation = {
            amount: valuationFormatted,
            currency: {
              blockchainKey: 'crosschain',
              tokenId: 'iso4217:usd',
              name: 'USD Token',
              symbol: 'USD',
              decimals: quoteCurrencyDecimals,
              logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
            },
            exchangeRate: account.exchangeRate,
            rateSource: account.rateSource || 'unknown',
            rateDate: account.rateDate.toISOString(),
          };
        }

        return accountDto;
      });

      // Format total portfolio value
      const totalPortfolioValueUsd = result.totalPortfolioValueUsd || '0';
      const totalValueBigInt = BigInt(totalPortfolioValueUsd);
      const usdDecimals = 6;
      const divisor = BigInt(10 ** usdDecimals);
      const integerPart = totalValueBigInt / divisor;
      const fractionalPart = totalValueBigInt % divisor;
      const totalValueFormatted = `${integerPart}.${fractionalPart.toString().padStart(usdDecimals, '0').slice(0, 2)}`;

      // Find most recent update date from accounts
      const mostRecentUpdate = result.accounts.reduce(
        (latest, account) => {
          if (!account.updatedDate) return latest;
          return !latest || account.updatedDate > latest ? account.updatedDate : latest;
        },
        null as Date | null,
      );

      return {
        success: true,
        data: {
          accounts,
          totalPortfolioValue: {
            amount: totalValueFormatted,
            currency: 'USD',
            lastUpdated: mostRecentUpdate?.toISOString() || new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get account balances', error);
      throw new BadRequestException('Failed to retrieve account balances');
    }
  }

  /**
   * Get account transaction history (mutations)
   */
  async getAccountMutations(
    accountId: string,
    query: GetAccountMutationsQueryDto,
    userId?: string,
  ): Promise<AccountMutationsResponseDto> {
    try {
      const { page = 1, limit = 20, mutationType, fromDate, toDate } = query;

      const offset = (page - 1) * limit;

      // Validate account ownership if userId is provided
      if (userId) {
        const accountCheck = await this.repository.sql`
          SELECT user_id FROM user_accounts WHERE id = ${accountId}
        `;
        if (accountCheck.length === 0) {
          throw new NotFoundException('Account not found');
        }
        const account = accountCheck[0] as { user_id: string | number };
        if (String(account.user_id) !== userId) {
          throw new NotFoundException('Account not found');
        }
      }

      const result = await this.repository.userViewsAccountTransactionHistory({
        accountId,
        mutationType: mutationType as string | undefined,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        limit,
        offset,
      });

      const mutations: AccountMutationDto[] = result.mutations.map(mutation => ({
        id: Number(mutation.id),
        mutationType: this.mapToAccountMutationType(mutation.mutationType),
        mutationDate: mutation.mutationDate.toISOString(),
        amount: mutation.amount,
        description: this.generateMutationDescription(mutation),
        referenceId: mutation.invoiceId
          ? Number(mutation.invoiceId)
          : mutation.withdrawalId
            ? Number(mutation.withdrawalId)
            : undefined,
        referenceType: mutation.invoiceId
          ? 'invoice'
          : mutation.withdrawalId
            ? 'withdrawal'
            : undefined,
        balanceAfter: mutation.balanceAfter,
      }));

      const totalPages = Math.ceil(result.totalCount / limit);
      const pagination: PaginationMetaDto = {
        page,
        limit,
        total: result.totalCount,
        totalPages,
        hasNext: result.hasMore,
        hasPrev: page > 1,
      };

      return {
        success: true,
        data: {
          mutations,
          pagination,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get account mutations', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve account mutations');
    }
  }

  /**
   * Map database account to CurrencyDto
   */
  private mapToCurrencyDto(account: AccountBalance) {
    return {
      blockchainKey: account.currencyBlockchainKey,
      tokenId: account.currencyTokenId,
      name: account.currencyName,
      symbol: account.currencySymbol,
      decimals: account.currencyDecimals,
      logoUrl: account.currencyImage,
    };
  }

  /**
   * Map database mutation type to enum
   * Database stores mutation types in PascalCase (e.g., 'InvoiceReceived')
   * Enum values match the PascalCase format
   */
  private mapToAccountMutationType(mutationType: string): AccountMutationType {
    // Database uses PascalCase, which matches our enum values
    return mutationType as AccountMutationType;
  }

  /**
   * Generate human-readable description for mutation
   */
  private generateMutationDescription(mutation: AccountMutation): string {
    const typeDescriptions: Record<string, string> = {
      InvoiceReceived: 'Invoice payment received',
      LoanCollateralDeposit: 'Loan collateral deposit',
      LoanApplicationCollateralEscrowed: 'Loan application collateral escrowed',
      LoanPrincipalDisbursement: 'Loan principal disbursement',
      LoanDisbursementReceived: 'Loan disbursement received',
      LoanPrincipalDisbursementFee: 'Loan principal disbursement fee',
      LoanRepayment: 'Loan repayment',
      LoanCollateralRelease: 'Loan collateral release',
      LoanCollateralReturned: 'Loan collateral returned',
      LoanCollateralReleased: 'Loan collateral released',
      LoanLiquidationRelease: 'Loan liquidation release',
      LoanLiquidationSurplus: 'Loan liquidation surplus',
      LoanLiquidationReleaseFee: 'Loan liquidation release fee',
      LoanPrincipalFunded: 'Loan principal funded',
      LoanOfferPrincipalEscrowed: 'Loan offer principal escrowed',
      LoanPrincipalReturned: 'Loan principal returned',
      LoanPrincipalReturnedFee: 'Loan principal returned fee',
      LoanInterestReceived: 'Loan interest received',
      LoanRepaymentReceived: 'Loan repayment received',
      LoanLiquidationRepayment: 'Loan liquidation repayment',
      LoanDisbursementPrincipal: 'Loan disbursement principal',
      LoanDisbursementFee: 'Loan disbursement fee',
      LoanReturnFee: 'Loan return fee',
      LoanLiquidationFee: 'Loan liquidation fee',
      LoanLiquidationCollateralUsed: 'Loan liquidation collateral used',
      WithdrawalRequested: 'Withdrawal requested',
      WithdrawalRefunded: 'Withdrawal refunded',
      PlatformFeeCharged: 'Platform fee charged',
      PlatformFeeRefunded: 'Platform fee refunded',
    };

    const baseDescription = typeDescriptions[mutation.mutationType] || 'Account mutation';

    if (mutation.invoiceId) {
      return `${baseDescription} for invoice #${mutation.invoiceId}`;
    }
    if (mutation.withdrawalId) {
      return `${baseDescription} for withdrawal #${mutation.withdrawalId}`;
    }
    if (mutation.invoicePaymentId) {
      return `${baseDescription} for payment #${mutation.invoicePaymentId}`;
    }

    return baseDescription;
  }

  /**
   * Get portfolio analytics for user
   */
  async getPortfolioAnalytics(userId: string): Promise<PortfolioAnalyticsResponseDto> {
    try {
      const result = await this.repository.userRetrievesPortfolioAnalytics({ userId });

      const portfolioAnalytics: PortfolioAnalyticsDto = {
        totalPortfolioValue: {
          amount: result.totalPortfolioValue.amount,
          currency: result.totalPortfolioValue.currency,
          isLocked: result.totalPortfolioValue.isLocked,
          lastUpdated: result.totalPortfolioValue.lastUpdated.toISOString(),
        },
        interestGrowth: {
          amount: result.interestGrowth.amount,
          currency: result.interestGrowth.currency,
          percentage: result.interestGrowth.percentage,
          isPositive: result.interestGrowth.isPositive,
          periodLabel: result.interestGrowth.periodLabel,
        },
        activeLoans: {
          count: result.activeLoans.count,
          borrowerLoans: result.activeLoans.borrowerLoans,
          lenderLoans: result.activeLoans.lenderLoans,
          totalCollateralValue: result.activeLoans.totalCollateralValue,
          averageLTV: result.activeLoans.averageLTV,
        },
        portfolioPeriod: {
          displayMonth: result.portfolioPeriod.displayMonth,
          startDate: result.portfolioPeriod.startDate.toISOString(),
          endDate: result.portfolioPeriod.endDate.toISOString(),
        },
        paymentAlerts: {
          upcomingPayments: result.paymentAlerts.upcomingPayments.map(alert => ({
            loanId: alert.loanId,
            daysUntilDue: alert.daysUntilDue,
            paymentAmount: alert.paymentAmount,
            currency: alert.currency,
            collateralAtRisk: alert.collateralAtRisk,
            collateralCurrency: alert.collateralCurrency,
            liquidationWarning: alert.liquidationWarning,
          })),
          overduePayments: result.paymentAlerts.overduePayments.map(alert => ({
            loanId: alert.loanId,
            daysUntilDue: alert.daysUntilDue,
            paymentAmount: alert.paymentAmount,
            currency: alert.currency,
            collateralAtRisk: alert.collateralAtRisk,
            collateralCurrency: alert.collateralCurrency,
            liquidationWarning: alert.liquidationWarning,
          })),
        },
        assetBreakdown: {
          cryptoAssets: {
            percentage: result.assetBreakdown.cryptoAssets.percentage,
            value: result.assetBreakdown.cryptoAssets.value,
          },
          stablecoins: {
            percentage: result.assetBreakdown.stablecoins.percentage,
            value: result.assetBreakdown.stablecoins.value,
          },
          loanCollateral: {
            percentage: result.assetBreakdown.loanCollateral.percentage,
            value: result.assetBreakdown.loanCollateral.value,
          },
        },
      };

      return {
        success: true,
        data: portfolioAnalytics,
      };
    } catch (error) {
      this.logger.error('Failed to get portfolio analytics', error);
      throw new BadRequestException('Failed to retrieve portfolio analytics');
    }
  }

  /**
   * Get portfolio overview for user
   */
  async getPortfolioOverview(userId: string): Promise<PortfolioOverviewResponseDto> {
    try {
      const result = await this.repository.userRetrievesPortfolioOverview({ userId });

      const portfolioOverview: PortfolioOverviewDto = {
        totalValue: {
          amount: result.totalValue.amount,
          currency: this.mapCurrencyToDto(result.totalValue.currency),
        },
        assetAllocation: result.assetAllocation.map(asset => ({
          currency: this.mapCurrencyToDto(asset.currency),
          balance: asset.balance,
          value: {
            amount: asset.value.amount,
            currency: this.mapCurrencyToDto({
              blockchainKey: 'crosschain',
              tokenId: 'iso4217:usd',
              name: 'USD Token',
              symbol: 'USD',
              decimals: 6,
            }),
          },
          percentage: asset.percentage,
        })),
        performance: {
          daily: {
            amount: result.performance.daily.amount,
            currency: result.performance.daily.currency,
            percentage: result.performance.daily.percentage,
          },
          weekly: {
            amount: result.performance.weekly.amount,
            currency: result.performance.weekly.currency,
            percentage: result.performance.weekly.percentage,
          },
          monthly: {
            amount: result.performance.monthly.amount,
            currency: result.performance.monthly.currency,
            percentage: result.performance.monthly.percentage,
          },
        },
        lastUpdated: result.lastUpdated.toISOString(),
      };

      return {
        success: true,
        data: portfolioOverview,
      };
    } catch (error) {
      this.logger.error('Failed to get portfolio overview', error);
      throw new BadRequestException('Failed to retrieve portfolio overview');
    }
  }

  /**
   * Map currency object to DTO format
   */
  private mapCurrencyToDto(currency: {
    blockchainKey: string;
    tokenId: string;
    name: string;
    symbol: string;
    decimals: number;
  }) {
    return {
      blockchainKey: currency.blockchainKey,
      tokenId: currency.tokenId,
      name: currency.name,
      symbol: currency.symbol,
      decimals: currency.decimals,
      logoUrl: `https://assets.cryptogadai.com/currencies/${currency.symbol.toLowerCase()}.png`,
    };
  }
}
