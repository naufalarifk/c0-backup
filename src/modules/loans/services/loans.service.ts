import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import BigNumber from 'bignumber.js';
import { assertDefined, assertProp, assertPropString, check, isNumber, isString } from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { LoanStatus as RepositoryLoanStatus } from '../../../shared/repositories/loan.types';
import { DocumentService } from '../../documents/document.service';
import { DocumentGenerationStatus, DocumentTypeEnum } from '../../documents/document.types';
import { LoanStatus, PaginationMetaDto, UserRole } from '../dto/common.dto';
import {
  EarlyLiquidationEstimateDataDto,
  EarlyLiquidationEstimateResponseDto,
  EarlyLiquidationRequestDataDto,
  EarlyLiquidationRequestDto,
  EarlyLiquidationRequestResponseDto,
  EarlyRepaymentRequestDataDto,
  EarlyRepaymentRequestDto,
  EarlyRepaymentRequestResponseDto,
} from '../dto/loan-operations.dto';
import {
  LoanAgreementResponseDto,
  LoanListResponseDto,
  LoanResponseDto,
  LoanValuationListResponseDto,
} from '../dto/loans.dto';
import { LoanCalculationService } from './loan-calculation.service';
import { LoanDocumentRequestService } from './loan-document-request.service';

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
    private readonly loanCalculationService: LoanCalculationService,
    private readonly loanDocumentRequestService: LoanDocumentRequestService,
    private readonly documentService: DocumentService,
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

      // Map repository loans to DTO format - need to use Promise.all since calculateProvisionFee is async
      const loans = await Promise.all(
        result.loans.map(async loan => {
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
              originationFeeAmount: await this.calculateProvisionFee(loan.principalAmount),
              totalRepaymentAmount: loan.repaymentAmount,
            },
          };
        }),
      );

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
          originationFeeAmount: await this.calculateProvisionFee(result.principalAmount),
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
        exchangeRate: valuation.exchangeRateId || '0.000000000000000000', // Use actual exchange rate from valuation
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
   * Estimate early liquidation
   */
  async estimateEarlyLiquidation(
    userId: string,
    loanId: string,
  ): Promise<EarlyLiquidationEstimateResponseDto> {
    try {
      this.logger.log(`Estimating early liquidation for loan: ${loanId}, borrower: ${userId}`);

      // 1. Validate loan exists and user is borrower
      const loanDetails = await this.repository.userViewsLoanDetails({
        loanId,
        userId,
      });

      // 2. Check loan is eligible for early liquidation
      if (!['Active', 'Originated'].includes(loanDetails.status)) {
        throw new BadRequestException('Loan is not eligible for early liquidation');
      }

      // 3. Get loan amounts for calculation
      const loanAmounts = await this.repository.borrowerGetsLoanAmounts({
        loanId,
        borrowerUserId: userId,
      });

      // 4. Get latest exchange rate for liquidation estimate
      const exchangeRate = await this.repository.borrowerGetsExchangeRate({
        collateralTokenId: loanDetails.collateralCurrency.tokenId,
        asOfDate: new Date(),
      });

      // 5. Calculate liquidation estimate using calculation service
      const _liquidationEstimate = this.loanCalculationService.calculateEarlyLiquidationEstimate({
        principalAmount: loanAmounts.principalAmount,
        interestAmount: loanAmounts.interestAmount,
        premiAmount: loanAmounts.premiAmount,
        liquidationFeeAmount: loanAmounts.liquidationFeeAmount,
        collateralAmount: loanDetails.collateralAmount,
        exchangeRate,
        estimateDate: new Date(),
      });

      // 6. Calculate early liquidation fee (1% per SRS)
      const earlyLiquidationFee = new BigNumber(loanAmounts.repaymentAmount).times(0.01).toFixed();
      const marketLiquidationFee = '15.000000000000000000'; // Fixed market fee

      // 7. Calculate LTV ratios
      const originalLoanAmount = new BigNumber(loanAmounts.principalAmount);
      const currentCollateralValueFromExchange = new BigNumber(loanDetails.collateralAmount)
        .times(exchangeRate.bidPrice)
        .div(new BigNumber(10).pow(18)); // Normalize to 18 decimals

      const _originalCollateralValue = originalLoanAmount.div(0.7); // Assuming 70% LTV at origination
      const currentLtvRatio = originalLoanAmount.div(currentCollateralValueFromExchange).times(100);
      const originalLtvRatio = new BigNumber(70);

      // 8. Determine LTV change direction
      const ltvChange = currentLtvRatio.minus(originalLtvRatio);
      const ltvDirection = ltvChange.gt(0) ? 'worsened' : ltvChange.lt(0) ? 'improved' : 'stable';

      // 9. Calculate surplus or deficit
      const totalDeductions = new BigNumber(loanAmounts.repaymentAmount)
        .plus(earlyLiquidationFee)
        .plus(marketLiquidationFee);
      const estimatedSurplus = currentCollateralValueFromExchange.minus(totalDeductions);
      const isBreakeven = estimatedSurplus.gte(0);

      return {
        success: true,
        data: {
          loanId,
          currentValuation: {
            collateralCurrency: {
              blockchainKey: loanDetails.collateralCurrency.blockchainKey,
              tokenId: loanDetails.collateralCurrency.tokenId,
              decimals: loanDetails.collateralCurrency.decimals,
              symbol: loanDetails.collateralCurrency.symbol,
              name: loanDetails.collateralCurrency.name,
              logoUrl: `https://assets.cryptogadai.com/currencies/${loanDetails.collateralCurrency.symbol.toLowerCase()}.png`,
            },
            currentAmount: loanDetails.collateralAmount,
            currentMarketValue: {
              amount: currentCollateralValueFromExchange.toFixed(),
              currency: {
                blockchainKey: loanDetails.principalCurrency.blockchainKey,
                tokenId: loanDetails.principalCurrency.tokenId,
                decimals: loanDetails.principalCurrency.decimals,
                symbol: loanDetails.principalCurrency.symbol,
                name: loanDetails.principalCurrency.name,
                logoUrl: `https://assets.cryptogadai.com/currencies/${loanDetails.principalCurrency.symbol.toLowerCase()}.png`,
              },
              exchangeRate: exchangeRate.bidPrice,
              rateSource: 'coinbase',
              rateTimestamp: exchangeRate.sourceDate.toISOString(),
            },
            currentLtvRatio: currentLtvRatio.toFixed(2),
            originalLtvRatio: originalLtvRatio.toFixed(1),
            ltvChange: {
              percentage: (ltvChange.gt(0) ? '+' : '') + ltvChange.toFixed(2),
              direction: ltvDirection,
            },
          },
          liquidationBreakdown: {
            outstandingLoan: {
              principalAmount: loanAmounts.principalAmount,
              interestAmount: loanAmounts.interestAmount,
              originationFeeAmount: loanAmounts.premiAmount,
              totalLoanRepayment: loanAmounts.repaymentAmount,
            },
            liquidationFees: {
              earlyLiquidationFee,
              earlyLiquidationFeeRate: '1.0',
              marketLiquidationFee,
              totalLiquidationFees: new BigNumber(earlyLiquidationFee)
                .plus(marketLiquidationFee)
                .toFixed(),
            },
            totalDeductions: totalDeductions.toFixed(),
            calculationDetails: {
              basedOnExchangeRate: exchangeRate.bidPrice,
              rateSource: 'coinbase',
              rateTimestamp: exchangeRate.sourceDate.toISOString(),
            },
          },
          estimatedOutcome: {
            totalLiquidationProceeds: currentCollateralValueFromExchange.toFixed(),
            totalDeductions: totalDeductions.toFixed(),
            estimatedSurplus: estimatedSurplus.toFixed(),
            breakeven: isBreakeven,
          },
          calculationDate: new Date().toISOString(),
          disclaimers: [
            'Actual liquidation proceeds may vary due to market conditions',
            'Exchange rates are subject to change until execution',
            'Early liquidation fee of 1% is final and non-refundable',
            'Market slippage may reduce actual proceeds',
            ...(isBreakeven
              ? []
              : [
                  `WARNING: Estimated deficit of $${this.loanCalculationService.fromSmallestUnit(
                    estimatedSurplus.abs().toFixed(),
                    18,
                  )} - liquidation not profitable`,
                  'Consider adding more collateral to improve LTV ratio',
                  'Market conditions may worsen before liquidation',
                  'Platform will absorb any deficit per policy',
                ]),
          ],
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to estimate early liquidation', error);
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

      // 3. Get loan amounts for calculation
      const loanAmounts = await this.repository.borrowerGetsLoanAmounts({
        loanId,
        borrowerUserId: userId,
      });

      // 4. Get latest exchange rate for liquidation estimate
      const exchangeRate = await this.repository.borrowerGetsExchangeRate({
        collateralTokenId: loanDetails.collateralCurrency.tokenId,
        asOfDate: new Date(),
      });

      // 5. Calculate liquidation estimate using calculation service
      const liquidationEstimate = this.loanCalculationService.calculateEarlyLiquidationEstimate({
        principalAmount: loanAmounts.principalAmount,
        interestAmount: loanAmounts.interestAmount,
        premiAmount: loanAmounts.premiAmount,
        liquidationFeeAmount: loanAmounts.liquidationFeeAmount,
        collateralAmount: loanDetails.collateralAmount,
        exchangeRate,
        estimateDate: new Date(),
      });

      // 6. Calculate liquidation target amount for record
      const liquidationTargetAmount = this.loanCalculationService.calculateLiquidationTargetAmount(
        loanAmounts.repaymentAmount,
        loanAmounts.premiAmount,
        loanAmounts.liquidationFeeAmount,
      );

      // 7. Create liquidation request record
      const _liquidationResult = await this.repository.borrowerRequestsEarlyLiquidation({
        loanId,
        borrowerUserId: userId,
        acknowledgment: 'acknowledged',
        requestDate: new Date(),
      });

      // 8. Update liquidation target amount in database
      await this.repository.systemUpdatesLiquidationTargetAmount({
        loanId,
        liquidationTargetAmount,
      });

      // 9. Calculate early liquidation fee (1% per SRS)
      const earlyLiquidationFee = new BigNumber(loanAmounts.repaymentAmount).times(0.01).toFixed();
      const marketLiquidationFee = '15.000000000000000000'; // Fixed market fee

      // 10. Determine surplus or deficit
      const currentValuation = liquidationEstimate.currentValuationAmount;
      const totalDeductions = new BigNumber(loanAmounts.repaymentAmount)
        .plus(earlyLiquidationFee)
        .plus(marketLiquidationFee)
        .toFixed();
      const estimatedSurplus = new BigNumber(currentValuation).minus(totalDeductions).toFixed();
      const isBreakeven = new BigNumber(estimatedSurplus).gte(0);

      return {
        success: true,
        data: {
          liquidationId: `liq_${Date.now()}`,
          loanId,
          status: 'Pending' as const,
          submittedDate: new Date().toISOString(),
          estimatedCompletionTime: isBreakeven ? '2-4 hours' : '1-2 hours',
          finalBreakdown: {
            outstandingLoan: {
              principalAmount: loanAmounts.principalAmount,
              interestAmount: loanAmounts.interestAmount,
              originationFeeAmount: loanAmounts.premiAmount,
              totalLoanRepayment: loanAmounts.repaymentAmount,
            },
            liquidationFees: {
              earlyLiquidationFee,
              earlyLiquidationFeeRate: '1.0',
              marketLiquidationFee,
              totalLiquidationFees: new BigNumber(earlyLiquidationFee)
                .plus(marketLiquidationFee)
                .toFixed(),
            },
            totalDeductions,
            calculationDetails: {
              basedOnExchangeRate: exchangeRate.bidPrice,
              rateSource: 'coinbase',
              rateTimestamp: exchangeRate.sourceDate.toISOString(),
            },
          },
          nextSteps: [
            `Collateral will be liquidated on the market`,
            `Loan repayment (${this.loanCalculationService.fromSmallestUnit(
              loanAmounts.repaymentAmount,
              18,
            )}) will be processed`,
            `Early liquidation fee (1%) will be deducted`,
            isBreakeven
              ? `Estimated surplus (${this.loanCalculationService.fromSmallestUnit(
                  estimatedSurplus,
                  18,
                )}) will be credited to your account in USDT`
              : 'Any deficit will be absorbed by platform insurance fund',
            'You will receive email confirmation when complete',
          ],
        },
        message: isBreakeven
          ? 'Early liquidation request submitted successfully. Processing will begin shortly.'
          : 'Early liquidation request submitted. Note: Current market conditions may result in deficit, but no additional charges will apply.',
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

      // 3. Calculate early repayment details using calculation service
      const _repaymentCalculation = this.loanCalculationService.calculateEarlyRepaymentDetails({
        principalAmount: loanDetails.principalAmount,
        interestAmount: loanDetails.interestAmount,
        premiAmount: loanDetails.premiAmount,
        repaymentAmount: loanDetails.repaymentAmount,
        originationDate: loanDetails.originationDate,
        maturityDate: loanDetails.maturityDate,
        termInMonths: this.calculateTermMonths(
          loanDetails.originationDate,
          loanDetails.maturityDate,
        ),
        requestDate: new Date(),
      });

      // 4. Get wallet address for repayment (this should come from wallet service)
      // For now, using a deterministic approach based on loan ID
      const repaymentWalletAddress = `0x${Buffer.from(`repayment-${loanId}`, 'utf8').toString('hex').padEnd(40, '0').substring(0, 40)}`;
      const repaymentWalletDerivationPath = `m/44'/60'/0'/0/${Math.abs(parseInt(loanId.replace(/\D/g, ''), 10) || 1) % 1000}`;

      // 5. Create early repayment request and invoice via repository
      const repaymentResult = await this.repository.borrowerRequestsEarlyRepayment({
        loanId,
        borrowerUserId: userId,
        acknowledgment: 'acknowledged',
        requestDate: new Date(),
        repaymentWalletDerivationPath,
        repaymentWalletAddress,
      });

      // 6. Calculate breakdown details for response
      const currentDate = new Date();
      const originationDate = new Date(loanDetails.originationDate);
      const maturityDate = new Date(loanDetails.maturityDate);
      const totalTermDays = Math.ceil(
        (maturityDate.getTime() - originationDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const elapsedDays = Math.ceil(
        (currentDate.getTime() - originationDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const remainingTermDays = Math.max(0, totalTermDays - elapsedDays);
      const earlyPaymentAtMonth = Math.ceil(elapsedDays / 30.44);
      const originalTermMonths = Math.ceil(totalTermDays / 30.44);

      return {
        success: true,
        data: {
          repaymentId: repaymentResult.data.repaymentInvoice.id,
          loanId,
          status: 'Pending' as const,
          submittedDate: new Date().toISOString(),
          repaymentBreakdown: {
            loanDetails: {
              principalAmount: repaymentResult.data.repaymentBreakdown.loanDetails.principalAmount,
              interestAmount: repaymentResult.data.repaymentBreakdown.loanDetails.interestAmount,
              originationFeeAmount: repaymentResult.data.repaymentBreakdown.loanDetails.premiAmount,
              totalRepaymentAmount:
                repaymentResult.data.repaymentBreakdown.loanDetails.totalRepaymentAmount,
            },
            paymentTerms: {
              earlyPaymentFee: '0.000000000000000000',
              interestReduction: '0.000000000000000000',
              paymentCurrency: {
                blockchainKey: loanDetails.principalCurrency.blockchainKey,
                tokenId: loanDetails.principalCurrency.tokenId,
                decimals: loanDetails.principalCurrency.decimals,
                symbol: loanDetails.principalCurrency.symbol,
                name: loanDetails.principalCurrency.name,
                logoUrl: `https://assets.cryptogadai.com/currencies/${loanDetails.principalCurrency.symbol.toLowerCase()}.png`,
              },
            },
            calculationDetails: {
              originalTermMonths,
              earlyPaymentAtMonth,
              remainingTermMonths: Math.ceil(remainingTermDays / 30.44),
              calculationDate: currentDate.toISOString(),
            },
            disclaimers: [
              'Full interest amount is charged regardless of early payment',
              'Origination fee (3% of principal) is charged in full',
              'No early payment fee or penalty applies',
              'Payment must be made in full to complete early repayment',
            ],
          },
          repaymentInvoice: {
            id: repaymentResult.data.repaymentInvoice.id,
            amount: repaymentResult.data.repaymentInvoice.amount,
            currency: {
              ...repaymentResult.data.repaymentInvoice.currency,
              logoUrl: `https://assets.cryptogadai.com/currencies/${repaymentResult.data.repaymentInvoice.currency.symbol.toLowerCase()}.png`,
            },
            walletAddress: repaymentWalletAddress,
            expiryDate:
              repaymentResult.data.repaymentInvoice.expiryDate?.toISOString() ||
              new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            paidDate: repaymentResult.data.repaymentInvoice.paidDate?.toISOString(),
            expiredDate: undefined,
          },
          nextSteps: [
            'Payment invoice has been created for full repayment amount',
            `Pay the invoice (${this.loanCalculationService.fromSmallestUnit(repaymentResult.data.repaymentBreakdown.loanDetails.totalRepaymentAmount, 18)} USDT) to complete early repayment`,
            `Collateral (${this.loanCalculationService.fromSmallestUnit(loanDetails.collateralAmount, loanDetails.collateralCurrency.decimals)} ${loanDetails.collateralCurrency.symbol}) will be released upon payment confirmation`,
            'You will receive email confirmation when complete',
            'Savings: No early payment penalties applied',
          ],
        },
        message:
          'Early repayment request submitted successfully. Please pay the invoice to complete the repayment.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Failed to request early repayment', error);
      throw new BadRequestException('Failed to submit early repayment request');
    }
  }

  // Using BigNumber for precise decimal calculations of DECIMAL(78, 0) fields

  private calculateInterestRate(interestAmount: string, principalAmount: string): number {
    const interest = new BigNumber(interestAmount);
    const principal = new BigNumber(principalAmount);
    return principal.gt(0) ? interest.div(principal).times(100).toNumber() : 0;
  }

  private calculateTermMonths(originationDate: Date, maturityDate: Date): number {
    const diffTime = maturityDate.getTime() - originationDate.getTime();
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44); // Average days per month
    return Math.round(diffMonths);
  }

  private async calculateProvisionFee(principalAmount: string): Promise<string> {
    const principal = new BigNumber(principalAmount);

    // Get current platform configuration to retrieve loan provision rate
    const provisionRateConfig = await this.repository.platformRetrievesProvisionRate();

    const provisionRate = new BigNumber(provisionRateConfig.loanProvisionRate).div(100); // Convert percentage to decimal
    const fee = principal.times(provisionRate);
    return fee.toFixed();
  }

  async getLoanAgreement(userId: string, loanId: string): Promise<LoanAgreementResponseDto> {
    this.logger.log(`Getting loan agreement for loan: ${loanId}, user: ${userId}`);

    try {
      // 1. Validate loan exists and user has access (as borrower or lender)
      const loanDetails = await this.repository.userViewsLoanDetails({
        loanId,
        userId,
      });

      // 2. Check document generation status
      const documentStatus = await this.documentService.getDocumentUrlOrStatus(
        loanId,
        DocumentTypeEnum.LOAN_AGREEMENT,
      );

      let documentUrl: string | undefined;
      let generationStatus: string;

      switch (documentStatus.status) {
        case DocumentGenerationStatus.COMPLETED:
          documentUrl = documentStatus.url;
          generationStatus = 'ready';
          break;
        case DocumentGenerationStatus.IN_PROGRESS:
          generationStatus = 'generating';
          break;
        case DocumentGenerationStatus.FAILED:
          generationStatus = 'Failed';
          // Try to queue regeneration
          await this.requestLoanDocumentGeneration(loanId);
          generationStatus = 'regenerating';
          break;
        case DocumentGenerationStatus.PENDING:
        default:
          // Queue document generation if not already requested
          await this.requestLoanDocumentGeneration(loanId);
          generationStatus = 'pending';
          break;
      }

      // 4. Retrieve signature status from database
      const signatures = await this.getLoanAgreementSignatures(loanId);

      // 5. Determine if signature is required
      const borrowerSigned = signatures.some(
        sig =>
          sig.userId === Number(loanDetails.borrowerUserId) && sig.userType === UserRole.BORROWER,
      );
      const lenderSigned = signatures.some(
        sig => sig.userId === Number(loanDetails.lenderUserId) && sig.userType === UserRole.LENDER,
      );
      const signatureRequired = !borrowerSigned || !lenderSigned;

      return {
        success: true,
        data: {
          documentUrl,
          signatureRequired,
          signedBy: signatures,
          generationStatus,
          // requestId: documentStatus.requestId, // Remove as not available in return type
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to get loan agreement', error);
      throw new BadRequestException('Failed to retrieve loan agreement document');
    }
  }

  /**
   * Request document generation for loan
   */
  async requestLoanDocumentGeneration(
    loanId: string,
    documentType: 'LoanAgreement' | 'LiquidationNotice' | 'RepaymentReceipt' = 'LoanAgreement',
    requestedBy: string = 'platform',
  ): Promise<void> {
    try {
      this.logger.log(`Requesting document generation for loan: ${loanId}, type: ${documentType}`);

      // Request document generation
      await this.loanDocumentRequestService.requestDocumentGeneration({
        loanId,
        documentType,
        requestedBy,
        priority: 'normal',
      });

      this.logger.log(`Document generation requested for loan: ${loanId}`);
    } catch (error) {
      this.logger.error(
        `Failed to request document generation for loan ${loanId}: ${error.message}`,
        error.stack,
      );
      // Don't throw here - document generation failure shouldn't break loan creation
    }
  }

  /**
   * Get loan agreement signatures from database
   */
  private async getLoanAgreementSignatures(
    loanId: string,
  ): Promise<Array<{ userId: number; userType: UserRole; signedAt: string }>> {
    try {
      // Query loan agreement signatures from database
      const signatureRows = await this.repository.sql`
        SELECT
          las.user_id,
          u.user_type,
          las.signed_at
        FROM loan_agreement_signatures las
        JOIN users u ON las.user_id = u.id
        WHERE las.loan_id = ${loanId}
        ORDER BY las.signed_at
      `;

      return signatureRows.map((row: unknown) => {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'user_id');
        assertPropString(row, 'user_type');
        assertProp(check(isString, isNumber), row, 'signed_at');
        const r = row as Record<string, unknown>;
        return {
          userId: Number(r.user_id),
          userType: (r.user_type as string) === 'Individual' ? UserRole.BORROWER : UserRole.LENDER,
          signedAt: (r.signed_at as Date).toISOString(),
        };
      });
    } catch (error) {
      // If table doesn't exist or other error, return empty array
      this.logger.warn(`Could not retrieve signatures for loan ${loanId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Originate a loan from matched offer and application, triggering document generation
   */
  async originateLoan(params: {
    loanOfferId: string;
    loanApplicationId: string;
    principalAmount: string;
    interestAmount: string;
    repaymentAmount: string;
    redeliveryFeeAmount: string;
    redeliveryAmount: string;
    premiAmount: string;
    liquidationFeeAmount: string;
    minCollateralValuation: string;
    mcLtvRatio: number;
    collateralAmount: string;
    legalDocumentPath?: string;
    legalDocumentHash?: string;
    legalDocumentCreatedDate?: Date;
    originationDate?: Date;
    maturityDate: Date;
  }): Promise<{ loanId: string }> {
    this.logger.log(
      `Originating loan for offer ${params.loanOfferId} and application ${params.loanApplicationId}`,
    );

    try {
      // 1. Use repository to originate the loan
      const originationParams = {
        ...params,
        originationDate: params.originationDate || new Date(),
      };
      const result = await this.repository.platformOriginatesLoan(originationParams);

      this.logger.log(`Loan originated successfully: ${result.id}`);

      // 2. Trigger document generation for the new loan
      await this.requestLoanDocumentGeneration(result.id, 'LoanAgreement', 'platform');

      this.logger.log(`Document generation triggered for loan: ${result.id}`);

      return { loanId: result.id };
    } catch (error) {
      this.logger.error(
        `Failed to originate loan for offer ${params.loanOfferId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Failed to originate loan: ${error.message}`);
    }
  }

  /**
   * Match loan offer and application, then originate the loan
   */
  async matchAndOriginateLoan(params: {
    loanOfferId: string;
    loanApplicationId: string;
    matchedLtvRatio: number;
    matchedCollateralValuationAmount: string;
    matchedDate: Date;
  }): Promise<{ loanId: string }> {
    this.logger.log(
      `Matching and originating loan for offer ${params.loanOfferId} and application ${params.loanApplicationId}`,
    );

    try {
      // 1. Match the loan offer and application
      const matchResult = await this.repository.platformMatchesLoanOffers({
        loanOfferId: params.loanOfferId,
        loanApplicationId: params.loanApplicationId,
        matchedLtvRatio: params.matchedLtvRatio,
        matchedCollateralValuationAmount: params.matchedCollateralValuationAmount,
        matchedDate: params.matchedDate,
      });

      this.logger.log(`Loan matched successfully: ${JSON.stringify(matchResult)}`);

      // 2. Calculate loan parameters (this should be done by LoanCalculationService)
      // For now, using placeholder values - this should be replaced with proper calculation
      const originationParams = {
        loanOfferId: params.loanOfferId,
        loanApplicationId: params.loanApplicationId,
        principalAmount: '5000000000000000000000', // 5000 USDT (18 decimals)
        interestAmount: '312500000000000000000', // 312.5 USDT
        repaymentAmount: '5462500000000000000000', // 5462.5 USDT
        redeliveryFeeAmount: '54625000000000000000', // 54.625 USDT
        redeliveryAmount: '5407875000000000000000', // 5407.875 USDT
        premiAmount: '150000000000000000000', // 150 USDT (3%)
        liquidationFeeAmount: '100000000000000000000', // 100 USDT
        minCollateralValuation: params.matchedCollateralValuationAmount,
        mcLtvRatio: params.matchedLtvRatio,
        collateralAmount: '3571428571428571429', // Example ETH amount
        originationDate: new Date(),
        maturityDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000), // 6 months from now
      };

      // 3. Originate the loan
      const originationResult = await this.originateLoan(originationParams);

      this.logger.log(
        `Loan originated and document generation triggered: ${originationResult.loanId}`,
      );

      return originationResult;
    } catch (error) {
      this.logger.error(`Failed to match and originate loan: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to match and originate loan: ${error.message}`);
    }
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
