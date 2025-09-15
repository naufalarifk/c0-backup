import type { UserSession } from '../../auth/types';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthGuard } from '../../auth/auth.guard';

// Mock session type for testing - only include required fields
const createMockSession = (userId: string): UserSession => ({
  user: {
    id: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    email: 'test@example.com',
    emailVerified: false,
    name: 'Test User',
  },
  session: {
    id: 'session_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    userId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    token: 'token_123',
  },
});

import { LiquidationMode, LoanOfferStatus } from '../dto/common.dto';
import { CreateLoanOfferDto, UpdateLoanOfferDto } from '../dto/loan-offers.dto';
import { LoanOffersService } from '../services/loan-offers.service';
import { LoanOffersController } from './loan-offers.controller';

describe('LoanOffersController', () => {
  let controller: LoanOffersController;
  let service: LoanOffersService;

  const mockLoanOffersService = {
    createLoanOffer: jest.fn(),
    listLoanOffers: jest.fn(),
    getMyLoanOffers: jest.fn(),
    updateLoanOffer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoanOffersController],
      providers: [
        {
          provide: LoanOffersService,
          useValue: mockLoanOffersService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LoanOffersController>(LoanOffersController);
    service = module.get<LoanOffersService>(LoanOffersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createLoanOffer', () => {
    it('should create a loan offer successfully', async () => {
      const mockSession = createMockSession('user_12345');
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

      const expectedResponse = {
        id: 'offer_12345',
        lenderId: 'user_12345',
        principalCurrency: {
          blockchainKey: 'eip155:56',
          tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          logoUrl: 'https://assets.cryptogadai.com/currencies/usdc.png',
        },
        totalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        status: LoanOfferStatus.DRAFT,
        createdDate: new Date().toISOString(),
        fundingInvoice: {
          id: 'inv_12345',
          amount: '10000.000000000000000000',
          currency: {
            blockchainKey: 'eip155:56',
            tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            logoUrl: 'https://assets.cryptogadai.com/currencies/usdc.png',
          },
          walletAddress: '0x1234567890123456789012345678901234567890',
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      mockLoanOffersService.createLoanOffer.mockResolvedValue(expectedResponse);

      const result = await controller.createLoanOffer(mockSession, createLoanOfferDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedResponse);
      expect(service.createLoanOffer).toHaveBeenCalledWith('user_12345', createLoanOfferDto);
    });

    it('should handle service errors', async () => {
      const mockSession = createMockSession('user_12345');
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

      mockLoanOffersService.createLoanOffer.mockRejectedValue(
        new BadRequestException('Invalid loan offer parameters'),
      );

      await expect(controller.createLoanOffer(mockSession, createLoanOfferDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listLoanOffers', () => {
    it('should list loan offers with pagination', async () => {
      const expectedResponse = {
        success: true,
        data: {
          offers: [
            {
              id: 'offer_12345',
              lenderId: 'user_12345',
              principalCurrency: {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                logoUrl: 'https://assets.cryptogadai.com/currencies/usdc.png',
              },
              totalAmount: '10000.000000000000000000',
              interestRate: 12.5,
              status: LoanOfferStatus.PUBLISHED,
              createdDate: new Date().toISOString(),
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
        },
      };

      mockLoanOffersService.listLoanOffers.mockResolvedValue(expectedResponse);

      const result = await controller.listLoanOffers(1, 20);

      expect(result).toEqual(expectedResponse);
      expect(service.listLoanOffers).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it('should handle filters in listing', async () => {
      const expectedResponse = {
        success: true,
        data: {
          offers: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      };

      mockLoanOffersService.listLoanOffers.mockResolvedValue(expectedResponse);

      const result = await controller.listLoanOffers(
        1,
        20,
        'eip155:1',
        'eip155:56',
        undefined,
        undefined,
      );

      expect(result).toEqual(expectedResponse);
      expect(service.listLoanOffers).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'eip155:56',
        principalBlockchainKey: undefined,
        principalTokenId: undefined,
      });
    });
  });

  describe('getMyLoanOffers', () => {
    it("should get user's loan offers", async () => {
      const mockSession = createMockSession('user_12345');
      const expectedResponse = {
        success: true,
        data: {
          offers: [
            {
              id: 'offer_12345',
              lenderId: 'user_12345',
              principalCurrency: {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                logoUrl: 'https://assets.cryptogadai.com/currencies/usdc.png',
              },
              totalAmount: '10000.000000000000000000',
              interestRate: 12.5,
              status: LoanOfferStatus.DRAFT,
              createdDate: new Date().toISOString(),
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
        },
      };

      mockLoanOffersService.getMyLoanOffers.mockResolvedValue(expectedResponse);

      const result = await controller.getMyLoanOffers(mockSession, 1, 20);

      expect(result).toEqual(expectedResponse);
      expect(service.getMyLoanOffers).toHaveBeenCalledWith('user_12345', { page: 1, limit: 20 });
    });
  });

  describe('updateLoanOffer', () => {
    it('should update loan offer successfully', async () => {
      const mockSession = createMockSession('user_12345');
      const offerId = 'offer_12345';
      const updateLoanOfferDto: UpdateLoanOfferDto = {
        action: 'Pause',
      };

      const expectedResponse = {
        id: offerId,
        lenderId: 'user_12345',
        principalCurrency: {
          blockchainKey: 'eip155:56',
          tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          logoUrl: 'https://assets.cryptogadai.com/currencies/usdc.png',
        },
        totalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        status: LoanOfferStatus.CLOSED,
        createdDate: new Date().toISOString(),
      };

      mockLoanOffersService.updateLoanOffer.mockResolvedValue(expectedResponse);

      const result = await controller.updateLoanOffer(mockSession, offerId, updateLoanOfferDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedResponse);
      expect(service.updateLoanOffer).toHaveBeenCalledWith(
        'user_12345',
        offerId,
        updateLoanOfferDto,
      );
    });

    it('should handle not found error', async () => {
      const mockSession = createMockSession('user_12345');
      const offerId = 'offer_nonexistent';
      const updateLoanOfferDto: UpdateLoanOfferDto = {
        action: 'Pause',
      };

      mockLoanOffersService.updateLoanOffer.mockRejectedValue(
        new NotFoundException('Loan offer not found'),
      );

      await expect(
        controller.updateLoanOffer(mockSession, offerId, updateLoanOfferDto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
