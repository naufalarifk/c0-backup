import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { UserRegistersWithdrawalBeneficiaryResult } from '../../shared/repositories/finance.types';
import {
  ensure,
  ensureExists,
  ensurePrecondition,
  ensureUnique,
  ResponseHelper,
} from '../../shared/utils';
import { TelemetryLogger } from '../../telemetry.logger';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { GetBeneficiariesDto } from './dto/get-beneficiaries.dto';

/**
 * Service responsible for managing withdrawal beneficiaries (addresses)
 * Handles creation, validation, and retrieval of beneficiary addresses for cryptocurrency withdrawals
 */
@Injectable()
export class BeneficiariesService {
  private readonly logger = new TelemetryLogger(BeneficiariesService.name);

  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  /**
   * Creates a new withdrawal beneficiary address for a user
   *
   * @param userId - The ID of the user creating the beneficiary
   * @param createBeneficiaryDto - DTO containing beneficiary details
   * @returns Created beneficiary with pending confirmation status
   * @throws Error if user doesn't meet requirements or validation fails
   */
  async create(userId: string, createBeneficiaryDto: CreateBeneficiaryDto) {
    // Verify user has completed KYC
    const { status: kycStatus } = await this.repo.userViewsKYCStatus({ userId });
    ensurePrecondition(
      kycStatus === 'verified',
      'KYC must be verified before adding a withdrawal address',
    );

    // Validate the withdrawal address is not blacklisted or suspicious
    await this.validateAddressNotBlacklisted(createBeneficiaryDto.address);

    // Ensure the address hasn't been registered for this user and currency combination
    await this.validateUniqueAddress(userId, createBeneficiaryDto);

    // Verify the currency is supported and withdrawals are enabled
    await this.validateCurrencySupported(
      createBeneficiaryDto.blockchainKey,
      createBeneficiaryDto.tokenId,
    );

    // Register the beneficiary in the database
    const beneficiary = await this.repo.userRegistersWithdrawalBeneficiary({
      userId,
      currencyBlockchainKey: createBeneficiaryDto.blockchainKey,
      currencyTokenId: createBeneficiaryDto.tokenId,
      address: createBeneficiaryDto.address,
    });

    this.logger.log(`Beneficiary created successfully`, {
      beneficiaryId: beneficiary.id,
      userId,
      address: createBeneficiaryDto.address,
    });

    // Queue email notification for beneficiary confirmation
    await this.sendEmailConfirmation(userId, beneficiary, createBeneficiaryDto.label);

    // Return the created beneficiary with pending status
    // Note: Email confirmation and activation are handled by separate endpoints
    return ResponseHelper.created('Beneficiary', {
      id: beneficiary.id,
      blockchainKey: beneficiary.currencyBlockchainKey,
      tokenId: beneficiary.currencyTokenId,
      address: beneficiary.address,
      label: createBeneficiaryDto.label,
      status: 'pending',
      message: 'Beneficiary created successfully. Please check your email to confirm the address.',
    });
  }

  /**
   * Retrieves all beneficiaries for a user with optional filtering
   *
   * @param userId - The ID of the user whose beneficiaries to retrieve
   * @param query - Optional filters for blockchain key and token ID
   * @returns List of beneficiaries matching the criteria
   */
  async findAll(userId: string, query?: GetBeneficiariesDto) {
    const result = await this.repo.userViewsWithdrawalBeneficiaries({ userId });

    // Apply optional filters to the retrieved beneficiaries
    let filteredBeneficiaries = result.beneficiaries;

    if (query?.blockchainKey) {
      filteredBeneficiaries = filteredBeneficiaries.filter(
        beneficiary => beneficiary.currencyBlockchainKey === query.blockchainKey,
      );
    }

    if (query?.tokenId) {
      filteredBeneficiaries = filteredBeneficiaries.filter(
        beneficiary => beneficiary.currencyTokenId === query.tokenId,
      );
    }

    return ResponseHelper.success('Beneficiaries retrieved successfully', {
      beneficiaries: filteredBeneficiaries,
    });
  }

  /**
   * Validates that the provided address is not blacklisted or suspicious
   * Checks against known problematic patterns and addresses
   *
   * @param address - The blockchain address to validate
   * @throws Error if the address is blacklisted or suspicious
   *
   * @todo Implement integration with external blacklist APIs (Chainalysis, TRM Labs)
   */
  private async validateAddressNotBlacklisted(address: string): Promise<void> {
    // Check against known problematic address patterns
    const suspiciousPatterns = [
      /^0x0+$/i, // Ethereum zero address
      /^0x000000000000000000000000000000000000dead$/i, // Ethereum burn address
      /^1111111111111111111111111111111$/i, // Solana burn address
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(address));
    ensure(!isSuspicious, 'Address appears to be invalid or blacklisted');

    // Todo: Integrate with external compliance and risk assessment services
    // - Chainalysis API for sanctions screening
    // - TRM Labs for wallet risk scoring
    // - Internal blacklist database check
  }

  /**
   * Ensures the address hasn't been already registered for this user and currency
   * Prevents duplicate beneficiary entries
   *
   * @param userId - The user ID to check against
   * @param createBeneficiaryDto - DTO containing the address and currency details
   * @throws Error if a duplicate address is found
   */
  private async validateUniqueAddress(
    userId: string,
    createBeneficiaryDto: CreateBeneficiaryDto,
  ): Promise<void> {
    const existingBeneficiaries = await this.repo.userViewsWithdrawalBeneficiaries({ userId });

    const duplicate = existingBeneficiaries.beneficiaries.find(
      beneficiary =>
        beneficiary.currencyBlockchainKey === createBeneficiaryDto.blockchainKey &&
        beneficiary.currencyTokenId === createBeneficiaryDto.tokenId &&
        beneficiary.address.toLowerCase() === createBeneficiaryDto.address.toLowerCase(),
    );

    ensureUnique(
      !duplicate,
      'This withdrawal address has already been registered for this currency',
    );
  }

  /**
   * Validates that the specified currency is supported and allows withdrawals
   *
   * @param blockchainKey - The blockchain identifier (e.g., 'ethereum', 'bitcoin')
   * @param tokenId - The token identifier on the blockchain
   * @throws Error if currency is not supported or withdrawals are disabled
   */
  private async validateCurrencySupported(blockchainKey: string, tokenId: string): Promise<void> {
    const { currencies } = await this.repo.userViewsCurrencies({ type: 'all' });

    console.log(currencies);

    const currency = currencies.find(
      c => c.blockchainKey === blockchainKey && c.tokenId === tokenId,
    );

    ensureExists(currency, `Currency ${blockchainKey}:${tokenId} is not supported`);

    // Verify withdrawals are enabled by checking minimum withdrawal amount
    ensure(
      currency.minWithdrawalAmount !== null && currency.minWithdrawalAmount !== '0',
      `Withdrawals are not currently supported for ${currency.symbol}`,
    );
  }

  /**
   * Sends an email confirmation request for the new beneficiary address
   * Queues a notification to be processed asynchronously
   *
   * @param userId - The user ID who created the beneficiary
   * @param beneficiary - The created beneficiary result
   * @param label - User-friendly label for the address
   *
   * @todo Implement proper user email retrieval from repository
   * @todo Create dedicated BeneficiaryConfirmation notification type
   */
  private async sendEmailConfirmation(
    userId: string,
    beneficiary: UserRegistersWithdrawalBeneficiaryResult,
    label: string,
  ): Promise<void> {
    try {
      // Future: Retrieve user email from user service/repository
      // const user = await this.repo.findUserById(userId);
      // ensureExists(user, 'User not found');

      // Queue notification for asynchronous processing
      await this.notificationQueueService.queueNotification({
        type: 'WithdrawalRequested', // Should be 'BeneficiaryConfirmation' when implemented
        userId,
        beneficiaryId: beneficiary.id,
        address: beneficiary.address,
        label,
        message: `Please confirm your withdrawal address: ${beneficiary.address}`,
      });

      this.logger.log(`Email confirmation queued for beneficiary ${beneficiary.id}`);
    } catch (error) {
      // Log error but don't fail the beneficiary creation
      // Email can be resent through a separate endpoint if needed
      this.logger.error(
        `Failed to queue email confirmation for beneficiary ${beneficiary.id}`,
        error,
      );
    }
  }
}
