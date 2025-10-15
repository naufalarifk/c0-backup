import type {
  Invoice,
  LenderCreatesLoanOfferResult,
} from '../../../shared/repositories/loan.types';

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { assertDefined, assertPropNumber } from 'typeshaper';

import { InvoiceService } from '../../../shared/invoice/invoice.service';
import { InvoiceError } from '../../../shared/invoice/invoice.types';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { IndexerEventService } from '../../indexer/indexer-event.service';
import { LenderType, LoanOfferStatus, PaginationMetaDto } from '../dto/common.dto';
import {
  CreateLoanOfferDto,
  LoanOfferListResponseDto,
  LoanOfferResponseDto,
  UpdateLoanOfferDto,
} from '../dto/loan-offers.dto';
import {
  CurrencyNotSupportedException,
  InterestRateInvalidException,
  ValidationErrorException,
} from '../exceptions/loan-exceptions';
import { LoanCalculationService } from './loan-calculation.service';

interface ListLoanOffersParams {
  page: number;
  limit: number;
  collateralBlockchainKey?: string;
  collateralTokenId?: string;
  principalBlockchainKey?: string;
  principalTokenId?: string;
}

interface PaginationParams {
  page: number;
  limit: number;
}

@Injectable()
export class LoanOffersService {
  private readonly logger = new TelemetryLogger(LoanOffersService.name);

  constructor(
    private readonly indexerEventService: IndexerEventService,
    private readonly invoiceService: InvoiceService,
    private readonly loanCalculationService: LoanCalculationService,
    private readonly repository: CryptogadaiRepository,
  ) {}

  /**
   * Map repository loan offer status to DTO status
   */
  private mapRepositoryStatusToDto(
    repositoryStatus: 'Funding' | 'Published' | 'Closed' | 'Expired',
  ): LoanOfferStatus {
    switch (repositoryStatus) {
      case 'Funding':
        return LoanOfferStatus.DRAFT;
      case 'Published':
        return LoanOfferStatus.PUBLISHED;
      case 'Closed':
        return LoanOfferStatus.CLOSED;
      case 'Expired':
        return LoanOfferStatus.CLOSED; // Map expired to closed
      default:
        return LoanOfferStatus.DRAFT;
    }
  }

  /**
   * Create a new loan offer
   */
  async createLoanOffer(
    lenderId: string,
    createLoanOfferDto: CreateLoanOfferDto,
  ): Promise<LoanOfferResponseDto> {
    try {
      this.logger.log(`Creating loan offer for lender: ${lenderId}`);

      // Handle creation date
      let createdDate = new Date();
      if (createLoanOfferDto.creationDate) {
        const providedDate = new Date(createLoanOfferDto.creationDate);

        // In production, validate the creation date
        if (process.env.NODE_ENV === 'production') {
          const now = new Date();
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

          if (providedDate < oneHourAgo || providedDate > oneHourFromNow) {
            throw new BadRequestException(
              'Creation date must be within one hour of current time in production environment',
            );
          }
        }

        createdDate = providedDate;
      }

      const expirationDate = createLoanOfferDto.expirationDate
        ? new Date(createLoanOfferDto.expirationDate)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Fetch the principal currency to get decimal precision
      const currencyRows = await this.repository.sql`
        SELECT blockchain_key, token_id, decimals
        FROM currencies
        WHERE blockchain_key = ${createLoanOfferDto.principalBlockchainKey}
          AND token_id = ${createLoanOfferDto.principalTokenId}
      `;

      if (currencyRows.length === 0) {
        throw new CurrencyNotSupportedException(
          createLoanOfferDto.principalBlockchainKey,
          createLoanOfferDto.principalTokenId,
        );
      }

      const principalCurrency = currencyRows[0];
      assertDefined(principalCurrency);
      // principalCurrency is validated above; no explicit any needed
      assertPropNumber(principalCurrency, 'decimals');

      // Convert totalAmount from human-readable to smallest unit
      const totalAmountSmallestUnit = this.loanCalculationService.toSmallestUnit(
        createLoanOfferDto.totalAmount,
        principalCurrency.decimals,
      );

      let invoiceDraft;
      try {
        invoiceDraft = await this.invoiceService.prepareInvoice({
          userId: lenderId,
          currencyBlockchainKey: createLoanOfferDto.principalBlockchainKey,
          currencyTokenId: createLoanOfferDto.principalTokenId,
          accountBlockchainKey: createLoanOfferDto.principalBlockchainKey,
          accountTokenId: createLoanOfferDto.principalTokenId,
          invoiceType: 'LoanPrincipal',
          invoicedAmount: totalAmountSmallestUnit,
          prepaidAmount: '0',
          invoiceDate: createdDate,
          dueDate: expirationDate,
          expiredDate: expirationDate,
        });
      } catch (error) {
        this.logger.error('Error preparing invoice:', error);
        if (
          error instanceof InvoiceError ||
          error.message?.includes('Wallet service not found') ||
          error.message?.includes('Unsupported blockchain key')
        ) {
          throw new CurrencyNotSupportedException(
            createLoanOfferDto.principalBlockchainKey,
            createLoanOfferDto.principalTokenId,
          );
        }
        throw error;
      }

      // Convert min/max loan amounts to smallest unit
      const minLoanAmountSmallestUnit = this.loanCalculationService.toSmallestUnit(
        createLoanOfferDto.minLoanAmount || '1000',
        principalCurrency.decimals,
      );
      const maxLoanAmountSmallestUnit = this.loanCalculationService.toSmallestUnit(
        createLoanOfferDto.maxLoanAmount || createLoanOfferDto.totalAmount,
        principalCurrency.decimals,
      );

      const result: LenderCreatesLoanOfferResult = await this.repository.lenderCreatesLoanOffer({
        lenderUserId: lenderId,
        principalBlockchainKey: createLoanOfferDto.principalBlockchainKey,
        principalTokenId: createLoanOfferDto.principalTokenId,
        offeredPrincipalAmount: totalAmountSmallestUnit,
        minLoanPrincipalAmount: minLoanAmountSmallestUnit,
        maxLoanPrincipalAmount: maxLoanAmountSmallestUnit,
        interestRate: createLoanOfferDto.interestRate,
        termInMonthsOptions: createLoanOfferDto.termOptions,
        expirationDate,
        createdDate,
        fundingInvoiceId: invoiceDraft.invoiceId,
        fundingInvoicePrepaidAmount: invoiceDraft.prepaidAmount,
        fundingAccountBlockchainKey: invoiceDraft.accountBlockchainKey,
        fundingAccountTokenId: invoiceDraft.accountTokenId,
        fundingInvoiceDate: invoiceDraft.invoiceDate,
        fundingInvoiceDueDate: invoiceDraft.dueDate ?? expirationDate,
        fundingInvoiceExpiredDate: invoiceDraft.expiredDate ?? expirationDate,
        fundingWalletDerivationPath: invoiceDraft.walletDerivationPath,
        fundingWalletAddress: invoiceDraft.walletAddress,
      });

      this.indexerEventService.addWallet(
        createLoanOfferDto.principalBlockchainKey,
        createLoanOfferDto.principalTokenId,
        invoiceDraft.walletAddress,
        invoiceDraft.walletDerivationPath,
      );

      return {
        id: result.id,
        lenderId: result.lenderUserId,
        lender: {
          id: result.lenderUserId,
          type:
            result.lenderUserType === 'Individual' ? LenderType.INDIVIDUAL : LenderType.INSTITUTION,
          name: result.lenderUserName || 'Lender User',
          verified: true,
          businessType: result.lenderBusinessType,
          businessDescription: result.lenderBusinessDescription,
          profilePictureUrl: result.lenderProfilePictureUrl,
        },
        principalCurrency: {
          blockchainKey: result.principalCurrency.blockchainKey,
          tokenId: result.principalCurrency.tokenId,
          name: result.principalCurrency.name,
          symbol: result.principalCurrency.symbol,
          decimals: result.principalCurrency.decimals,
          logoUrl: `https://assets.cryptogadai.com/currencies/${result.principalCurrency.symbol.toLowerCase()}.png`,
        },
        totalAmount: this.loanCalculationService.fromSmallestUnit(
          result.offeredPrincipalAmount,
          result.principalCurrency.decimals,
        ),
        availableAmount: this.loanCalculationService.fromSmallestUnit(
          result.availablePrincipalAmount,
          result.principalCurrency.decimals,
        ),
        disbursedAmount: '0',
        interestRate: result.interestRate,
        termOptions: result.termInMonthsOptions,
        status: this.mapRepositoryStatusToDto(result.status),
        createdDate: result.createdDate.toISOString(),
        publishedDate: undefined,
        fundingInvoice: {
          id: String(invoiceDraft.invoiceId),
          amount: this.loanCalculationService.fromSmallestUnit(
            result.fundingInvoice.amount,
            result.principalCurrency.decimals,
          ),
          currency: {
            blockchainKey: result.principalCurrency.blockchainKey,
            tokenId: result.principalCurrency.tokenId,
            name: result.principalCurrency.name,
            symbol: result.principalCurrency.symbol,
            decimals: result.principalCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${result.principalCurrency.symbol.toLowerCase()}.png`,
          },
          walletAddress: invoiceDraft.walletAddress,
          expiryDate: result.fundingInvoice.expiryDate.toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to create loan offer', error);

      // Handle currency validation errors
      if (error.message?.includes('does not exist') || error.message?.includes('Currency')) {
        // Extract currency info from error message if possible
        const match = error.message.match(/Currency ([^:]+):([^\s]+)/);
        if (match) {
          throw new CurrencyNotSupportedException(match[1], match[2]);
        }
        throw new CurrencyNotSupportedException(
          createLoanOfferDto.principalBlockchainKey,
          createLoanOfferDto.principalTokenId,
        );
      }

      // If it's already a known exception, re-throw it
      if (
        error instanceof CurrencyNotSupportedException ||
        error instanceof InterestRateInvalidException ||
        error instanceof ValidationErrorException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to create loan offer');
    }
  }

  /**
   * List available loan offers
   */
  async listLoanOffers(params: ListLoanOffersParams): Promise<LoanOfferListResponseDto> {
    try {
      this.logger.log('Listing available loan offers');

      const result = await this.repository.platformListsAvailableLoanOffers({
        collateralBlockchainKey: params.collateralBlockchainKey,
        collateralTokenId: params.collateralTokenId,
        principalBlockchainKey: params.principalBlockchainKey,
        principalTokenId: params.principalTokenId,
        page: params.page,
        limit: params.limit,
      });

      const offers = result.loanOffers.map(offer => ({
        id: offer.id,
        lenderId: offer.lenderUserId,
        lender: {
          id: offer.lenderUserId,
          type:
            offer.lenderUserType === 'Individual' ? LenderType.INDIVIDUAL : LenderType.INSTITUTION,
          name: offer.lenderUserName || 'Lender User',
          verified: true,
        },
        principalCurrency: {
          blockchainKey: offer.principalCurrency.blockchainKey,
          tokenId: offer.principalCurrency.tokenId,
          name: offer.principalCurrency.name,
          symbol: offer.principalCurrency.symbol,
          decimals: offer.principalCurrency.decimals,
          logoUrl: `https://assets.cryptogadai.com/currencies/${offer.principalCurrency.symbol.toLowerCase()}.png`,
        },
        totalAmount: this.loanCalculationService.fromSmallestUnit(
          offer.availablePrincipalAmount,
          offer.principalCurrency.decimals,
        ),
        availableAmount: this.loanCalculationService.fromSmallestUnit(
          offer.availablePrincipalAmount,
          offer.principalCurrency.decimals,
        ),
        disbursedAmount: '0',
        interestRate: offer.interestRate,
        termOptions: offer.termInMonthsOptions,
        status: LoanOfferStatus.PUBLISHED,
        createdDate: offer.publishedDate.toISOString(),
        publishedDate: offer.publishedDate.toISOString(),
        fundingInvoice: {
          id: `inv_${offer.id}`,
          amount: this.loanCalculationService.fromSmallestUnit(
            offer.availablePrincipalAmount,
            offer.principalCurrency.decimals,
          ),
          currency: {
            blockchainKey: offer.principalCurrency.blockchainKey,
            tokenId: offer.principalCurrency.tokenId,
            name: offer.principalCurrency.name,
            symbol: offer.principalCurrency.symbol,
            decimals: offer.principalCurrency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${offer.principalCurrency.symbol.toLowerCase()}.png`,
          },
          walletAddress: '0x742d35Cc6634C0532925a3b8D...',
          expiryDate: offer.expirationDate.toISOString(),
        },
      }));

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
          offers,
          pagination,
        },
      };
    } catch (error) {
      this.logger.error('Failed to list loan offers', error);
      throw new BadRequestException('Failed to retrieve loan offers');
    }
  }

  /**
   * Get my loan offers
   */
  async getMyLoanOffers(
    lenderId: string,
    params: PaginationParams,
  ): Promise<LoanOfferListResponseDto> {
    try {
      this.logger.log(`Getting loan offers for lender: ${lenderId}`);

      const result = await this.repository.lenderViewsMyLoanOffers({
        lenderUserId: lenderId,
        page: params.page,
        limit: params.limit,
      });

      const offers = await Promise.all(
        result.loanOffers.map(async offer => {
          const dto = await this.getLoanOfferById(offer.id);
          return {
            id: dto.id,
            lenderId: lenderId,
            lender: dto.lender,
            principalCurrency: dto.principalCurrency,
            totalAmount: dto.totalAmount,
            availableAmount: dto.availableAmount,
            disbursedAmount: dto.disbursedAmount,
            interestRate: dto.interestRate,
            termOptions: dto.termOptions,
            status: dto.status,
            createdDate: dto.createdDate,
            publishedDate: dto.publishedDate,
            fundingInvoice: dto.fundingInvoice,
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
          offers,
          pagination,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get my loan offers', error);
      throw new BadRequestException('Failed to retrieve your loan offers');
    }
  }

  /**
   * Update loan offer
   */
  async updateLoanOffer(
    lenderId: string,
    offerId: string,
    updateLoanOfferDto: UpdateLoanOfferDto,
  ): Promise<LoanOfferResponseDto> {
    try {
      this.logger.log(`Updating loan offer ${offerId} for lender: ${lenderId}`);

      if (updateLoanOfferDto.action === 'Close') {
        const result = await this.repository.lenderClosesLoanOffer({
          loanOfferId: offerId,
          lenderUserId: lenderId,
          closedDate: new Date(),
          closureReason: updateLoanOfferDto.closureReason,
        });

        // Return minimal response for close action
        return {
          id: result.id,
          lenderId: lenderId,
          lender: {
            id: lenderId,
            type: LenderType.INDIVIDUAL,
            name: 'Lender User',
            verified: true,
          },
          principalCurrency: {
            blockchainKey: 'eip155:56',
            tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            name: 'USDT',
            symbol: 'USDT',
            decimals: 6,
            logoUrl: 'https://assets.cryptogadai.com/currencies/usdt.png',
          },
          totalAmount: '0.000000',
          availableAmount: '0.000000',
          disbursedAmount: '0.000000',
          interestRate: 0,
          termOptions: [],
          status: this.mapRepositoryStatusToDto(result.status),
          createdDate: new Date().toISOString(),
          publishedDate: undefined,
          fundingInvoice: {
            id: `inv_${result.id}`,
            amount: '0.000000',
            currency: {
              blockchainKey: 'eip155:56',
              tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              name: 'USDT',
              symbol: 'USDT',
              decimals: 6,
              logoUrl: 'https://assets.cryptogadai.com/currencies/usdt.png',
            },
            walletAddress: '0x742d35Cc6634C0532925a3b8D...',
            expiryDate: result.closedDate.toISOString(),
          },
        };
      }

      throw new NotFoundException(
        'Loan offer not found or you do not have permission to update it',
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to update loan offer', error);
      // Check for common "not found" patterns in error messages
      if (
        error.message?.includes('not found') ||
        error.message?.includes('does not exist') ||
        error.message?.includes('not authorized') ||
        error.message?.includes('permission denied')
      ) {
        throw new NotFoundException(
          'Loan offer not found or you do not have permission to update it',
        );
      }
      throw new BadRequestException('Failed to update loan offer');
    }
  }

  /**
   * Get loan offer by ID
   */
  async getLoanOfferById(offerId: string): Promise<LoanOfferResponseDto> {
    try {
      const result = await this.repository.lenderGetsLoanOfferById({ loanOfferId: offerId });

      const resultAny = result as {
        id: string;
        lenderUserId: string;
        lenderUserType: 'Individual' | 'Institution' | string;
        lenderUserName?: string;
        lenderBusinessType?: string | null;
        lenderBusinessDescription?: string | null;
        principalCurrency: {
          blockchainKey: string;
          tokenId: string;
          name: string;
          symbol: string;
          decimals: number;
        };
        offeredPrincipalAmount: string;
        availablePrincipalAmount: string;
        disbursedPrincipalAmount?: string | number | null;
        interestRate: number;
        termInMonthsOptions?: number[] | unknown;
        status: 'Funding' | 'Published' | 'Closed' | 'Expired' | string;
        createdDate: Date;
        publishedDate?: Date | null;
        expirationDate: Date;
        fundingInvoice?:
          | {
              id: string | number;
              amount: string | number;
              currency: {
                blockchainKey: string;
                tokenId: string;
                name: string;
                symbol: string;
                decimals: number;
              };
              walletAddress?: string | null;
              expiryDate?: Date | null;
              paidDate?: Date | null;
              expiredDate?: Date | null;
            }
          | undefined;
      };

      const fundingInvoiceDto = resultAny.fundingInvoice
        ? {
            id: String(resultAny.fundingInvoice.id),
            amount: this.loanCalculationService.fromSmallestUnit(
              String(resultAny.fundingInvoice.amount),
              resultAny.principalCurrency.decimals,
            ),
            currency: {
              blockchainKey: resultAny.fundingInvoice.currency.blockchainKey,
              tokenId: resultAny.fundingInvoice.currency.tokenId,
              name: resultAny.fundingInvoice.currency.name,
              symbol: resultAny.fundingInvoice.currency.symbol,
              decimals: resultAny.fundingInvoice.currency.decimals,
              logoUrl: `https://assets.cryptogadai.com/currencies/${resultAny.fundingInvoice.currency.symbol.toLowerCase()}.png`,
            },
            walletAddress: resultAny.fundingInvoice.walletAddress || '',
            expiryDate: resultAny.fundingInvoice.expiryDate
              ? typeof resultAny.fundingInvoice.expiryDate === 'string'
                ? resultAny.fundingInvoice.expiryDate
                : resultAny.fundingInvoice.expiryDate.toISOString()
              : resultAny.expirationDate
                ? resultAny.expirationDate.toISOString()
                : new Date().toISOString(),
            paidDate: resultAny.fundingInvoice.paidDate
              ? String(resultAny.fundingInvoice.paidDate)
              : undefined,
            expiredDate: resultAny.fundingInvoice.expiredDate
              ? String(resultAny.fundingInvoice.expiredDate)
              : undefined,
          }
        : {
            id: 'unknown',
            amount: '0.000000000000000000',
            currency: {
              blockchainKey: resultAny.principalCurrency.blockchainKey,
              tokenId: resultAny.principalCurrency.tokenId,
              name: resultAny.principalCurrency.name,
              symbol: resultAny.principalCurrency.symbol,
              decimals: resultAny.principalCurrency.decimals,
              logoUrl: `https://assets.cryptogadai.com/currencies/${resultAny.principalCurrency.symbol.toLowerCase()}.png`,
            },
            walletAddress: '',
            expiryDate: resultAny.expirationDate
              ? resultAny.expirationDate.toISOString()
              : new Date().toISOString(),
            paidDate: undefined,
            expiredDate: undefined,
          };

      return {
        id: resultAny.id,
        lenderId: resultAny.lenderUserId,
        lender: {
          id: resultAny.lenderUserId,
          type:
            resultAny.lenderUserType === 'Individual'
              ? LenderType.INDIVIDUAL
              : LenderType.INSTITUTION,
          name: resultAny.lenderUserName || 'Lender User',
          verified: true,
          businessType: resultAny.lenderBusinessType || undefined,
          businessDescription: resultAny.lenderBusinessDescription || undefined,
        },
        principalCurrency: {
          blockchainKey: resultAny.principalCurrency.blockchainKey,
          tokenId: resultAny.principalCurrency.tokenId,
          name: resultAny.principalCurrency.name,
          symbol: resultAny.principalCurrency.symbol,
          decimals: resultAny.principalCurrency.decimals,
          logoUrl: `https://assets.cryptogadai.com/currencies/${resultAny.principalCurrency.symbol.toLowerCase()}.png`,
        },
        totalAmount: this.loanCalculationService.fromSmallestUnit(
          resultAny.offeredPrincipalAmount,
          resultAny.principalCurrency.decimals,
        ),
        availableAmount: this.loanCalculationService.fromSmallestUnit(
          resultAny.availablePrincipalAmount,
          resultAny.principalCurrency.decimals,
        ),
        disbursedAmount: this.loanCalculationService.fromSmallestUnit(
          String(resultAny.disbursedPrincipalAmount || '0'),
          resultAny.principalCurrency.decimals,
        ),
        interestRate: resultAny.interestRate,
        termOptions: Array.isArray(resultAny.termInMonthsOptions)
          ? (resultAny.termInMonthsOptions as unknown[]).map(Number)
          : [],
        status: this.mapRepositoryStatusToDto(
          ['Funding', 'Published', 'Closed', 'Expired'].includes(resultAny.status)
            ? (resultAny.status as 'Funding' | 'Published' | 'Closed' | 'Expired')
            : 'Funding',
        ),
        createdDate: resultAny.createdDate.toISOString
          ? resultAny.createdDate.toISOString()
          : String(resultAny.createdDate),
        publishedDate: resultAny.publishedDate
          ? resultAny.publishedDate.toISOString
            ? resultAny.publishedDate.toISOString()
            : String(resultAny.publishedDate)
          : undefined,
        fundingInvoice: fundingInvoiceDto,
      };
    } catch (error) {
      this.logger.error('Failed to get loan offer by id', error);
      throw new NotFoundException('Loan offer not found');
    }
  }
}
