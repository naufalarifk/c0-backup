import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import {
  CurrencyDto,
  InvoiceDto,
  LiquidationMode,
  LoanApplicationStatus,
  PaginationMetaDto,
} from '../dto/common.dto';
import {
  CreateLoanApplicationDto,
  LoanApplicationListResponseDto,
  LoanApplicationResponseDto,
  LoanCalculationRequestDto,
  LoanCalculationResponseDto,
  UpdateLoanApplicationDto,
} from '../dto/loan-applications.dto';

@Injectable()
export class LoanApplicationsService {
  private readonly logger = new Logger(LoanApplicationsService.name);

  constructor(private readonly cryptogadaiRepository: CryptogadaiRepository) {}

  async calculateLoanRequirements(
    calculationRequest: LoanCalculationRequestDto,
  ): Promise<LoanCalculationResponseDto> {
    this.logger.log('Calculating loan requirements for request');

    try {
      const result = await this.cryptogadaiRepository.borrowerCalculatesLoanRequirements({
        collateralBlockchainKey: calculationRequest.collateralBlockchainKey,
        collateralTokenId: calculationRequest.collateralTokenId,
        principalBlockchainKey: calculationRequest.principalBlockchainKey,
        principalTokenId: calculationRequest.principalTokenId,
        principalAmount: calculationRequest.principalAmount,
        termInMonths: calculationRequest.termInMonths || 6,
        calculationDate: new Date(),
      });

      return {
        success: result.success,
        data: {
          requiredCollateralAmount: result.data.requiredCollateralAmount,
          exchangeRate: result.data.exchangeRate.rate,
          collateralCurrency: {
            blockchainKey: result.data.collateralCurrency.blockchainKey,
            tokenId: result.data.collateralCurrency.tokenId,
            symbol: result.data.collateralCurrency.symbol,
            name: result.data.collateralCurrency.name,
            decimals: result.data.collateralCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${result.data.collateralCurrency.symbol.toLowerCase()}.png`,
          },
          principalCurrency: {
            blockchainKey: result.data.principalCurrency.blockchainKey,
            tokenId: result.data.principalCurrency.tokenId,
            symbol: result.data.principalCurrency.symbol,
            name: result.data.principalCurrency.name,
            decimals: result.data.principalCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${result.data.principalCurrency.symbol.toLowerCase()}.png`,
          },
          maxLtvRatio: result.data.maxLtvRatio,
          safetyBuffer: 10, // Static value for now
          calculationDetails: {
            baseLoanAmount: result.data.principalAmount,
            baseCollateralValue: result.data.requiredCollateralAmount,
            withSafetyBuffer: result.data.requiredCollateralAmount,
            currentExchangeRate: result.data.exchangeRate.rate,
            rateSource: 'platform',
            rateTimestamp: result.data.exchangeRate.timestamp.toISOString(),
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to calculate loan requirements', error);
      throw new BadRequestException('Failed to calculate loan requirements');
    }
  }

  async createLoanApplication(
    borrowerId: string,
    createLoanApplicationDto: CreateLoanApplicationDto,
  ): Promise<LoanApplicationResponseDto> {
    this.logger.log(`Creating loan application for borrower: ${borrowerId}`);

    try {
      const result = await this.cryptogadaiRepository.borrowerCreatesLoanApplication({
        borrowerUserId: borrowerId,
        collateralBlockchainKey: createLoanApplicationDto.collateralBlockchainKey,
        collateralTokenId: createLoanApplicationDto.collateralTokenId,
        principalBlockchainKey: createLoanApplicationDto.principalBlockchainKey,
        principalTokenId: createLoanApplicationDto.principalTokenId,
        principalAmount: createLoanApplicationDto.principalAmount,
        maxInterestRate: createLoanApplicationDto.maxInterestRate,
        termInMonths: createLoanApplicationDto.termMonths,
        liquidationMode: createLoanApplicationDto.liquidationMode,
        appliedDate: new Date(),
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      });

      // Map the result to our response DTO
      // Convert repository status to DTO status
      let dtoStatus: LoanApplicationStatus;
      switch (result.status) {
        case 'PendingCollateral':
          dtoStatus = LoanApplicationStatus.DRAFT;
          break;
        case 'Published':
          dtoStatus = LoanApplicationStatus.PUBLISHED;
          break;
        case 'Matched':
          dtoStatus = LoanApplicationStatus.MATCHED;
          break;
        case 'Closed':
          dtoStatus = LoanApplicationStatus.CLOSED;
          break;
        case 'Expired':
          dtoStatus = LoanApplicationStatus.EXPIRED;
          break;
        default:
          dtoStatus = LoanApplicationStatus.DRAFT;
      }

      return {
        id: result.id,
        borrowerId: result.borrowerUserId,
        collateralCurrency: result.collateralCurrency.symbol,
        principalAmount: result.principalAmount,
        status: dtoStatus,
        createdDate: result.appliedDate.toISOString(),
        publishedDate: undefined, // Applications start in draft status
        expiryDate: result.expirationDate.toISOString(),
        collateralInvoice: {
          id: result.collateralDepositInvoice.id,
          amount: result.collateralDepositAmount,
          currency: {
            blockchainKey: result.collateralCurrency.blockchainKey,
            tokenId: result.collateralCurrency.tokenId,
            symbol: result.collateralCurrency.symbol,
            name: result.collateralCurrency.name,
            decimals: result.collateralCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${result.collateralCurrency.symbol.toLowerCase()}.png`,
          },
          walletAddress: '0x742d35Cc6634C0532925a3b8D...', // TODO: Get from blockchain service
          expiryDate: result.collateralDepositInvoice.expiryDate.toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to create loan application: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMyLoanApplications(
    borrowerId: string,
    pagination: { page: number; limit: number },
  ): Promise<LoanApplicationListResponseDto> {
    this.logger.log(`Getting loan applications for borrower: ${borrowerId}`);

    try {
      const result = await this.cryptogadaiRepository.borrowerViewsMyLoanApplications({
        borrowerUserId: borrowerId,
        page: pagination.page,
        limit: pagination.limit,
      });

      // Map repository applications to DTO format
      const applications: LoanApplicationResponseDto[] = result.loanApplications.map(app => {
        // Convert repository status to DTO status
        let dtoStatus: LoanApplicationStatus;
        switch (app.status) {
          case 'PendingCollateral':
            dtoStatus = LoanApplicationStatus.DRAFT;
            break;
          case 'Published':
            dtoStatus = LoanApplicationStatus.PUBLISHED;
            break;
          case 'Matched':
            dtoStatus = LoanApplicationStatus.MATCHED;
            break;
          case 'Closed':
            dtoStatus = LoanApplicationStatus.CLOSED;
            break;
          case 'Expired':
            dtoStatus = LoanApplicationStatus.EXPIRED;
            break;
          default:
            dtoStatus = LoanApplicationStatus.DRAFT;
        }

        return {
          id: app.id,
          borrowerId,
          collateralCurrency: app.collateralCurrency.symbol,
          principalAmount: app.principalAmount,
          status: dtoStatus,
          createdDate: app.appliedDate.toISOString(),
          publishedDate: app.publishedDate?.toISOString(),
          expiryDate: app.expirationDate.toISOString(),
          collateralInvoice: {
            id: `inv_${app.id}`, // Generated invoice ID from application ID
            amount: app.collateralDepositAmount,
            currency: {
              blockchainKey: app.collateralCurrency.blockchainKey,
              tokenId: app.collateralCurrency.tokenId,
              symbol: app.collateralCurrency.symbol,
              name: app.collateralCurrency.name,
              decimals: app.collateralCurrency.decimals,
              logoUrl: `https://assets.cryptogadai.com/currencies/${app.collateralCurrency.symbol.toLowerCase()}.png`,
            },
            walletAddress: '0x742d35Cc6634C0532925a3b8D...', // TODO: Get from blockchain service
            expiryDate: app.expirationDate.toISOString(),
          },
        };
      });

      const paginationMeta: PaginationMetaDto = {
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
          applications,
          pagination: paginationMeta,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get loan applications: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateLoanApplication(
    borrowerId: string,
    applicationId: string,
    updateLoanApplicationDto: UpdateLoanApplicationDto,
  ): Promise<LoanApplicationResponseDto> {
    this.logger.log(`Updating loan application ${applicationId} for borrower: ${borrowerId}`);

    try {
      let action: 'cancel' | 'modify';
      let closureReason: string | undefined;

      // Map DTO action to repository action
      if (updateLoanApplicationDto.action === 'Cancel') {
        action = 'cancel';
        closureReason = 'Cancelled by borrower';
      } else {
        action = 'modify';
      }

      const result = await this.cryptogadaiRepository.borrowerUpdatesLoanApplication({
        loanApplicationId: applicationId,
        borrowerUserId: borrowerId,
        action,
        updateDate: new Date(),
        closureReason,
      });

      // Convert repository status to DTO status
      let dtoStatus: LoanApplicationStatus;
      switch (result.status) {
        case 'PendingCollateral':
          dtoStatus = LoanApplicationStatus.DRAFT;
          break;
        case 'Published':
          dtoStatus = LoanApplicationStatus.PUBLISHED;
          break;
        case 'Matched':
          dtoStatus = LoanApplicationStatus.MATCHED;
          break;
        case 'Closed':
          dtoStatus = LoanApplicationStatus.CLOSED;
          break;
        case 'Expired':
          dtoStatus = LoanApplicationStatus.EXPIRED;
          break;
        default:
          dtoStatus = LoanApplicationStatus.DRAFT;
      }

      // For updates/cancellations, we return minimal response since repository only returns updated fields
      return {
        id: result.id,
        borrowerId,
        collateralCurrency: 'Unknown', // Not available in update response
        principalAmount: '0.000000000000000000', // Not available in update response
        status: dtoStatus,
        createdDate: result.updatedDate.toISOString(),
        publishedDate: undefined,
        expiryDate: result.expirationDate?.toISOString() || new Date().toISOString(),
        collateralInvoice: {
          id: `inv_${result.id}`,
          amount: '0.000000000000000000',
          currency: {
            blockchainKey: 'unknown',
            tokenId: 'unknown',
            symbol: 'Unknown',
            name: 'Unknown',
            decimals: 18,
            logoUrl: '',
          },
          walletAddress: '0x742d35Cc6634C0532925a3b8D...',
          expiryDate: result.expirationDate?.toISOString() || new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update loan application: ${error.message}`, error.stack);
      throw error;
    }
  }
}
