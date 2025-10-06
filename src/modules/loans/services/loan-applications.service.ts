import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { InvoiceService } from '../../../shared/invoice/invoice.service';
import { InvoiceError } from '../../../shared/invoice/invoice.types';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { IndexerEventService } from '../../indexer/indexer-event.service';
import { LiquidationMode, LoanApplicationStatus, PaginationMetaDto } from '../dto/common.dto';
import {
  CreateLoanApplicationDto,
  LoanApplicationListResponseDto,
  LoanApplicationResponseDto,
  LoanCalculationRequestDto,
  LoanCalculationResponseDto,
  UpdateLoanApplicationDto,
} from '../dto/loan-applications.dto';
import {
  AmountOutOfBoundsException,
  CurrencyNotSupportedException,
  InterestRateInvalidException,
} from '../exceptions/loan-exceptions';
import { LoanCalculationService } from './loan-calculation.service';

@Injectable()
export class LoanApplicationsService {
  private readonly logger = new Logger(LoanApplicationsService.name);

  constructor(
    private readonly cryptogadaiRepository: CryptogadaiRepository,
    private readonly indexerEventService: IndexerEventService,
    private readonly invoiceService: InvoiceService,
    private readonly loanCalculationService: LoanCalculationService,
  ) {}

  async calculateLoanRequirements(
    calculationRequest: LoanCalculationRequestDto,
  ): Promise<LoanCalculationResponseDto> {
    this.logger.log('Calculating loan requirements for request');

    try {
      // Validate principal amount is positive
      const principalAmount = parseFloat(calculationRequest.principalAmount);
      if (principalAmount <= 0) {
        throw new BadRequestException('Principal amount must be greater than zero');
      }

      // Validate loan amount limits per SRS BR-005
      if (principalAmount < 50) {
        throw new AmountOutOfBoundsException(principalAmount.toString(), '50', '20000');
      }
      if (principalAmount > 20000) {
        throw new AmountOutOfBoundsException(principalAmount.toString(), '50', '20000');
      }

      // Validate term in months (support both field names)
      const termInMonths = calculationRequest.termInMonths || calculationRequest.loanTerm || 6;
      if (termInMonths < 1 || termInMonths > 60) {
        throw new BadRequestException('Term in months must be between 1 and 60');
      }

      const calculationDate = new Date();

      // Get data from repository (no calculations)
      // Default to USDC on BSC for principal currency in production
      // Use mock:usd on cg:testnet for development/test environments
      const isTestEnv = process.env.NODE_ENV !== 'production';
      const DEFAULT_PRINCIPAL_BLOCKCHAIN_KEY = isTestEnv ? 'cg:testnet' : 'eip155:56';
      const DEFAULT_PRINCIPAL_TOKEN_ID = isTestEnv
        ? 'mock:usd'
        : 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';

      const currencies = await this.cryptogadaiRepository.borrowerGetsCurrencyPair({
        collateralBlockchainKey: calculationRequest.collateralBlockchainKey,
        collateralTokenId: calculationRequest.collateralTokenId,
        principalBlockchainKey: DEFAULT_PRINCIPAL_BLOCKCHAIN_KEY,
        principalTokenId: DEFAULT_PRINCIPAL_TOKEN_ID,
      });

      const platformConfig = await this.cryptogadaiRepository.borrowerGetsPlatformConfig({
        effectiveDate: calculationDate,
      });

      let exchangeRate;
      try {
        exchangeRate = await this.cryptogadaiRepository.borrowerGetsExchangeRate({
          collateralBlockchainKey: calculationRequest.collateralBlockchainKey,
          collateralTokenId: calculationRequest.collateralTokenId,
        });
      } catch (error) {
        if (error.message?.includes('Exchange rate not found')) {
          throw new BadRequestException(
            `Exchange rate not available for ${currencies.collateralCurrency.symbol}. Please try again later.`,
          );
        } else {
          throw error;
        }
      }

      // Convert principal amount to smallest units for calculation service
      const principalAmountInSmallestUnits = this.loanCalculationService.toSmallestUnit(
        calculationRequest.principalAmount,
        currencies.principalCurrency.decimals,
      );

      // Perform calculations using the calculation service
      const calculationResult = this.loanCalculationService.calculateLoanRequirements({
        principalAmount: principalAmountInSmallestUnits,
        principalCurrency: currencies.principalCurrency,
        collateralCurrency: currencies.collateralCurrency,
        platformConfig: {
          loanProvisionRate: platformConfig.loanProvisionRate,
          loanMinLtvRatio: platformConfig.loanMinLtvRatio,
          loanMaxLtvRatio: platformConfig.loanMaxLtvRatio,
        },
        exchangeRate: {
          id: exchangeRate.id,
          bidPrice: exchangeRate.bidPrice,
          askPrice: exchangeRate.askPrice,
          sourceDate: exchangeRate.sourceDate,
        },
        termInMonths,
        calculationDate,
      });

      return {
        success: true,
        data: {
          requiredCollateralAmount: this.loanCalculationService.fromSmallestUnit(
            calculationResult.requiredCollateralAmount,
            calculationResult.collateralCurrency.decimals,
          ),
          exchangeRate: calculationResult.exchangeRate.rate,
          collateralCurrency: {
            blockchainKey: calculationResult.collateralCurrency.blockchainKey,
            tokenId: calculationResult.collateralCurrency.tokenId,
            symbol: calculationResult.collateralCurrency.symbol,
            name: calculationResult.collateralCurrency.name,
            decimals: calculationResult.collateralCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${calculationResult.collateralCurrency.symbol.toLowerCase()}.png`,
          },
          principalCurrency: {
            blockchainKey: calculationResult.principalCurrency.blockchainKey,
            tokenId: calculationResult.principalCurrency.tokenId,
            symbol: calculationResult.principalCurrency.symbol,
            name: calculationResult.principalCurrency.name,
            decimals: calculationResult.principalCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${calculationResult.principalCurrency.symbol.toLowerCase()}.png`,
          },
          maxLtvRatio: calculationResult.maxLtvRatio,
          safetyBuffer: 10, // Static value for now
          calculationDetails: {
            baseLoanAmount: this.loanCalculationService.fromSmallestUnit(
              calculationResult.principalAmount,
              calculationResult.principalCurrency.decimals,
            ),
            baseCollateralValue: this.loanCalculationService.fromSmallestUnit(
              calculationResult.requiredCollateralAmount,
              calculationResult.collateralCurrency.decimals,
            ),
            withSafetyBuffer: this.loanCalculationService.fromSmallestUnit(
              calculationResult.requiredCollateralAmount,
              calculationResult.collateralCurrency.decimals,
            ),
            currentExchangeRate: calculationResult.exchangeRate.rate,
            rateSource: 'platform',
            rateTimestamp: calculationResult.exchangeRate.timestamp.toISOString(),
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to calculate loan requirements', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Handle specific repository errors
      if (error.message?.includes('Exchange rate not found')) {
        throw new BadRequestException(
          'Exchange rate not available for the selected currency pair. Please ensure price feeds are configured.',
        );
      }
      if (
        error.message?.includes('Currency not found') ||
        error.message?.includes('not supported') ||
        error.message?.includes('does not exist')
      ) {
        throw new CurrencyNotSupportedException(
          calculationRequest.collateralBlockchainKey,
          calculationRequest.collateralTokenId,
        );
      }
      throw new BadRequestException(
        'Failed to calculate loan requirements. Please check your input parameters.',
      );
    }
  }

  async createLoanApplication(
    borrowerId: string,
    createLoanApplicationDto: CreateLoanApplicationDto,
  ): Promise<LoanApplicationResponseDto> {
    this.logger.log(`Creating loan application for borrower: ${borrowerId}`);

    try {
      // Validate principal amount is positive and within limits per SRS BR-005
      const principalAmount = parseFloat(createLoanApplicationDto.principalAmount);
      if (principalAmount <= 0) {
        throw new BadRequestException('Principal amount must be greater than zero');
      }
      if (principalAmount < 50) {
        throw new AmountOutOfBoundsException(principalAmount.toString(), '50', '20000');
      }
      if (principalAmount > 20000) {
        throw new AmountOutOfBoundsException(principalAmount.toString(), '50', '20000');
      }

      // Validate LTV ratio bounds per SRS CONF-002 (Fixed max LTV of 70%)
      if (createLoanApplicationDto.minLtvRatio !== undefined) {
        if (
          createLoanApplicationDto.minLtvRatio < 0 ||
          createLoanApplicationDto.minLtvRatio > 0.7
        ) {
          throw new UnprocessableEntityException('LTV ratio must be between 0 and 0.7 (70%)');
        }
      }

      // Validate interest rate bounds per SRS CONF-001
      if (
        createLoanApplicationDto.maxInterestRate < 0.1 ||
        createLoanApplicationDto.maxInterestRate > 50
      ) {
        throw new InterestRateInvalidException(createLoanApplicationDto.maxInterestRate);
      }

      const appliedDate = new Date();
      const expirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      // Get data from repository (no calculations)
      // Default to USDC on BSC for principal currency in production
      // Use mock:usd on cg:testnet for development/test environments
      const isTestEnv = process.env.NODE_ENV !== 'production';
      const DEFAULT_PRINCIPAL_BLOCKCHAIN_KEY = isTestEnv ? 'cg:testnet' : 'eip155:56';
      const DEFAULT_PRINCIPAL_TOKEN_ID = isTestEnv
        ? 'mock:usd'
        : 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';

      const currencies = await this.cryptogadaiRepository.borrowerGetsCurrencyPair({
        collateralBlockchainKey: createLoanApplicationDto.collateralBlockchainKey,
        collateralTokenId: createLoanApplicationDto.collateralTokenId,
        principalBlockchainKey: DEFAULT_PRINCIPAL_BLOCKCHAIN_KEY,
        principalTokenId: DEFAULT_PRINCIPAL_TOKEN_ID,
      });

      const platformConfig = await this.cryptogadaiRepository.borrowerGetsPlatformConfig({
        effectiveDate: appliedDate,
      });

      let exchangeRate;
      try {
        exchangeRate = await this.cryptogadaiRepository.borrowerGetsExchangeRate({
          collateralBlockchainKey: createLoanApplicationDto.collateralBlockchainKey,
          collateralTokenId: createLoanApplicationDto.collateralTokenId,
        });
      } catch (error) {
        if (error.message?.includes('Exchange rate not found')) {
          throw new BadRequestException(
            `Exchange rate not available for ${currencies.collateralCurrency.symbol}. Please try again later.`,
          );
        } else {
          throw error;
        }
      }

      // Convert principal amount to smallest units for calculation service
      const principalAmountInSmallestUnits = this.loanCalculationService.toSmallestUnit(
        createLoanApplicationDto.principalAmount,
        currencies.principalCurrency.decimals,
      );

      // Perform calculations using the calculation service
      const calculationResult = this.loanCalculationService.calculateLoanApplicationParams({
        principalAmount: principalAmountInSmallestUnits,
        principalCurrency: currencies.principalCurrency,
        collateralCurrency: currencies.collateralCurrency,
        platformConfig: {
          loanProvisionRate: platformConfig.loanProvisionRate,
          loanMinLtvRatio: platformConfig.loanMinLtvRatio,
          loanMaxLtvRatio: platformConfig.loanMaxLtvRatio,
        },
        exchangeRate: {
          id: exchangeRate.id,
          bidPrice: exchangeRate.bidPrice,
          askPrice: exchangeRate.askPrice,
          sourceDate: exchangeRate.sourceDate,
        },
        appliedDate,
      });

      let invoiceDraft;
      try {
        invoiceDraft = await this.invoiceService.prepareInvoice({
          userId: borrowerId,
          currencyBlockchainKey: createLoanApplicationDto.collateralBlockchainKey,
          currencyTokenId: createLoanApplicationDto.collateralTokenId,
          accountBlockchainKey: createLoanApplicationDto.collateralBlockchainKey,
          accountTokenId: createLoanApplicationDto.collateralTokenId,
          invoiceType: 'LoanCollateral',
          invoicedAmount: calculationResult.collateralDepositAmount,
          prepaidAmount: '0',
          invoiceDate: appliedDate,
          dueDate: expirationDate,
          expiredDate: expirationDate,
        });
      } catch (error) {
        if (error instanceof InvoiceError) {
          throw new BadRequestException(error.message);
        }
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes('Wallet service not found') ||
          message.includes('Unsupported blockchain key')
        ) {
          throw new CurrencyNotSupportedException(
            createLoanApplicationDto.collateralBlockchainKey,
            createLoanApplicationDto.collateralTokenId,
          );
        }
        throw error;
      }

      const walletAddress = invoiceDraft.walletAddress;
      if (!walletAddress) {
        throw new BadRequestException('Failed to generate wallet address for collateral deposit');
      }

      // Create loan application with calculated values using the data-only method
      const result = await this.cryptogadaiRepository.borrowerCreatesLoanApplication({
        borrowerUserId: borrowerId,
        collateralBlockchainKey: createLoanApplicationDto.collateralBlockchainKey,
        collateralTokenId: createLoanApplicationDto.collateralTokenId,
        principalBlockchainKey: DEFAULT_PRINCIPAL_BLOCKCHAIN_KEY,
        principalTokenId: DEFAULT_PRINCIPAL_TOKEN_ID,
        principalAmount: principalAmountInSmallestUnits,
        provisionAmount: calculationResult.provisionAmount,
        maxInterestRate: createLoanApplicationDto.maxInterestRate,
        minLtvRatio: calculationResult.minLtvRatio,
        maxLtvRatio: calculationResult.maxLtvRatio,
        termInMonths: createLoanApplicationDto.termMonths,
        liquidationMode: createLoanApplicationDto.liquidationMode,
        collateralDepositAmount: calculationResult.collateralDepositAmount,
        collateralDepositExchangeRateId: exchangeRate.id,
        appliedDate,
        expirationDate,
        collateralInvoiceId: invoiceDraft.invoiceId,
        collateralInvoicePrepaidAmount: invoiceDraft.prepaidAmount,
        collateralAccountBlockchainKey: invoiceDraft.accountBlockchainKey,
        collateralAccountTokenId: invoiceDraft.accountTokenId,
        collateralInvoiceDate: invoiceDraft.invoiceDate,
        collateralInvoiceDueDate: invoiceDraft.dueDate ?? expirationDate,
        collateralInvoiceExpiredDate: invoiceDraft.expiredDate ?? expirationDate,
        collateralWalletDerivationPath: invoiceDraft.walletDerivationPath,
        collateralWalletAddress: walletAddress,
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
        case 'Cancelled':
          dtoStatus = LoanApplicationStatus.CANCELLED;
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

      this.indexerEventService.addWallet(
        createLoanApplicationDto.collateralBlockchainKey,
        createLoanApplicationDto.collateralTokenId,
        walletAddress,
        invoiceDraft.walletDerivationPath,
      );

      return {
        id: result.id,
        borrowerId: result.borrowerUserId,
        collateralCurrency: {
          blockchainKey: result.collateralCurrency.blockchainKey,
          tokenId: result.collateralCurrency.tokenId,
          symbol: result.collateralCurrency.symbol,
          name: result.collateralCurrency.name,
          decimals: result.collateralCurrency.decimals,
          logoUrl: `https://assets.cryptogadai.com/currencies/${result.collateralCurrency.symbol.toLowerCase()}.png`,
        },
        principalAmount: this.loanCalculationService.fromSmallestUnit(
          result.principalAmount,
          result.principalCurrency.decimals,
        ),
        minLtvRatio: result.minLtvRatio !== undefined ? Number(result.minLtvRatio) : undefined,
        status: dtoStatus,
        createdDate: result.appliedDate.toISOString(),
        publishedDate: undefined, // Applications start in draft status
        expiryDate: result.expirationDate.toISOString(),
        collateralInvoice: {
          id: result.collateralDepositInvoice.id,
          amount: this.loanCalculationService.fromSmallestUnit(
            result.collateralDepositAmount,
            result.collateralCurrency.decimals,
          ),
          currency: {
            blockchainKey: result.collateralCurrency.blockchainKey,
            tokenId: result.collateralCurrency.tokenId,
            symbol: result.collateralCurrency.symbol,
            name: result.collateralCurrency.name,
            decimals: result.collateralCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${result.collateralCurrency.symbol.toLowerCase()}.png`,
          },
          walletAddress: walletAddress,
          expiryDate: result.collateralDepositInvoice.expiryDate.toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to create loan application: ${error.message}`, error.stack);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      // Handle specific repository/wallet errors
      if (
        error.message?.includes('WalletService not supported') ||
        error.message?.includes('Wallet service not found')
      ) {
        throw new CurrencyNotSupportedException(
          createLoanApplicationDto.collateralBlockchainKey,
          createLoanApplicationDto.collateralTokenId,
        );
      }
      if (error.message?.includes('Exchange rate not found')) {
        throw new BadRequestException(
          'Exchange rate not available for the selected currency pair. Please ensure price feeds are configured.',
        );
      }
      if (
        error.message?.includes('Currency not found') ||
        error.message?.includes('does not exist')
      ) {
        throw new CurrencyNotSupportedException(
          createLoanApplicationDto.collateralBlockchainKey,
          createLoanApplicationDto.collateralTokenId,
        );
      }
      if (error.message?.includes('Insufficient balance') || error.message?.includes('balance')) {
        throw new BadRequestException('Insufficient balance to create loan application');
      }
      throw new BadRequestException('Failed to create loan application. Please try again.');
    }
  }

  async listLoanApplications(params: {
    page: number;
    limit: number;
    collateralBlockchainKey?: string;
    collateralTokenId?: string;
    principalBlockchainKey?: string;
    principalTokenId?: string;
    minPrincipalAmount?: number;
    maxPrincipalAmount?: number;
    liquidationMode?: string;
  }): Promise<LoanApplicationListResponseDto> {
    this.logger.log('Listing available loan applications');

    try {
      // Validate pagination parameters
      if (params.page < 1) {
        throw new BadRequestException('Page number must be greater than 0');
      }
      if (params.limit < 1 || params.limit > 100) {
        throw new BadRequestException('Limit must be between 1 and 100');
      }

      const result = await this.cryptogadaiRepository.platformListsAvailableLoanApplications({
        collateralBlockchainKey: params.collateralBlockchainKey,
        collateralTokenId: params.collateralTokenId,
        principalBlockchainKey: params.principalBlockchainKey,
        principalTokenId: params.principalTokenId,
        minPrincipalAmount: params.minPrincipalAmount,
        maxPrincipalAmount: params.maxPrincipalAmount,
        liquidationMode: params.liquidationMode,
        page: params.page,
        limit: params.limit,
      });

      // Map repository applications to DTO format
      const applications: LoanApplicationResponseDto[] = result.loanApplications.map(app => {
        return {
          id: app.id,
          borrowerId: app.borrowerUserId,
          borrower: {
            id: app.borrower.id,
            type: app.borrower.type,
            name: app.borrower.name,
            verified: true,
          },
          collateralCurrency: {
            blockchainKey: app.collateralCurrency.blockchainKey,
            tokenId: app.collateralCurrency.tokenId,
            symbol: app.collateralCurrency.symbol,
            name: app.collateralCurrency.name,
            decimals: app.collateralCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${app.collateralCurrency.symbol.toLowerCase()}.png`,
          },
          principalCurrency: {
            blockchainKey: app.principalCurrency.blockchainKey,
            tokenId: app.principalCurrency.tokenId,
            symbol: app.principalCurrency.symbol,
            name: app.principalCurrency.name,
            decimals: app.principalCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${app.principalCurrency.symbol.toLowerCase()}.png`,
          },
          principalAmount: this.loanCalculationService.fromSmallestUnit(
            app.principalAmount,
            app.principalCurrency.decimals,
          ),
          maxInterestRate: app.maxInterestRate,
          termMonths: app.termInMonths,
          liquidationMode:
            app.liquidationMode === 'Partial' ? LiquidationMode.PARTIAL : LiquidationMode.FULL,
          status: LoanApplicationStatus.PUBLISHED, // Only published apps are listed by platform
          createdDate: app.appliedDate.toISOString(),
          publishedDate: app.publishedDate?.toISOString(),
          expiryDate: app.expirationDate.toISOString(),
          collateralInvoice: {
            id: `inv_${app.id}`,
            amount: '0.000000000000000000', // Not available in list view
            currency: {
              blockchainKey: app.collateralCurrency.blockchainKey,
              tokenId: app.collateralCurrency.tokenId,
              symbol: app.collateralCurrency.symbol,
              name: app.collateralCurrency.name,
              decimals: app.collateralCurrency.decimals,
              logoUrl: `https://assets.cryptogadai.com/currencies/${app.collateralCurrency.symbol.toLowerCase()}.png`,
            },
            walletAddress: 'Available via application details',
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
      this.logger.error(`Failed to list loan applications: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve loan applications. Please try again.');
    }
  }

  async getMyLoanApplications(
    borrowerId: string,
    pagination: { page: number; limit: number },
  ): Promise<LoanApplicationListResponseDto> {
    this.logger.log(`Getting loan applications for borrower: ${borrowerId}`);

    try {
      // Validate pagination parameters
      if (pagination.page < 1) {
        throw new BadRequestException('Page number must be greater than 0');
      }
      if (pagination.limit < 1 || pagination.limit > 100) {
        throw new BadRequestException('Limit must be between 1 and 100');
      }

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
          collateralCurrency: {
            blockchainKey: app.collateralCurrency.blockchainKey,
            tokenId: app.collateralCurrency.tokenId,
            symbol: app.collateralCurrency.symbol,
            name: app.collateralCurrency.name,
            decimals: app.collateralCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${app.collateralCurrency.symbol.toLowerCase()}.png`,
          },
          principalAmount: this.loanCalculationService.fromSmallestUnit(
            app.principalAmount,
            app.principalCurrency.decimals,
          ),
          status: dtoStatus,
          createdDate: app.appliedDate.toISOString(),
          publishedDate: app.publishedDate?.toISOString(),
          expiryDate: app.expirationDate.toISOString(),
          collateralInvoice: {
            id: `inv_${app.id}`, // Generated invoice ID from application ID
            amount: this.loanCalculationService.fromSmallestUnit(
              app.collateralDepositAmount,
              app.collateralCurrency.decimals,
            ),
            currency: {
              blockchainKey: app.collateralCurrency.blockchainKey,
              tokenId: app.collateralCurrency.tokenId,
              symbol: app.collateralCurrency.symbol,
              name: app.collateralCurrency.name,
              decimals: app.collateralCurrency.decimals,
              logoUrl: `https://assets.cryptogadai.com/currencies/${app.collateralCurrency.symbol.toLowerCase()}.png`,
            },
            walletAddress: 'Wallet address available via invoice details', // List view doesn't include wallet address
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
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      // Handle repository errors
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        throw new NotFoundException('User not found or no loan applications available');
      }
      throw new BadRequestException('Failed to retrieve loan applications. Please try again.');
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

      // Validate action
      if (!updateLoanApplicationDto.action) {
        throw new BadRequestException('Action is required');
      }

      // Map DTO action to repository action
      if (updateLoanApplicationDto.action === 'Cancel') {
        action = 'cancel';
        closureReason = 'Cancelled by borrower';
      } else {
        throw new BadRequestException(`Unsupported action: ${updateLoanApplicationDto.action}`);
      }

      // Perform the update
      await this.cryptogadaiRepository.borrowerUpdatesLoanApplication({
        loanApplicationId: applicationId,
        borrowerUserId: borrowerId,
        action,
        updateDate: new Date(),
        closureReason,
      });

      // Fetch the updated loan application details
      const applicationsResult = await this.cryptogadaiRepository.borrowerViewsMyLoanApplications({
        borrowerUserId: borrowerId,
        page: 1,
        limit: 100, // Use a large limit to ensure we find the application
      });

      // Find the specific application that was updated
      const updatedApplication = applicationsResult.loanApplications.find(
        app => app.id === applicationId,
      );

      if (!updatedApplication) {
        throw new NotFoundException(`Loan application ${applicationId} not found after update`);
      }

      // Convert repository status to DTO status
      let dtoStatus: LoanApplicationStatus;
      switch (updatedApplication.status) {
        case 'PendingCollateral':
          dtoStatus = LoanApplicationStatus.DRAFT;
          break;
        case 'Published':
          dtoStatus = LoanApplicationStatus.PUBLISHED;
          break;
        case 'Matched':
          dtoStatus = LoanApplicationStatus.MATCHED;
          break;
        case 'Cancelled':
          dtoStatus = LoanApplicationStatus.CANCELLED;
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

      // Return the full updated loan application details
      return {
        id: updatedApplication.id,
        borrowerId,
        collateralCurrency: {
          blockchainKey: updatedApplication.collateralCurrency.blockchainKey,
          tokenId: updatedApplication.collateralCurrency.tokenId,
          symbol: updatedApplication.collateralCurrency.symbol,
          name: updatedApplication.collateralCurrency.name,
          decimals: updatedApplication.collateralCurrency.decimals,
          logoUrl: `https://assets.cryptogadai.com/currencies/${updatedApplication.collateralCurrency.symbol.toLowerCase()}.png`,
        },
        principalAmount: this.loanCalculationService.fromSmallestUnit(
          updatedApplication.principalAmount,
          updatedApplication.principalCurrency.decimals,
        ),
        status: dtoStatus,
        createdDate: updatedApplication.appliedDate.toISOString(),
        publishedDate: updatedApplication.publishedDate?.toISOString(),
        expiryDate: updatedApplication.expirationDate.toISOString(),
        collateralInvoice: {
          id: `inv_${updatedApplication.id}`, // Generated invoice ID from application ID for list view
          amount: this.loanCalculationService.fromSmallestUnit(
            updatedApplication.collateralDepositAmount,
            updatedApplication.collateralCurrency.decimals,
          ),
          currency: {
            blockchainKey: updatedApplication.collateralCurrency.blockchainKey,
            tokenId: updatedApplication.collateralCurrency.tokenId,
            symbol: updatedApplication.collateralCurrency.symbol,
            name: updatedApplication.collateralCurrency.name,
            decimals: updatedApplication.collateralCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${updatedApplication.collateralCurrency.symbol.toLowerCase()}.png`,
          },
          walletAddress: 'Wallet address available via invoice details', // List view doesn't include wallet address
          expiryDate: updatedApplication.expirationDate.toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update loan application: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      // Handle specific repository errors
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        throw new NotFoundException(`Loan application ${applicationId} not found`);
      }
      if (
        error.message?.includes('not authorized') ||
        error.message?.includes('permission denied')
      ) {
        throw new NotFoundException(`Loan application ${applicationId} not found`); // Don't expose authorization details
      }
      if (
        error.message?.includes('cannot be modified') ||
        error.message?.includes('invalid status')
      ) {
        throw new BadRequestException('Loan application cannot be modified in its current status');
      }
      throw new BadRequestException('Failed to update loan application. Please try again.');
    }
  }

  async getLoanApplicationById(applicationId: string): Promise<LoanApplicationResponseDto> {
    try {
      const result = await this.cryptogadaiRepository.borrowerGetsLoanApplicationById({
        loanApplicationId: applicationId,
      });

      const r = result;

      const collateralInvoiceDto = r.collateralInvoice
        ? {
            id: r.collateralInvoice.id,
            amount: this.loanCalculationService.fromSmallestUnit(
              r.collateralInvoice.amount,
              r.collateralCurrency.decimals,
            ),
            currency: {
              blockchainKey: r.collateralInvoice.currency.blockchainKey,
              tokenId: r.collateralInvoice.currency.tokenId,
              name: r.collateralInvoice.currency.name,
              symbol: r.collateralInvoice.currency.symbol,
              decimals: r.collateralInvoice.currency.decimals,
              logoUrl: `https://assets.cryptogadai.com/currencies/${r.collateralInvoice.currency.symbol.toLowerCase()}.png`,
            },
            walletAddress: r.collateralInvoice.walletAddress || '',
            expiryDate: r.collateralInvoice.expiryDate
              ? String(r.collateralInvoice.expiryDate)
              : r.expirationDate
                ? r.expirationDate.toISOString
                  ? r.expirationDate.toISOString()
                  : String(r.expirationDate)
                : '',
            paidDate: r.collateralInvoice.paidDate
              ? String(r.collateralInvoice.paidDate)
              : undefined,
            expiredDate: r.collateralInvoice.expiredDate
              ? String(r.collateralInvoice.expiredDate)
              : undefined,
          }
        : undefined;

      // Map repository status to DTO status
      let dtoStatus: LoanApplicationStatus;
      switch (r.status) {
        case 'PendingCollateral':
          dtoStatus = LoanApplicationStatus.DRAFT;
          break;
        case 'Published':
          dtoStatus = LoanApplicationStatus.PUBLISHED;
          break;
        case 'Matched':
          dtoStatus = LoanApplicationStatus.MATCHED;
          break;
        case 'Cancelled':
          dtoStatus = LoanApplicationStatus.CANCELLED;
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

      const collateralInvoiceDtoFinal = collateralInvoiceDto
        ? collateralInvoiceDto
        : {
            id: 'unknown',
            amount: this.loanCalculationService.fromSmallestUnit(
              '0',
              r.collateralCurrency?.decimals || 18,
            ),
            currency: r.collateralCurrency
              ? {
                  blockchainKey: r.collateralCurrency.blockchainKey,
                  tokenId: r.collateralCurrency.tokenId,
                  name: r.collateralCurrency.name,
                  symbol: r.collateralCurrency.symbol,
                  decimals: r.collateralCurrency.decimals,
                  logoUrl: `https://assets.cryptogadai.com/currencies/${r.collateralCurrency.symbol.toLowerCase()}.png`,
                }
              : {
                  blockchainKey: 'unknown',
                  tokenId: 'unknown',
                  name: 'Unknown',
                  symbol: 'UNK',
                  decimals: 18,
                  logoUrl: `https://assets.cryptogadai.com/currencies/unk.png`,
                },
            walletAddress: '',
            expiryDate: r.expirationDate
              ? r.expirationDate.toISOString
                ? r.expirationDate.toISOString()
                : String(r.expirationDate)
              : '',
            paidDate: undefined,
            expiredDate: undefined,
          };

      return {
        id: r.id,
        borrowerId: r.borrowerUserId,
        borrower: {
          id: r.borrower.id,
          type: r.borrower.type,
          name: r.borrower.name,
        },
        collateralCurrency: {
          blockchainKey: r.collateralCurrency.blockchainKey,
          tokenId: r.collateralCurrency.tokenId,
          symbol: r.collateralCurrency.symbol,
          name: r.collateralCurrency.name,
          decimals: r.collateralCurrency.decimals,
          logoUrl: `https://assets.cryptogadai.com/currencies/${r.collateralCurrency.symbol.toLowerCase()}.png`,
        },
        principalCurrency: r.principalCurrency
          ? {
              blockchainKey: r.principalCurrency.blockchainKey,
              tokenId: r.principalCurrency.tokenId,
              symbol: r.principalCurrency.symbol,
              name: r.principalCurrency.name,
              decimals: r.principalCurrency.decimals,
              logoUrl: `https://assets.cryptogadai.com/currencies/${r.principalCurrency.symbol.toLowerCase()}.png`,
            }
          : undefined,
        principalAmount: this.loanCalculationService.fromSmallestUnit(
          r.principalAmount,
          r.principalCurrency.decimals,
        ),
        maxInterestRate: r.maxInterestRate,
        termMonths: r.termInMonths,
        liquidationMode:
          r.liquidationMode === 'Partial' ? LiquidationMode.PARTIAL : LiquidationMode.FULL,
        minLtvRatio: r.minLtvRatio !== undefined ? Number(r.minLtvRatio) : undefined,
        status: dtoStatus,
        createdDate: r.appliedDate.toISOString
          ? r.appliedDate.toISOString()
          : String(r.appliedDate),
        publishedDate: r.publishedDate
          ? r.publishedDate.toISOString
            ? r.publishedDate.toISOString()
            : String(r.publishedDate)
          : undefined,
        expiryDate: r.expirationDate.toISOString
          ? r.expirationDate.toISOString()
          : String(r.expirationDate),
        collateralInvoice: collateralInvoiceDtoFinal,
      };
    } catch (error) {
      this.logger.error('Failed to get loan application by id', error);
      throw new NotFoundException('Loan application not found');
    }
  }
}
