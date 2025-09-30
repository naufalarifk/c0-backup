import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { InvoiceService } from '../../../shared/invoice/invoice.service';
import { InvoiceError } from '../../../shared/invoice/invoice.types';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
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
  private readonly logger = new Logger(LoanOffersService.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
    private readonly invoiceService: InvoiceService,
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

      const createdDate = new Date();
      const expirationDate = createLoanOfferDto.expirationDate
        ? new Date(createLoanOfferDto.expirationDate)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      let invoiceDraft;
      try {
        invoiceDraft = await this.invoiceService.prepareInvoice({
          userId: lenderId,
          currencyBlockchainKey: createLoanOfferDto.principalBlockchainKey,
          currencyTokenId: createLoanOfferDto.principalTokenId,
          accountBlockchainKey: createLoanOfferDto.principalBlockchainKey,
          accountTokenId: createLoanOfferDto.principalTokenId,
          invoiceType: 'LoanPrincipal',
          invoicedAmount: createLoanOfferDto.totalAmount,
          prepaidAmount: '0',
          invoiceDate: createdDate,
          dueDate: expirationDate,
          expiredDate: expirationDate,
        });
      } catch (error) {
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

      const result = await this.repository.lenderCreatesLoanOffer({
        lenderUserId: lenderId,
        principalBlockchainKey: createLoanOfferDto.principalBlockchainKey,
        principalTokenId: createLoanOfferDto.principalTokenId,
        offeredPrincipalAmount: createLoanOfferDto.totalAmount,
        minLoanPrincipalAmount: createLoanOfferDto.minLoanAmount || '1000000000000000000',
        maxLoanPrincipalAmount: createLoanOfferDto.maxLoanAmount || createLoanOfferDto.totalAmount,
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

      return {
        id: result.id,
        lenderId: result.lenderUserId,
        lender: {
          id: result.lenderUserId,
          type:
            result.lenderUserType === 'Individual' ? LenderType.INDIVIDUAL : LenderType.INSTITUTION,
          name: result.lenderUserName || 'Lender User',
          verified: true,
        },
        principalCurrency: {
          blockchainKey: result.principalCurrency.blockchainKey,
          tokenId: result.principalCurrency.tokenId,
          name: result.principalCurrency.name,
          symbol: result.principalCurrency.symbol,
          decimals: result.principalCurrency.decimals,
          logoUrl: `https://assets.cryptogadai.com/currencies/${result.principalCurrency.symbol.toLowerCase()}.png`,
        },
        totalAmount: result.offeredPrincipalAmount,
        availableAmount: result.availablePrincipalAmount,
        disbursedAmount: '0.000000000000000000',
        interestRate: result.interestRate,
        termOptions: result.termInMonthsOptions,
        status: this.mapRepositoryStatusToDto(result.status),
        createdDate: result.createdDate.toISOString(),
        publishedDate: undefined,
        fundingInvoice: {
          id: result.fundingInvoice.id,
          amount: result.fundingInvoice.amount,
          currency: {
            blockchainKey: result.fundingInvoice.currency.blockchainKey,
            tokenId: result.fundingInvoice.currency.tokenId,
            name: result.fundingInvoice.currency.name,
            symbol: result.fundingInvoice.currency.symbol,
            decimals: result.fundingInvoice.currency.decimals,
            logoUrl: `https://assets.cryptogadai.com/currencies/${result.fundingInvoice.currency.symbol.toLowerCase()}.png`,
          },
          walletAddress: '0x742d35Cc6634C0532925a3b8D...',
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
          type: LenderType.INDIVIDUAL,
          name: 'Lender User',
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
        totalAmount: offer.availablePrincipalAmount,
        availableAmount: offer.availablePrincipalAmount,
        disbursedAmount: '0.000000000000000000',
        interestRate: offer.interestRate,
        termOptions: offer.termInMonthsOptions,
        status: LoanOfferStatus.PUBLISHED,
        createdDate: offer.publishedDate.toISOString(),
        publishedDate: offer.publishedDate.toISOString(),
        fundingInvoice: {
          id: `inv_${offer.id}`,
          amount: offer.availablePrincipalAmount,
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

      const offers = result.loanOffers.map(offer => ({
        id: offer.id,
        lenderId: lenderId,
        lender: {
          id: lenderId,
          type: LenderType.INDIVIDUAL,
          name: 'Lender User',
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
        totalAmount: offer.offeredPrincipalAmount,
        availableAmount: offer.availablePrincipalAmount,
        disbursedAmount: offer.disbursedPrincipalAmount,
        interestRate: offer.interestRate,
        termOptions: offer.termInMonthsOptions,
        status: this.mapRepositoryStatusToDto(offer.status),
        createdDate: offer.createdDate.toISOString(),
        publishedDate: offer.publishedDate?.toISOString(),
        fundingInvoice: {
          id: `inv_${offer.id}`,
          amount: offer.offeredPrincipalAmount,
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
}
