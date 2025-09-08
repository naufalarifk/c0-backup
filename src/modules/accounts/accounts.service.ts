import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AccountBalance, AccountMutation } from '../../shared/repositories/finance.types';
import {
  AccountBalanceDto,
  AccountBalancesResponseDto,
  AccountMutationDto,
  AccountMutationsResponseDto,
  AccountMutationType,
  GetAccountMutationsQueryDto,
  PaginationMetaDto,
} from './dto/accounts.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

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

      const balances: AccountBalanceDto[] = result.accounts.map(account => ({
        id: Number(account.id),
        currency: this.mapToCurrencyDto(account),
        balance: account.balance,
        pendingOperations: this.calculatePendingOperations(account),
        lastUpdated: new Date().toISOString(),
      }));

      return {
        success: true,
        data: { balances },
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
  ): Promise<AccountMutationsResponseDto> {
    try {
      const { page = 1, limit = 20, mutationType, fromDate, toDate } = query;

      const offset = (page - 1) * limit;

      const result = await this.repository.userViewsAccountTransactionHistory({
        accountId,
        mutationType: mutationType as string,
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

  // TODO: DO ACTUAL CURRENCY MAPPING
  /**
   * Map database account to CurrencyDto
   */
  private mapToCurrencyDto(account: AccountBalance) {
    const currencyMap: Record<string, { name: string; symbol: string; decimals: number }> = {
      'slip44:0': { name: 'Bitcoin', symbol: 'BTC', decimals: 8 },
      'slip44:60': { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
      'slip44:501': { name: 'Solana', symbol: 'SOL', decimals: 9 },
    };

    const currencyInfo = currencyMap[account.currencyTokenId] || {
      name: 'Unknown',
      symbol: 'UNK',
      decimals: 18,
    };

    return {
      blockchainKey: account.currencyBlockchainKey,
      tokenId: account.currencyTokenId,
      name: currencyInfo.name,
      symbol: currencyInfo.symbol,
      decimals: currencyInfo.decimals,
      logoUrl: `https://assets.cryptogadai.com/currencies/${currencyInfo.symbol.toLowerCase()}.png`,
    };
  }

  /**
   * Calculate pending operations for an account
   */
  private calculatePendingOperations(account: AccountBalance) {
    return {
      incoming: '0.000000000000000000',
      outgoing: '0.000000000000000000',
      net: '0.000000000000000000',
    };
  }

  /**
   * Map database mutation type to enum
   */
  private mapToAccountMutationType(mutationType: string): AccountMutationType {
    const typeMap: Record<string, AccountMutationType> = {
      invoiceReceived: AccountMutationType.INVOICE_RECEIVED,
      loanCollateralDeposit: AccountMutationType.LOAN_COLLATERAL_DEPOSIT,
      loanApplicationCollateralEscrowed: AccountMutationType.LOAN_APPLICATION_COLLATERAL_ESCROWED,
      loanPrincipalDisbursement: AccountMutationType.LOAN_PRINCIPAL_DISBURSEMENT,
      loanDisbursementReceived: AccountMutationType.LOAN_DISBURSEMENT_RECEIVED,
      loanPrincipalDisbursementFee: AccountMutationType.LOAN_PRINCIPAL_DISBURSEMENT_FEE,
      loanRepayment: AccountMutationType.LOAN_REPAYMENT,
      loanCollateralRelease: AccountMutationType.LOAN_COLLATERAL_RELEASE,
      loanCollateralReturned: AccountMutationType.LOAN_COLLATERAL_RETURNED,
      loanCollateralReleased: AccountMutationType.LOAN_COLLATERAL_RELEASED,
      loanLiquidationRelease: AccountMutationType.LOAN_LIQUIDATION_RELEASE,
      loanLiquidationSurplus: AccountMutationType.LOAN_LIQUIDATION_SURPLUS,
      loanLiquidationReleaseFee: AccountMutationType.LOAN_LIQUIDATION_RELEASE_FEE,
      loanPrincipalFunded: AccountMutationType.LOAN_PRINCIPAL_FUNDED,
      loanOfferPrincipalEscrowed: AccountMutationType.LOAN_OFFER_PRINCIPAL_ESCROWED,
      loanPrincipalReturned: AccountMutationType.LOAN_PRINCIPAL_RETURNED,
      loanPrincipalReturnedFee: AccountMutationType.LOAN_PRINCIPAL_RETURNED_FEE,
      loanInterestReceived: AccountMutationType.LOAN_INTEREST_RECEIVED,
      loanRepaymentReceived: AccountMutationType.LOAN_REPAYMENT_RECEIVED,
      loanLiquidationRepayment: AccountMutationType.LOAN_LIQUIDATION_REPAYMENT,
      loanDisbursementPrincipal: AccountMutationType.LOAN_DISBURSEMENT_PRINCIPAL,
      loanDisbursementFee: AccountMutationType.LOAN_DISBURSEMENT_FEE,
      loanRedeliveryFee: AccountMutationType.LOAN_REDELIVERY_FEE,
      loanLiquidationFee: AccountMutationType.LOAN_LIQUIDATION_FEE,
      loanLiquidationCollateralUsed: AccountMutationType.LOAN_LIQUIDATION_COLLATERAL_USED,
      withdrawalRequested: AccountMutationType.WITHDRAWAL_REQUESTED,
      withdrawalRefunded: AccountMutationType.WITHDRAWAL_REFUNDED,
      platformFeeCharged: AccountMutationType.PLATFORM_FEE_CHARGED,
      platformFeeRefunded: AccountMutationType.PLATFORM_FEE_REFUNDED,
    };

    return typeMap[mutationType] || AccountMutationType.PLATFORM_FEE_CHARGED;
  }

  /**
   * Generate human-readable description for mutation
   */
  private generateMutationDescription(mutation: AccountMutation): string {
    const typeDescriptions: Record<string, string> = {
      invoiceReceived: 'Invoice payment received',
      loanCollateralDeposit: 'Loan collateral deposit',
      loanApplicationCollateralEscrowed: 'Loan application collateral escrowed',
      loanPrincipalDisbursement: 'Loan principal disbursement',
      loanDisbursementReceived: 'Loan disbursement received',
      loanPrincipalDisbursementFee: 'Loan principal disbursement fee',
      loanRepayment: 'Loan repayment',
      loanCollateralRelease: 'Loan collateral release',
      loanCollateralReturned: 'Loan collateral returned',
      loanCollateralReleased: 'Loan collateral released',
      loanLiquidationRelease: 'Loan liquidation release',
      loanLiquidationSurplus: 'Loan liquidation surplus',
      loanLiquidationReleaseFee: 'Loan liquidation release fee',
      loanPrincipalFunded: 'Loan principal funded',
      loanOfferPrincipalEscrowed: 'Loan offer principal escrowed',
      loanPrincipalReturned: 'Loan principal returned',
      loanPrincipalReturnedFee: 'Loan principal returned fee',
      loanInterestReceived: 'Loan interest received',
      loanRepaymentReceived: 'Loan repayment received',
      loanLiquidationRepayment: 'Loan liquidation repayment',
      loanDisbursementPrincipal: 'Loan disbursement principal',
      loanDisbursementFee: 'Loan disbursement fee',
      loanRedeliveryFee: 'Loan redelivery fee',
      loanLiquidationFee: 'Loan liquidation fee',
      loanLiquidationCollateralUsed: 'Loan liquidation collateral used',
      withdrawalRequested: 'Withdrawal requested',
      withdrawalRefunded: 'Withdrawal refunded',
      platformFeeCharged: 'Platform fee charged',
      platformFeeRefunded: 'Platform fee refunded',
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
}
