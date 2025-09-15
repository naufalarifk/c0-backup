import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { LoanStatus as RepositoryLoanStatus } from '../../../shared/repositories/loan.types';
import { LoanStatus, PaginationMetaDto, UserRole } from '../dto/common.dto';
import {
  EarlyLiquidationEstimateData,
  EarlyLiquidationEstimateResponseDto,
  EarlyLiquidationRequestData,
  EarlyLiquidationRequestDto,
  EarlyLiquidationRequestResponseDto,
  EarlyRepaymentRequestData,
  EarlyRepaymentRequestDto,
  EarlyRepaymentRequestResponseDto,
} from '../dto/loan-operations.dto';
import {
  LoanListResponseDto,
  LoanResponseDto,
  LoanValuationListResponseDto,
} from '../dto/loans.dto';

interface ListLoansParams {
  page: number;
  limit: number;
  role?: UserRole;
  status?: LoanStatus;
}

interface PaginationParams {
  page: number;
  limit: number;
}

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
  ) {}

  /**
   * List loans for a user
   */
  async listLoans(userId: string, params: ListLoansParams): Promise<LoanListResponseDto> {
    try {
      this.logger.log(`Listing loans for user: ${userId}`);

      // Map params role to repository role
      let role: 'borrower' | 'lender' | undefined;
      if (params.role === UserRole.BORROWER) {
        role = 'borrower';
      } else if (params.role === UserRole.LENDER) {
        role = 'lender';
      }

      const result = await this.repository.userViewsLoans({
        userId,
        role,
        page: params.page,
        limit: params.limit,
        status: this.mapDtoStatusToRepository(params.status),
      });

      // Map repository loans to DTO format
      const loans = result.loans.map(loan => {
        // Map repository loan status to DTO status
        let dtoStatus;
        switch (loan.status) {
          case 'Originated':
            dtoStatus = loan.disbursementDate ? 'DISBURSED' : 'ORIGINATED';
            break;
          case 'Active':
            dtoStatus = 'ACTIVE';
            break;
          case 'Liquidated':
            dtoStatus = 'LIQUIDATED';
            break;
          case 'Repaid':
            dtoStatus = 'REPAID';
            break;
          case 'Defaulted':
            dtoStatus = 'LIQUIDATED'; // Map defaulted to liquidated for now
            break;
          default:
            dtoStatus = 'ORIGINATED';
        }

        return {
          id: loan.id,
          borrowerId: loan.borrowerUserId,
          lenderId: loan.lenderUserId,
          principalCurrency: {
            blockchainKey: loan.principalCurrency.blockchainKey,
            tokenId: loan.principalCurrency.tokenId,
            symbol: loan.principalCurrency.symbol,
            name: loan.principalCurrency.name,
            decimals: loan.principalCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${loan.principalCurrency.symbol.toLowerCase()}.png`,
          },
          principalAmount: loan.principalAmount,
          collateralCurrency: {
            blockchainKey: loan.collateralCurrency.blockchainKey,
            tokenId: loan.collateralCurrency.tokenId,
            symbol: loan.collateralCurrency.symbol,
            name: loan.collateralCurrency.name,
            decimals: loan.collateralCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${loan.collateralCurrency.symbol.toLowerCase()}.png`,
          },
          collateralAmount: loan.collateralAmount,
          interestRate: this.calculateInterestRate(loan.interestAmount, loan.principalAmount),
          termMonths: this.calculateTermMonths(loan.originationDate, loan.maturityDate),
          currentLtv: loan.currentLtvRatio || 0,
          maxLtvRatio: loan.mcLtvRatio,
          status: dtoStatus,
          originationDate: loan.originationDate.toISOString(),
          disbursementDate: loan.disbursementDate?.toISOString(),
          maturityDate: loan.maturityDate.toISOString(),
          loanBreakdown: {
            principalAmount: loan.principalAmount,
            interestAmount: loan.interestAmount,
            originationFeeAmount: this.calculateOriginationFee(loan.principalAmount),
            totalRepaymentAmount: loan.repaymentAmount,
          },
        };
      });

      const pagination: PaginationMetaDto = {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev,
      };

      return {
        success: true,
        data: {
          loans,
          pagination,
        },
      };
    } catch (error) {
      this.logger.error('Failed to list loans', error);
      throw new BadRequestException('Failed to retrieve loans');
    }
  }

  /**
   * Get loan details
   */
  async getLoanDetails(userId: string, loanId: string): Promise<LoanResponseDto> {
    try {
      this.logger.log(`Getting loan details for loan: ${loanId}, user: ${userId}`);

      const result = await this.repository.userViewsLoanDetails({
        loanId,
        userId,
      });

      // Map repository loan status to DTO status
      let dtoStatus;
      switch (result.status) {
        case 'Originated':
          dtoStatus = result.disbursementDate ? 'DISBURSED' : 'ORIGINATED';
          break;
        case 'Active':
          dtoStatus = 'ACTIVE';
          break;
        case 'Liquidated':
          dtoStatus = 'LIQUIDATED';
          break;
        case 'Repaid':
          dtoStatus = 'REPAID';
          break;
        case 'Defaulted':
          dtoStatus = 'LIQUIDATED'; // Map defaulted to liquidated for now
          break;
        default:
          dtoStatus = 'ORIGINATED';
      }

      return {
        id: result.id,
        borrowerId: result.borrowerUserId,
        lenderId: result.lenderUserId,
        principalCurrency: {
          blockchainKey: result.principalCurrency.blockchainKey,
          tokenId: result.principalCurrency.tokenId,
          symbol: result.principalCurrency.symbol,
          name: result.principalCurrency.name,
          decimals: result.principalCurrency.decimals,
          logoUrl: `https://assets.cryptogadai.com/currencies/${result.principalCurrency.symbol.toLowerCase()}.png`,
        },
        principalAmount: result.principalAmount,
        collateralCurrency: {
          blockchainKey: result.collateralCurrency.blockchainKey,
          tokenId: result.collateralCurrency.tokenId,
          symbol: result.collateralCurrency.symbol,
          name: result.collateralCurrency.name,
          decimals: result.collateralCurrency.decimals,
          logoUrl: `https://assets.cryptogadai.com/currencies/${result.collateralCurrency.symbol.toLowerCase()}.png`,
        },
        collateralAmount: result.collateralAmount,
        interestRate: this.calculateInterestRate(result.interestAmount, result.principalAmount),
        termMonths: this.calculateTermMonths(result.originationDate, result.maturityDate),
        currentLtv: result.currentLtvRatio || 0,
        maxLtvRatio: result.mcLtvRatio,
        status: dtoStatus,
        originationDate: result.originationDate.toISOString(),
        disbursementDate: result.disbursementDate?.toISOString(),
        maturityDate: result.maturityDate.toISOString(),
        loanBreakdown: {
          principalAmount: result.principalAmount,
          interestAmount: result.interestAmount,
          originationFeeAmount: this.calculateOriginationFee(result.principalAmount),
          totalRepaymentAmount: result.redeliveryAmount,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to get loan details', error);
      throw new BadRequestException('Failed to retrieve loan details');
    }
  }

  /**
   * Get loan valuation history
   */
  async getLoanValuations(
    userId: string,
    loanId: string,
    params: PaginationParams,
  ): Promise<LoanValuationListResponseDto> {
    try {
      this.logger.log(`Getting loan valuations for loan: ${loanId}, user: ${userId}`);

      const result = await this.repository.userViewsLoanValuationHistory({
        loanId,
        userId,
        limit: params.limit,
      });

      const valuations = result.data.map(valuation => ({
        id: valuation.exchangeRateId,
        loanId,
        valuationDate: valuation.valuationDate.toISOString(),
        ltvRatio: valuation.ltvRatio,
        collateralValue: valuation.collateralValuationAmount,
        exchangeRate: '2300.000000000000000000', // TODO: Get actual exchange rate from valuation
      }));

      return {
        success: true,
        data: {
          valuations,
          pagination: result.pagination || {
            page: params.page,
            limit: params.limit,
            total: valuations.length,
            totalPages: Math.ceil(valuations.length / params.limit),
            hasNext: false,
            hasPrev: false,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get loan valuations', error);
      throw new BadRequestException('Failed to retrieve loan valuations');
    }
  }

  /**
   * Calculate early liquidation estimate
   */
  async calculateEarlyLiquidation(
    userId: string,
    loanId: string,
  ): Promise<EarlyLiquidationEstimateResponseDto> {
    try {
      this.logger.log(`Calculating early liquidation for loan: ${loanId}, borrower: ${userId}`);

      // 1. Validate loan exists and user is borrower
      const loanDetails = await this.repository.userViewsLoanDetails({
        loanId,
        userId,
      });

      // 2. Check loan is eligible for early liquidation (Active status)
      if (loanDetails.status !== 'Active') {
        throw new BadRequestException('Loan is not eligible for early liquidation');
      }

      // 3. Calculate liquidation breakdown
      const liquidationFeeRate = 0.01; // 1% fee
      const liquidationFee = (
        parseFloat(loanDetails.collateralAmount) * liquidationFeeRate
      ).toString();
      const estimatedProceeds = (
        parseFloat(loanDetails.collateralAmount) - parseFloat(liquidationFee)
      ).toString();

      return {
        success: true,
        data: {
          loanId,
          calculationDate: new Date().toISOString(),
          currentCollateralValue: loanDetails.collateralAmount,
          currentLtvRatio: loanDetails.currentLtvRatio || 0,
          liquidationFee: liquidationFee + '.000000000000000000',
          estimatedProceeds: estimatedProceeds + '.000000000000000000',
          disclaimers: [
            'Actual liquidation proceeds may vary due to market conditions',
            'Exchange rates are subject to change until execution',
            'Early liquidation fee of 1% is final and non-refundable',
          ],
        },
      };
    } catch (error) {
      this.logger.error('Failed to calculate early liquidation', error);
      throw new BadRequestException('Failed to calculate early liquidation estimate');
    }
  }

  /**
   * Request early liquidation
   */
  async requestEarlyLiquidation(
    userId: string,
    loanId: string,
    requestDto: EarlyLiquidationRequestDto,
  ): Promise<EarlyLiquidationRequestResponseDto> {
    try {
      this.logger.log(`Requesting early liquidation for loan: ${loanId}, borrower: ${userId}`);

      if (!requestDto.acknowledgment) {
        throw new BadRequestException('You must acknowledge the terms and conditions');
      }

      // 1. Validate loan exists and user is borrower
      const loanDetails = await this.repository.userViewsLoanDetails({
        loanId,
        userId,
      });

      // 2. Check loan is eligible for early liquidation
      if (loanDetails.status !== 'Active') {
        throw new BadRequestException('Loan is not eligible for early liquidation');
      }

      // 3. Create liquidation request (TODO: Implement repository method for this)
      const liquidationId = `liq_${Date.now()}`;

      // 4. TODO: Queue liquidation processing
      // 5. TODO: Send notification

      return {
        success: true,
        data: {
          liquidationId,
          loanId,
          status: 'Pending' as const,
          submittedDate: new Date().toISOString(),
          estimatedCompletionTime: '2-4 hours',
          nextSteps: [
            'Collateral will be liquidated on the market',
            'Loan payment will be processed',
            'Any surplus will be credited to your account',
            'You will receive email confirmation when complete',
          ],
        },
        message: 'Early liquidation request submitted successfully. Processing will begin shortly.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to request early liquidation', error);
      throw new BadRequestException('Failed to submit early liquidation request');
    }
  }

  /**
   * Request early repayment
   */
  async requestEarlyRepayment(
    userId: string,
    loanId: string,
    requestDto: EarlyRepaymentRequestDto,
  ): Promise<EarlyRepaymentRequestResponseDto> {
    try {
      this.logger.log(`Requesting early repayment for loan: ${loanId}, borrower: ${userId}`);

      if (!requestDto.acknowledgment) {
        throw new BadRequestException('You must acknowledge the terms and conditions');
      }

      // 1. Validate loan exists and user is borrower
      const loanDetails = await this.repository.userViewsLoanDetails({
        loanId,
        userId,
      });

      // 2. Check loan is eligible for early repayment
      if (loanDetails.status !== 'Active') {
        throw new BadRequestException('Loan is not eligible for early repayment');
      }

      // 3. Calculate full repayment amount (no interest reduction)
      const totalRepaymentAmount = loanDetails.repaymentAmount;

      // 4. TODO: Create repayment invoice
      // 5. TODO: Create repayment request record
      // 6. TODO: Send notification

      const repaymentId = `rep_${Date.now()}`;

      return {
        success: true,
        data: {
          repaymentId,
          loanId,
          repaymentAmount: totalRepaymentAmount,
          status: 'Pending' as const,
          submittedDate: new Date().toISOString(),
          nextSteps: [
            `Pay ${totalRepaymentAmount} to complete early repayment`,
            'Collateral will be released upon payment confirmation',
            'You will receive email confirmation when complete',
          ],
        },
        message:
          'Early repayment request submitted successfully. Please complete the payment to finalize repayment.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to request early repayment', error);
      throw new BadRequestException('Failed to submit early repayment request');
    }
  }

  private calculateInterestRate(interestAmount: string, principalAmount: string): number {
    const interest = parseFloat(interestAmount);
    const principal = parseFloat(principalAmount);
    return principal > 0 ? (interest / principal) * 100 : 0;
  }

  private calculateTermMonths(originationDate: Date, maturityDate: Date): number {
    const diffTime = maturityDate.getTime() - originationDate.getTime();
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44); // Average days per month
    return Math.round(diffMonths);
  }

  private calculateOriginationFee(principalAmount: string): string {
    const principal = parseFloat(principalAmount);
    const fee = principal * 0.03; // 3% fee
    return fee.toFixed(18);
  }

  private mapDtoStatusToRepository(status?: LoanStatus): RepositoryLoanStatus | undefined {
    if (!status) return undefined;

    switch (status) {
      case LoanStatus.ORIGINATED:
        return 'Originated';
      case LoanStatus.DISBURSED:
        // Repository doesn't have DISBURSED, map to Originated
        return 'Originated';
      case LoanStatus.ACTIVE:
        return 'Active';
      case LoanStatus.REPAID:
        return 'Repaid';
      case LoanStatus.LIQUIDATED:
        return 'Liquidated';
      default:
        return undefined;
    }
  }
}
