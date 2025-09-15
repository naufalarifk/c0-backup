import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { LoanStatus, UserRole } from '../dto/common.dto';
import { EarlyLiquidationRequestDto, EarlyRepaymentRequestDto } from '../dto/loan-operations.dto';
import { LoansService } from './loans.service';

describe('LoansService', () => {
  let service: LoansService;
  let repository: jest.Mocked<CryptogadaiRepository>;

  beforeEach(async () => {
    const mockRepository = {
      userViewsLoans: jest.fn(),
      userViewsLoanDetails: jest.fn(),
      userViewsLoanValuationHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        {
          provide: CryptogadaiRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    repository = module.get(CryptogadaiRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listLoans', () => {
    it('should return paginated loans for user', async () => {
      const userId = 'user_12345';
      const params = {
        page: 1,
        limit: 20,
        role: UserRole.BORROWER,
        status: LoanStatus.ACTIVE,
      };

      const mockRepositoryResult = {
        loans: [
          {
            id: 'loan_1',
            loanOfferId: 'offer_1',
            loanApplicationId: 'app_1',
            borrowerUserId: userId,
            lenderUserId: 'user_67890',
            principalCurrency: {
              blockchainKey: 'eip155:56',
              tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              symbol: 'USDC',
              name: 'USD Coin',
              decimals: 18,
            },
            principalAmount: '5000.000000000000000000',
            interestAmount: '300.000000000000000000',
            repaymentAmount: '5300.000000000000000000',
            collateralCurrency: {
              blockchainKey: 'eip155:1',
              tokenId: 'slip44:60',
              symbol: 'ETH',
              name: 'Ethereum',
              decimals: 18,
            },
            collateralAmount: '2.500000000000000000',
            status: 'Active' as const,
            originationDate: new Date('2025-09-15T10:30:00Z'),
            disbursementDate: new Date('2025-09-15T11:00:00Z'),
            maturityDate: new Date('2026-03-15T11:00:00Z'),
            currentLtvRatio: 65.0,
            mcLtvRatio: 70.0,
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

      repository.userViewsLoans.mockResolvedValue(mockRepositoryResult);

      const result = await service.listLoans(userId, params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.loans).toBeDefined();
      expect(result.data.pagination).toBeDefined();
      expect(result.data.pagination.page).toBe(params.page);
      expect(result.data.pagination.limit).toBe(params.limit);
    });
  });

  describe('getLoanDetails', () => {
    it('should return detailed loan information', async () => {
      const loanId = 'loan_12345';
      const userId = 'user_12345';

      const mockRepositoryResult = {
        id: loanId,
        loanOfferId: 'offer_1',
        loanApplicationId: 'app_1',
        borrowerUserId: userId,
        lenderUserId: 'user_67890',
        principalCurrency: {
          blockchainKey: 'eip155:56',
          tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 18,
        },
        principalAmount: '5000.000000000000000000',
        interestAmount: '300.000000000000000000',
        repaymentAmount: '5300.000000000000000000',
        redeliveryFeeAmount: '50.000000000000000000',
        redeliveryAmount: '5350.000000000000000000',
        premiAmount: '25.000000000000000000',
        liquidationFeeAmount: '100.000000000000000000',
        minCollateralValuation: '2000.000000000000000000',
        collateralCurrency: {
          blockchainKey: 'eip155:1',
          tokenId: 'slip44:60',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
        },
        collateralAmount: '2.500000000000000000',
        status: 'Active' as const,
        originationDate: new Date('2025-09-15T10:30:00Z'),
        disbursementDate: new Date('2025-09-15T11:00:00Z'),
        maturityDate: new Date('2026-03-15T11:00:00Z'),
        currentLtvRatio: 65.0,
        mcLtvRatio: 70.0,
      };

      repository.userViewsLoanDetails.mockResolvedValue(mockRepositoryResult);

      const result = await service.getLoanDetails(userId, loanId);

      expect(result).toBeDefined();
      expect(result.id).toBe(loanId);
      expect(repository.userViewsLoanDetails).toHaveBeenCalledWith({
        loanId,
        userId,
      });
    });
  });

  describe('getLoanValuations', () => {
    it('should return loan valuation history', async () => {
      const loanId = 'loan_12345';
      const userId = 'user_12345';
      const _params = { limit: 10 };

      const mockRepositoryResult = {
        success: true,
        data: [
          {
            loanId,
            exchangeRateId: 'rate_1',
            valuationDate: new Date('2025-09-15T12:00:00Z'),
            ltvRatio: 65.0,
            collateralValuationAmount: '3250.000000000000000000',
            collateralCurrency: {
              blockchainKey: 'eip155:1',
              tokenId: 'slip44:60',
              symbol: 'ETH',
              name: 'Ethereum',
              decimals: 18,
            },
            principalCurrency: {
              blockchainKey: 'eip155:56',
              tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              symbol: 'USDC',
              name: 'USD Coin',
              decimals: 18,
            },
            ltvChange: -2.5,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      repository.userViewsLoanValuationHistory.mockResolvedValue(mockRepositoryResult);

      const result = await service.getLoanValuations(userId, loanId, { page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.valuations).toBeDefined();
      expect(result.data.pagination).toBeDefined();
      expect(result.data.pagination.page).toBe(1);
      expect(result.data.pagination.limit).toBe(10);
      expect(repository.userViewsLoanValuationHistory).toHaveBeenCalledWith({
        loanId,
        userId,
        limit: 10,
      });
    });
  });
  describe('calculateEarlyLiquidation', () => {
    it('should return early liquidation estimate', async () => {
      const loanId = 'loan_12345';
      const userId = 'user_12345';

      // Mock loan details for validation
      const mockLoanDetails = {
        id: loanId,
        loanOfferId: 'offer_1',
        loanApplicationId: 'app_1',
        borrowerUserId: userId,
        lenderUserId: 'user_67890',
        principalCurrency: {
          blockchainKey: 'eip155:56',
          tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 18,
        },
        principalAmount: '5000.000000000000000000',
        interestAmount: '300.000000000000000000',
        repaymentAmount: '5300.000000000000000000',
        redeliveryFeeAmount: '50.000000000000000000',
        redeliveryAmount: '5350.000000000000000000',
        premiAmount: '25.000000000000000000',
        liquidationFeeAmount: '100.000000000000000000',
        minCollateralValuation: '2000.000000000000000000',
        collateralCurrency: {
          blockchainKey: 'eip155:1',
          tokenId: 'slip44:60',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
        },
        collateralAmount: '2.500000000000000000',
        status: 'Active' as const,
        originationDate: new Date('2025-09-15T10:30:00Z'),
        disbursementDate: new Date('2025-09-15T11:00:00Z'),
        maturityDate: new Date('2026-03-15T11:00:00Z'),
        currentLtvRatio: 65.0,
        mcLtvRatio: 70.0,
      };

      repository.userViewsLoanDetails.mockResolvedValue(mockLoanDetails);

      const result = await service.calculateEarlyLiquidation(userId, loanId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.loanId).toBe(loanId);
      expect(result.data.calculationDate).toBeDefined();
      expect(result.data.currentCollateralValue).toBeDefined();
      expect(result.data.liquidationFee).toBeDefined();
      expect(result.data.estimatedProceeds).toBeDefined();
      expect(result.data.disclaimers).toBeDefined();
      expect(Array.isArray(result.data.disclaimers)).toBe(true);
      expect(repository.userViewsLoanDetails).toHaveBeenCalledWith({
        loanId,
        userId,
      });
    });
  });

  describe('requestEarlyLiquidation', () => {
    it('should submit early liquidation request successfully', async () => {
      const userId = 'user_12345';
      const loanId = 'loan_12345';
      const requestDto: EarlyLiquidationRequestDto = {
        acknowledgment: true,
      };

      // Mock loan details for validation
      const mockLoanDetails = {
        id: loanId,
        loanOfferId: 'offer_1',
        loanApplicationId: 'app_1',
        borrowerUserId: userId,
        lenderUserId: 'user_67890',
        principalCurrency: {
          blockchainKey: 'eip155:56',
          tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 18,
        },
        principalAmount: '5000.000000000000000000',
        interestAmount: '300.000000000000000000',
        repaymentAmount: '5300.000000000000000000',
        redeliveryFeeAmount: '50.000000000000000000',
        redeliveryAmount: '5350.000000000000000000',
        premiAmount: '25.000000000000000000',
        liquidationFeeAmount: '100.000000000000000000',
        minCollateralValuation: '2000.000000000000000000',
        collateralCurrency: {
          blockchainKey: 'eip155:1',
          tokenId: 'slip44:60',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
        },
        collateralAmount: '2.500000000000000000',
        status: 'Active' as const,
        originationDate: new Date('2025-09-15T10:30:00Z'),
        disbursementDate: new Date('2025-09-15T11:00:00Z'),
        maturityDate: new Date('2026-03-15T11:00:00Z'),
        currentLtvRatio: 65.0,
        mcLtvRatio: 70.0,
      };

      repository.userViewsLoanDetails.mockResolvedValue(mockLoanDetails);

      const result = await service.requestEarlyLiquidation(userId, loanId, requestDto);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.loanId).toBe(loanId);
      expect(result.data.liquidationId).toBeDefined();
      expect(result.data.status).toBe('Pending');
      expect(result.data.submittedDate).toBeDefined();
      expect(result.data.nextSteps).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should throw BadRequestException when acknowledgment is false', async () => {
      const userId = 'user_12345';
      const loanId = 'loan_12345';
      const requestDto: EarlyLiquidationRequestDto = {
        acknowledgment: false,
      };

      await expect(service.requestEarlyLiquidation(userId, loanId, requestDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('requestEarlyRepayment', () => {
    it('should submit early repayment request successfully', async () => {
      const userId = 'user_12345';
      const loanId = 'loan_12345';
      const requestDto: EarlyRepaymentRequestDto = {
        acknowledgment: true,
      };

      // Mock loan details for validation
      const mockLoanDetails = {
        id: loanId,
        loanOfferId: 'offer_1',
        loanApplicationId: 'app_1',
        borrowerUserId: userId,
        lenderUserId: 'user_67890',
        principalCurrency: {
          blockchainKey: 'eip155:56',
          tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 18,
        },
        principalAmount: '5000.000000000000000000',
        interestAmount: '300.000000000000000000',
        repaymentAmount: '5300.000000000000000000',
        redeliveryFeeAmount: '50.000000000000000000',
        redeliveryAmount: '5350.000000000000000000',
        premiAmount: '25.000000000000000000',
        liquidationFeeAmount: '100.000000000000000000',
        minCollateralValuation: '2000.000000000000000000',
        collateralCurrency: {
          blockchainKey: 'eip155:1',
          tokenId: 'slip44:60',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
        },
        collateralAmount: '2.500000000000000000',
        status: 'Active' as const,
        originationDate: new Date('2025-09-15T10:30:00Z'),
        disbursementDate: new Date('2025-09-15T11:00:00Z'),
        maturityDate: new Date('2026-03-15T11:00:00Z'),
        currentLtvRatio: 65.0,
        mcLtvRatio: 70.0,
      };

      repository.userViewsLoanDetails.mockResolvedValue(mockLoanDetails);

      const result = await service.requestEarlyRepayment(userId, loanId, requestDto);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.loanId).toBe(loanId);
      expect(result.data.repaymentId).toBeDefined();
      expect(result.data.status).toBe('Pending');
      expect(result.data.submittedDate).toBeDefined();
      expect(result.data.nextSteps).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should throw BadRequestException when acknowledgment is false', async () => {
      const userId = 'user_12345';
      const loanId = 'loan_12345';
      const requestDto: EarlyRepaymentRequestDto = {
        acknowledgment: false,
      };

      await expect(service.requestEarlyRepayment(userId, loanId, requestDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
