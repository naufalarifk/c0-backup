import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { LiquidationMode } from '../dto/common.dto';
import {
  CreateLoanApplicationDto,
  LoanCalculationRequestDto,
  UpdateLoanApplicationDto,
} from '../dto/loan-applications.dto';
import { LoanApplicationsService } from './loan-applications.service';

describe('LoanApplicationsService', () => {
  let service: LoanApplicationsService;
  let repository: jest.Mocked<CryptogadaiRepository>;

  beforeEach(async () => {
    const mockRepository = {
      borrowerCalculatesLoanRequirements: jest.fn(),
      borrowerCreatesLoanApplication: jest.fn(),
      borrowerViewsMyLoanApplications: jest.fn(),
      borrowerUpdatesLoanApplication: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanApplicationsService,
        {
          provide: CryptogadaiRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LoanApplicationsService>(LoanApplicationsService);
    repository = module.get(CryptogadaiRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateLoanRequirements', () => {
    it('should calculate loan requirements successfully', async () => {
      const calculationRequest: LoanCalculationRequestDto = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        principalAmount: '5000.000000000000000000',
      };

      const mockRepositoryResult = {
        success: true,
        data: {
          principalAmount: '5000.000000000000000000',
          principalCurrency: {
            blockchainKey: 'eip155:56',
            tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 18,
          },
          collateralCurrency: {
            blockchainKey: 'eip155:1',
            tokenId: 'slip44:60',
            symbol: 'ETH',
            name: 'Ethereum',
            decimals: 18,
          },
          requiredCollateralAmount: '2.500000000000000000',
          minLtvRatio: 50.0,
          maxLtvRatio: 70.0,
          provisionAmount: '150.000000000000000000',
          provisionRate: 3.0,
          exchangeRate: {
            id: 'exchange_rate_123',
            rate: '2000.000000000000000000',
            timestamp: new Date('2025-09-15T10:30:00Z'),
          },
          termInMonths: 6,
          expirationDate: new Date('2025-09-22T10:30:00Z'),
        },
      };

      repository.borrowerCalculatesLoanRequirements.mockResolvedValue(mockRepositoryResult);

      const result = await service.calculateLoanRequirements(calculationRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.requiredCollateralAmount).toBeDefined();
      expect(result.data.exchangeRate).toBeDefined();
      expect(result.data.collateralCurrency).toBeDefined();
      expect(result.data.principalCurrency).toBeDefined();
      expect(result.data.maxLtvRatio).toBeDefined();
      expect(result.data.safetyBuffer).toBeDefined();
      expect(result.data.calculationDetails).toBeDefined();
      expect(repository.borrowerCalculatesLoanRequirements).toHaveBeenCalledWith({
        collateralBlockchainKey: calculationRequest.collateralBlockchainKey,
        collateralTokenId: calculationRequest.collateralTokenId,
        principalBlockchainKey: calculationRequest.principalBlockchainKey,
        principalTokenId: calculationRequest.principalTokenId,
        principalAmount: calculationRequest.principalAmount,
        termInMonths: 6,
        calculationDate: expect.any(Date),
      });
    });

    it('should handle calculation errors gracefully', async () => {
      const calculationRequest: LoanCalculationRequestDto = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        principalAmount: '5000.000000000000000000',
      };

      // Mock repository method to throw error
      repository.borrowerCalculatesLoanRequirements.mockRejectedValueOnce(
        new Error('Exchange rate service unavailable'),
      );

      await expect(service.calculateLoanRequirements(calculationRequest)).rejects.toThrow();
    });
  });

  describe('createLoanApplication', () => {
    it('should create loan application successfully', async () => {
      const borrowerId = 'user_54321';
      const createLoanApplicationDto: CreateLoanApplicationDto = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '5000.000000000000000000',
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: LiquidationMode.FULL,
        minLtvRatio: 0.5,
      };

      const mockRepositoryResult = {
        id: 'app_12345',
        borrowerUserId: borrowerId,
        principalCurrency: {
          blockchainKey: 'eip155:56',
          tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 18,
        },
        principalAmount: '5000.000000000000000000',
        provisionAmount: '150.000000000000000000',
        maxInterestRate: 15.0,
        minLtvRatio: 50.0,
        maxLtvRatio: 70.0,
        termInMonths: 6,
        liquidationMode: LiquidationMode.FULL,
        collateralCurrency: {
          blockchainKey: 'eip155:1',
          tokenId: 'slip44:60',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
        },
        collateralDepositAmount: '2.500000000000000000',
        status: 'PendingCollateral' as const,
        appliedDate: new Date('2025-09-15T10:30:00Z'),
        expirationDate: new Date('2025-09-22T10:30:00Z'),
        collateralDepositInvoice: {
          id: 'inv_12345',
          amount: '2.500000000000000000',
          currency: {
            blockchainKey: 'eip155:1',
            tokenId: 'slip44:60',
            symbol: 'ETH',
            name: 'Ethereum',
            decimals: 18,
          },
          status: 'Pending' as const,
          createdDate: new Date('2025-09-15T10:30:00Z'),
          expiryDate: new Date('2025-09-16T10:30:00Z'),
        },
      };

      repository.borrowerCreatesLoanApplication.mockResolvedValue(mockRepositoryResult);

      const result = await service.createLoanApplication(borrowerId, createLoanApplicationDto);

      expect(result).toBeDefined();
      expect(result.borrowerId).toBe(borrowerId);
      expect(result.principalAmount).toBe(createLoanApplicationDto.principalAmount);
      expect(result.status).toBe('Draft');
      expect(result.collateralInvoice).toBeDefined();
    });

    it('should handle creation errors gracefully', async () => {
      const borrowerId = 'user_54321';
      const createLoanApplicationDto: CreateLoanApplicationDto = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '5000.000000000000000000',
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: LiquidationMode.FULL,
      };

      // Mock repository method to throw error
      repository.borrowerCreatesLoanApplication.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        service.createLoanApplication(borrowerId, createLoanApplicationDto),
      ).rejects.toThrow();
    });
  });

  describe('getMyLoanApplications', () => {
    it("should return borrower's loan applications", async () => {
      const borrowerId = 'user_54321';
      const params = { page: 1, limit: 20 };

      const mockRepositoryResult = {
        loanApplications: [
          {
            id: 'app_1',
            principalCurrency: {
              blockchainKey: 'eip155:56',
              tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              symbol: 'USDC',
              name: 'USD Coin',
              decimals: 18,
            },
            principalAmount: '5000.000000000000000000',
            provisionAmount: '150.000000000000000000',
            maxInterestRate: 15.0,
            minLtvRatio: 50.0,
            maxLtvRatio: 70.0,
            termInMonths: 6,
            liquidationMode: LiquidationMode.FULL,
            collateralCurrency: {
              blockchainKey: 'eip155:1',
              tokenId: 'slip44:60',
              symbol: 'ETH',
              name: 'Ethereum',
              decimals: 18,
            },
            collateralDepositAmount: '2.500000000000000000',
            status: 'Published' as const,
            appliedDate: new Date('2025-09-15T10:30:00Z'),
            expirationDate: new Date('2025-09-22T10:30:00Z'),
            publishedDate: new Date('2025-09-15T11:00:00Z'),
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

      repository.borrowerViewsMyLoanApplications.mockResolvedValue(mockRepositoryResult);

      const result = await service.getMyLoanApplications(borrowerId, params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.applications).toBeDefined();
      expect(result.data.pagination).toBeDefined();
    });
  });

  describe('updateLoanApplication', () => {
    it('should cancel loan application successfully', async () => {
      const borrowerId = 'user_54321';
      const applicationId = 'app_12345';
      const updateLoanApplicationDto: UpdateLoanApplicationDto = {
        action: 'Cancel',
      };

      const mockRepositoryResult = {
        id: applicationId,
        status: 'Closed' as const,
        updatedDate: new Date('2025-09-15T12:00:00Z'),
        expirationDate: new Date('2025-09-22T10:30:00Z'),
        closureReason: 'Cancelled by borrower',
      };

      repository.borrowerUpdatesLoanApplication.mockResolvedValue(mockRepositoryResult);

      const result = await service.updateLoanApplication(
        borrowerId,
        applicationId,
        updateLoanApplicationDto,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(applicationId);
      expect(result.status).toBe('Closed');
    });

    it('should handle repository errors gracefully', async () => {
      const borrowerId = 'user_54321';
      const applicationId = 'app_nonexistent';
      const updateLoanApplicationDto: UpdateLoanApplicationDto = {
        action: 'Cancel',
      };

      repository.borrowerUpdatesLoanApplication.mockRejectedValueOnce(
        new Error('Application not found'),
      );

      await expect(
        service.updateLoanApplication(borrowerId, applicationId, updateLoanApplicationDto),
      ).rejects.toThrow('Application not found');
    });
  });
});
