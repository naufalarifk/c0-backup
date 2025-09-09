import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../telemetry.logger';
import { CreateKycDto } from './dto/create-kyc.dto';
import { UpdateKycDto } from './dto/update-kyc.dto';

@Injectable()
export class KycService {
  private readonly logger = new TelemetryLogger(KycService.name);

  constructor(private readonly userRepo: CryptogadaiRepository) {}

  getKycByUserId(userId: string) {
    // Return KYC status that matches KycStatusResponseDto format
    return this.userRepo.userViewsKYCStatus({ userId });
  }

  async createKyc(userId: string, createKycDto: CreateKycDto) {
    // 1. Get current user KYC status to enforce security policies
    const kycStatus = await this.userRepo.userViewsKYCStatus({ userId });

    // 2. Security check: Prevent duplicate or unauthorized submissions
    // Check by status instead of id (since new users won't have id)
    if (kycStatus.status && kycStatus.status !== 'none') {
      switch (kycStatus.status) {
        case 'pending':
          // Block: KYC is pending verification
          throw new ConflictException(
            'KYC submission is already pending review. Please wait for verification.',
          );
        case 'verified':
          // Block: KYC is already approved
          throw new ConflictException('KYC is already verified. No need for resubmission.');
        case 'rejected':
          // Allow: User can resubmit after rejection (only if canResubmit is true)
          if (!kycStatus.canResubmit) {
            throw new ConflictException('KYC resubmission is not allowed at this time.');
          }
          this.logger.warn(`User ${userId} resubmitting KYC after previous rejection`, {
            userId,
            previousStatus: 'rejected',
            canResubmit: kycStatus.canResubmit,
          });
          break;
        default:
          // Block: Unknown status or other active submission
          throw new ConflictException(
            `User has KYC status: ${kycStatus.status}. Cannot submit new KYC.`,
          );
      }
    } else if (kycStatus.status === 'none') {
      // Log first-time KYC submission
      this.logger.log(`First-time KYC submission for user: ${userId}`, {
        userId,
        status: 'none',
        canResubmit: kycStatus.canResubmit,
      });
    }

    // 3. Validate and sanitize input data before processing
    this.validateKycData(createKycDto);

    // 4. Log security audit trail for KYC submission attempt
    this.logger.log(`KYC submission attempt for user: ${userId}`, {
      userId,
      timestamp: new Date().toISOString(),
      action: 'kyc_submission',
    });

    // 5. Prepare KYC data with server-side metadata and submit to repository
    const kycData = {
      ...createKycDto,
      userId,
      submissionDate: new Date(), // Server-generated timestamp, not exposed in API contract
    };

    const res = await this.userRepo.userSubmitsKyc(kycData);

    // 6. Log successful KYC submission for audit purposes
    this.logger.log(`KYC submitted successfully for user: ${userId}`, {
      userId,
      kycId: res.id,
      timestamp: new Date().toISOString(),
      action: 'kyc_submitted',
    });

    // 7. Return response in expected DTO format
    return {
      id: res.id,
      userId: res.userId,
      fullName: createKycDto.fullName,
      nik: createKycDto.nik,
      submissionDate: kycData.submissionDate,
      status: 'pending' as const,
    };
  }

  updateKyc(userId: string, updateKycDto: UpdateKycDto) {
    // Logic untuk update KYC - currently not implemented
    return Promise.resolve({
      userId,
      ...updateKycDto,
      updatedAt: new Date(),
    });
  }

  verifyKyc(userId: string) {
    // Logic untuk verifikasi KYC - currently not implemented
    return Promise.resolve({
      userId,
      status: 'verified',
      verifiedAt: new Date(),
    });
  }

  rejectKyc(userId: string, reason: string) {
    // Logic untuk reject KYC - currently not implemented
    return Promise.resolve({
      userId,
      status: 'rejected',
      reason,
      rejectedAt: new Date(),
    });
  }

  getDocuments(userId: string) {
    // Logic untuk mendapatkan dokumen KYC - currently not implemented
    return Promise.resolve({
      userId,
      documents: [],
    });
  }

  uploadDocument(userId: string, documentData: Record<string, unknown>) {
    // Logic untuk upload dokumen - currently not implemented
    return Promise.resolve({
      userId,
      documentId: 'doc_123',
      uploadedAt: new Date(),
    });
  }

  /**
   * Validates KYC data for security and business rules
   */
  private validateKycData(data: CreateKycDto): void {
    // Validate NIK (Indonesian National ID)
    if (!this.validateNik(data.nik)) {
      throw new BadRequestException('Invalid NIK format. Must be 16 digits.');
    }

    // Validate phone number
    if (!this.validatePhoneNumber(data.phoneNumber)) {
      throw new BadRequestException('Invalid phone number format.');
    }

    // Validate postal code
    if (!this.validatePostalCode(data.postalCode)) {
      throw new BadRequestException('Invalid postal code format.');
    }

    // Validate birth date
    if (!this.validateBirthDate(data.birthDate)) {
      throw new BadRequestException('Invalid birth date. Must be in the past and reasonable age.');
    }

    // Validate photo URLs (files already validated by KycFileService)
    this.validatePhotoUrls(data.idCardPhoto, 'ID Card Photo');
    this.validatePhotoUrls(data.selfieWithIdCardPhoto, 'Selfie with ID Card Photo');

    // Validate name format
    if (!this.validateName(data.fullName)) {
      throw new BadRequestException('Invalid name format.');
    }
  }

  private validateNik(nik: string): boolean {
    // NIK must be exactly 16 digits
    const nikRegex = /^\d{16}$/;
    return nikRegex.test(nik);
  }

  private validatePhoneNumber(phone: string): boolean {
    // Indonesian phone number format: +62 or 0, followed by 8-13 digits
    const phoneRegex = /^(\+62|62|0)[8-9]\d{7,11}$/;
    return phoneRegex.test(phone.replace(/\s|-/g, ''));
  }

  private validatePostalCode(postalCode: string): boolean {
    // Indonesian postal code: 5 digits
    const postalRegex = /^\d{5}$/;
    return postalRegex.test(postalCode);
  }

  private validateBirthDate(birthDate: Date): boolean {
    const date = new Date(birthDate);
    const now = new Date();
    const minAge = 17; // Minimum age for KYC
    const maxAge = 120; // Maximum reasonable age

    // Check if date is valid
    if (isNaN(date.getTime())) return false;

    // Check if date is not in the future
    if (date > now) return false;

    // Check age range
    const age = now.getFullYear() - date.getFullYear();
    return age >= minAge && age <= maxAge;
  }

  private validateName(name: string): boolean {
    // Name should contain only letters, spaces, and common punctuation
    // Minimum 2 characters, maximum 100 characters
    const nameRegex = /^[a-zA-Z\s.'-]{2,100}$/;
    return nameRegex.test(name.trim());
  }

  /**
   * Validate photo URLs (simplified - files already validated by KycFileService)
   */
  private validatePhotoUrls(photoUrl: string, photoType: string): void {
    if (!photoUrl) {
      throw new BadRequestException(`${photoType} is required.`);
    }

    // Simple URL validation since files are already processed by KycFileService
    try {
      new URL(photoUrl);
    } catch {
      throw new BadRequestException(`Invalid ${photoType} URL format.`);
    }
  }
}
