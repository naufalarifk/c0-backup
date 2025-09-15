import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { LiquidationMode } from '../dto/common.dto';
import { CreateLoanOfferDto, UpdateLoanOfferDto } from '../dto/loan-offers.dto';
import { LoanOffersService } from './loan-offers.service';

describe('LoanOffersService', () => {
  let service: LoanOffersService;
  let repository: jest.Mocked<CryptogadaiRepository>;

  beforeEach(async () => {
    const mockRepository = {
      lenderCreatesLoanOffer: jest.fn(),
      platformListsAvailableLoanOffers: jest.fn(),
      lenderViewsMyLoanOffers: jest.fn(),
      lenderClosesLoanOffer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanOffersService,
        {
          provide: CryptogadaiRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LoanOffersService>(LoanOffersService);
    repository = module.get(CryptogadaiRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLoanOffer', () => {
    it('should create a loan offer successfully', async () => {
      const lenderId = 'user_12345';
      const createLoanOfferDto: CreateLoanOfferDto = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '10000.000000000000000000',
        liquidationMode: LiquidationMode.PARTIAL,
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const mockRepositoryResult = {
        id: 'offer_12345',
        lenderUserId: lenderId,
        principalCurrency: {
          blockchainKey: 'eip155:56',
          tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 18,
        },
        offeredPrincipalAmount: '10000.000000000000000000',
        availablePrincipalAmount: '10000.000000000000000000',
        minLoanPrincipalAmount: '1000.000000000000000000',
        maxLoanPrincipalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        termInMonthsOptions: [3, 6],
        status: 'Funding' as const,
        createdDate: new Date('2025-09-15T10:30:00Z'),
        expirationDate: new Date('2025-12-31T23:59:59Z'),
        fundingInvoice: {
          id: 'inv_12345',
          amount: '10000.000000000000000000',
          currency: {
            blockchainKey: 'eip155:56',
            tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 18,
          },
          status: 'Pending' as const,
          createdDate: new Date('2025-09-15T10:30:00Z'),
          expiryDate: new Date('2025-09-16T10:30:00Z'),
        },
      };

      repository.lenderCreatesLoanOffer.mockResolvedValue(mockRepositoryResult);

      const result = await service.createLoanOffer(lenderId, createLoanOfferDto);

      expect(result).toBeDefined();
      expect(result.lenderId).toBe(lenderId);
      expect(result.totalAmount).toBe(mockRepositoryResult.offeredPrincipalAmount);
      expect(result.interestRate).toBe(createLoanOfferDto.interestRate);
      expect(result.status).toBe('Draft');
      expect(result.fundingInvoice).toBeDefined();
      expect(repository.lenderCreatesLoanOffer).toHaveBeenCalledWith({
        lenderUserId: lenderId,
        principalBlockchainKey: createLoanOfferDto.principalBlockchainKey,
        principalTokenId: createLoanOfferDto.principalTokenId,
        offeredPrincipalAmount: createLoanOfferDto.totalAmount,
        interestRate: createLoanOfferDto.interestRate,
        termInMonthsOptions: createLoanOfferDto.termOptions,
        minLoanPrincipalAmount: createLoanOfferDto.minLoanAmount,
        maxLoanPrincipalAmount: createLoanOfferDto.maxLoanAmount,
        createdDate: expect.any(Date),
        expirationDate: createLoanOfferDto.expirationDate
          ? new Date(createLoanOfferDto.expirationDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    });

    it('should handle creation errors gracefully', async () => {
      const lenderId = 'user_12345';
      const createLoanOfferDto: CreateLoanOfferDto = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '10000.000000000000000000',
        liquidationMode: LiquidationMode.PARTIAL,
      };

      // Mock repository method to throw error
      repository.lenderCreatesLoanOffer.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.createLoanOffer(lenderId, createLoanOfferDto)).rejects.toThrow();
    });
  });

  describe('listLoanOffers', () => {
    it('should return paginated loan offers', async () => {
      const params = {
        page: 1,
        limit: 20,
        collateralBlockchainKey: 'eip155:1',
        principalBlockchainKey: 'eip155:56',
      };

      const mockRepositoryResult = {
        loanOffers: [
          {
            id: 'offer_1',
            lenderUserId: 'user_123',
            principalCurrency: {
              blockchainKey: 'eip155:56',
              tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              symbol: 'USDC',
              name: 'USD Coin',
              decimals: 18,
            },
            availablePrincipalAmount: '10000.000000000000000000',
            minLoanPrincipalAmount: '1000.000000000000000000',
            maxLoanPrincipalAmount: '10000.000000000000000000',
            interestRate: 12.5,
            termInMonthsOptions: [3, 6],
            expirationDate: new Date('2025-12-31T23:59:59Z'),
            publishedDate: new Date('2025-09-15T10:30:00Z'),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      repository.platformListsAvailableLoanOffers.mockResolvedValue(mockRepositoryResult);

      const result = await service.listLoanOffers(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.offers).toBeDefined();
      expect(result.data.pagination).toBeDefined();
      expect(result.data.pagination.page).toBe(params.page);
      expect(result.data.pagination.limit).toBe(params.limit);
      expect(repository.platformListsAvailableLoanOffers).toHaveBeenCalledWith({
        page: params.page,
        limit: params.limit,
        collateralBlockchainKey: params.collateralBlockchainKey,
        principalBlockchainKey: params.principalBlockchainKey,
      });
    });
  });

  describe('getMyLoanOffers', () => {
    it("should return lender's loan offers", async () => {
      const lenderId = 'user_12345';
      const params = { page: 1, limit: 20 };

      const mockRepositoryResult = {
        loanOffers: [
          {
            id: 'offer_1',
            principalCurrency: {
              blockchainKey: 'eip155:56',
              tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              symbol: 'USDC',
              name: 'USD Coin',
              decimals: 18,
            },
            offeredPrincipalAmount: '10000.000000000000000000',
            availablePrincipalAmount: '8000.000000000000000000',
            disbursedPrincipalAmount: '2000.000000000000000000',
            reservedPrincipalAmount: '0.000000000000000000',
            minLoanPrincipalAmount: '1000.000000000000000000',
            maxLoanPrincipalAmount: '10000.000000000000000000',
            interestRate: 12.5,
            termInMonthsOptions: [3, 6],
            status: 'Published' as const,
            createdDate: new Date('2025-09-15T10:30:00Z'),
            publishedDate: new Date('2025-09-15T10:30:00Z'),
            expirationDate: new Date('2025-12-31T23:59:59Z'),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      repository.lenderViewsMyLoanOffers.mockResolvedValue(mockRepositoryResult);

      const result = await service.getMyLoanOffers(lenderId, params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.offers).toBeDefined();
      expect(result.data.pagination).toBeDefined();
      expect(repository.lenderViewsMyLoanOffers).toHaveBeenCalledWith({
        lenderUserId: lenderId,
        page: params.page,
        limit: params.limit,
      });
    });
  });

  describe('updateLoanOffer', () => {
    it('should close a loan offer successfully', async () => {
      const lenderId = 'user_12345';
      const offerId = 'offer_12345';
      const updateLoanOfferDto: UpdateLoanOfferDto = {
        action: 'Close',
        closureReason: 'No longer offering loans',
      };

      const mockRepositoryResult = {
        id: offerId,
        status: 'Closed' as const,
        closedDate: new Date('2025-09-15T12:00:00Z'),
        closureReason: 'No longer offering loans',
      };

      repository.lenderClosesLoanOffer.mockResolvedValue(mockRepositoryResult);

      const result = await service.updateLoanOffer(lenderId, offerId, updateLoanOfferDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(offerId);
      expect(result.status).toBe('Closed');
      expect(repository.lenderClosesLoanOffer).toHaveBeenCalledWith({
        loanOfferId: offerId,
        lenderUserId: lenderId,
        closedDate: expect.any(Date),
        closureReason: updateLoanOfferDto.closureReason,
      });
    });

    it('should handle repository errors gracefully', async () => {
      const lenderId = 'user_12345';
      const offerId = 'offer_nonexistent';
      const updateLoanOfferDto: UpdateLoanOfferDto = {
        action: 'Close',
        closureReason: 'No longer offering loans',
      };

      repository.lenderClosesLoanOffer.mockRejectedValueOnce(new Error('Loan offer not found'));

      await expect(
        service.updateLoanOffer(lenderId, offerId, updateLoanOfferDto),
      ).rejects.toThrow();
    });
  });
});
