import { BadRequestException, Injectable } from '@nestjs/common';

import { signJWT } from 'better-auth/crypto';
import { jwtVerify } from 'jose';
import {
  JWSSignatureVerificationFailed,
  JWTClaimValidationFailed,
  JWTExpired,
  JWTInvalid,
} from 'jose/errors';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import {
  ensure,
  ensureExists,
  ensurePrecondition,
  ensureUnique,
  ResponseHelper,
} from '../../shared/utils';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { GetBeneficiariesDto } from './dto/get-beneficiaries.dto';
import { VerifyBeneficiaryDto } from './dto/verify-beneficiary.dto';

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
    private readonly configService: AppConfigService,
  ) {}

  /**
   * Initiates the beneficiary creation process with email verification
   * Does NOT store the beneficiary in database until email verification is complete
   *
   * @param userId - The ID of the user creating the beneficiary
   * @param createBeneficiaryDto - DTO containing beneficiary details
   * @returns Success message indicating verification email has been sent
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
    // Todo: Skip currency validation for now to allow any blockchain/address
    // await this.validateCurrencySupported(
    //   createBeneficiaryDto.blockchainKey,
    //   createBeneficiaryDto.tokenId,
    // );

    // Generate JWT verification token (6 hour expiry) with all data embedded
    const tokenPayload = {
      userId,
      address: createBeneficiaryDto.address,
      blockchain: createBeneficiaryDto.blockchainKey,
      label: createBeneficiaryDto.label, // Include label in JWT
    };

    const verificationToken = await this.generateBeneficiaryToken(tokenPayload);

    this.logger.log('Beneficiary verification initiated', {
      userId,
      address: createBeneficiaryDto.address,
      blockchain: createBeneficiaryDto.blockchainKey,
    });

    // Send verification email with token
    await this.sendVerificationEmail(userId, verificationToken, createBeneficiaryDto);

    // Return success without storing in database
    return ResponseHelper.success('Verification email sent', {
      message:
        'A verification email has been sent to your registered email address. Please click the link to confirm your withdrawal address.',
      address: createBeneficiaryDto.address,
      blockchain: createBeneficiaryDto.blockchainKey,
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
        beneficiary => beneficiary.blockchainKey === query.blockchainKey,
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
        beneficiary.blockchainKey === createBeneficiaryDto.blockchainKey &&
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
   * Verifies a beneficiary address using the email verification token
   * Creates the beneficiary record in database after successful verification
   *
   * @param verifyDto - DTO containing the verification token
   * @returns Created and activated beneficiary details
   * @throws Error if token is invalid, expired, or verification fails
   */
  async verify(verifyDto: VerifyBeneficiaryDto) {
    // Verify JWT token - all data is embedded in the token
    // This will throw specific errors (token_expired, invalid_token) if verification fails
    const tokenPayload = await this.verifyBeneficiaryToken(verifyDto.token);

    // tokenPayload will never be null here since errors are thrown above
    ensure(tokenPayload, 'Token verification failed');

    // Re-validate that address is still unique (in case it was added elsewhere)
    await this.validateUniqueAddress(tokenPayload.userId, {
      blockchainKey: tokenPayload.blockchain,
      address: tokenPayload.address,
    } as CreateBeneficiaryDto);

    // Create beneficiary in database (immediately active)
    const beneficiary = await this.repo.userRegistersWithdrawalBeneficiary({
      userId: tokenPayload.userId,
      blockchainKey: tokenPayload.blockchain,
      address: tokenPayload.address,
    });

    this.logger.log('Beneficiary verified and activated', {
      beneficiaryId: beneficiary.id,
      userId: tokenPayload.userId,
      address: tokenPayload.address,
    });

    return ResponseHelper.success('Beneficiary address activated', {
      id: beneficiary.id,
      blockchainKey: beneficiary.blockchainKey,
      address: beneficiary.address,
      label: tokenPayload.label,
      status: 'active',
      message: 'Your withdrawal address has been successfully verified and activated.',
    });
  }

  /**
   * Sends verification email with token link
   *
   * @param userId - User ID
   * @param token - Verification token
   * @param beneficiaryDto - Beneficiary details
   */
  private async sendVerificationEmail(
    userId: string,
    token: string,
    beneficiaryDto: CreateBeneficiaryDto,
  ): Promise<void> {
    try {
      // Get user details for email
      const user = await this.repo.betterAuthFindOneUser([{ field: 'id', value: userId }]);
      ensureExists(user, 'User not found');

      // Queue verification email notification
      await this.notificationQueueService.queueNotification({
        type: 'BeneficiaryVerification',
        userId,
        email: user.email,
        verificationToken: token,
        address: beneficiaryDto.address,
        blockchain: beneficiaryDto.blockchainKey,
        label: beneficiaryDto.label,
        message: `Please verify your withdrawal address: ${beneficiaryDto.address}`,
      });

      this.logger.log('Verification email queued', {
        userId,
        address: beneficiaryDto.address,
      });
    } catch (error) {
      this.logger.error('Failed to send verification email', error);
      throw new Error('Failed to send verification email. Please try again.');
    }
  }

  /**
   * Generates a JWT verification token for beneficiary data
   * @param payload - Data to encode in the JWT including optional label
   * @returns Signed JWT token with 6 hour expiry
   */
  private async generateBeneficiaryToken(payload: {
    userId: string;
    address: string;
    blockchain: string;
    label?: string;
  }): Promise<string> {
    return await signJWT(
      payload,
      this.configService.authConfig.secret,
      6 * 60 * 60, // 6 hours
    );
  }

  /**
   * Verifies a JWT beneficiary token and returns the payload
   * @param token - JWT token to verify
   * @returns Decoded payload or null if invalid/expired
   * @throws Error with specific message for different error types
   */
  private async verifyBeneficiaryToken(token: string): Promise<{
    userId: string;
    address: string;
    blockchain: string;
    label?: string;
  } | null> {
    try {
      const result = await jwtVerify(
        token,
        new TextEncoder().encode(this.configService.authConfig.secret),
        { algorithms: ['HS256'] },
      );

      // Extract payload from JWTVerifyResult
      return result.payload as {
        userId: string;
        address: string;
        blockchain: string;
        label?: string;
      };
    } catch (error) {
      const tokenPreview = token.slice(0, 20) + '...';

      // Handle specific JWT errors comprehensively with proper HTTP status
      if (error instanceof JWTExpired) {
        this.logger.warn('JWT token has expired', { token: tokenPreview });
        throw new BadRequestException({
          error: 'token_expired',
          message: 'Verification token has expired. Please request a new verification email.',
        });
      }

      if (error instanceof JWSSignatureVerificationFailed) {
        this.logger.warn('JWT signature verification failed - possible tampering', {
          token: tokenPreview,
        });
        throw new BadRequestException({
          error: 'signature_invalid',
          message: 'Invalid verification token signature. Please request a new verification email.',
        });
      }

      if (error instanceof JWTClaimValidationFailed) {
        this.logger.warn('JWT claim validation failed', {
          token: tokenPreview,
          claim: error.claim,
          reason: error.reason,
        });
        throw new BadRequestException({
          error: 'claim_invalid',
          message:
            'Verification token contains invalid claims. Please request a new verification email.',
        });
      }

      if (error instanceof JWTInvalid) {
        this.logger.warn('JWT token is invalid', {
          token: tokenPreview,
          reason: error.message,
        });
        throw new BadRequestException({
          error: 'invalid_token',
          message: 'Invalid verification token format. Please request a new verification email.',
        });
      }

      // Catch-all for any other JWT-related errors
      this.logger.error('Unknown JWT verification error', {
        error: error.message,
        name: error.constructor.name,
        token: tokenPreview,
      });
      throw new BadRequestException({
        error: 'verification_failed',
        message: 'Token verification failed. Please request a new verification email.',
      });
    }
  }
}
