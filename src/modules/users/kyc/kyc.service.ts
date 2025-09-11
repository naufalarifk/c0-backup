import { ConflictException, Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { FileValidatorService } from '../../../shared/services/file-validator.service';
import { MinioService } from '../../../shared/services/minio.service';
import { ResponseHelper } from '../../../shared/utils';
import { TelemetryLogger } from '../../../telemetry.logger';
import { CreateKycDto } from './dto/create-kyc.dto';

@Injectable()
export class KycService {
  private readonly logger = new TelemetryLogger(KycService.name);

  constructor(
    private readonly userRepo: CryptogadaiRepository,
    private readonly minioService: MinioService,
    private readonly fileValidatorService: FileValidatorService,
  ) {}

  getKyc(userId: string) {
    return this.userRepo.userViewsKYCStatus({ userId });
  }

  async createKyc(userId: string, createKycDto: CreateKycDto) {
    // 1. Get current user KYC status to enforce security policies
    const kycStatus = await this.userRepo.userViewsKYCStatus({ userId });

    // 2. Security check: Prevent duplicate or unauthorized submissions
    if (kycStatus.id && kycStatus.submittedDate) {
      switch (kycStatus.status) {
        case 'pending':
          throw new ConflictException(
            'KYC submission is already pending review. Please wait for verification.',
          );
        case 'verified':
          throw new ConflictException('KYC is already verified. No need for resubmission.');
        case 'rejected':
          if (!kycStatus.canResubmit) {
            throw new ConflictException(
              'KYC resubmission is not allowed at this time. Please contact support.',
            );
          }
          this.logger.log(`KYC resubmission after rejection`, { userId, kycId: kycStatus.id });
          break;
      }
    } else if (kycStatus.status === 'none') {
      this.logger.log(`First-time KYC submission`, { userId });
    }

    // 3. Log KYC submission attempt (validation already handled by DTO)
    this.logger.log(`KYC submission attempt`, { userId, action: 'kyc_submission' });

    // 4. Prepare KYC data with server-side metadata and submit to repository
    const kycData = {
      ...createKycDto,
      userId,
      submissionDate: new Date(), // Server-generated timestamp, not exposed in API contract
    };

    const res = await this.userRepo.userSubmitsKyc(kycData);

    // 5. Log successful submission
    this.logger.log(`KYC submitted successfully`, { userId, kycId: res.id });

    // 6. Return response using ResponseHelper
    return ResponseHelper.created('KYC', {
      id: res.id,
      status: 'pending' as const,
      submissionDate: kycData.submissionDate,
    });
  }

  /**
   * Upload a single KYC file to Minio and return the object info (NOT URL)
   * Moved from KycFileService for better cohesion
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    userId: string,
    documentType: string,
    mimeType?: string,
  ): Promise<{ objectPath: string; bucket: string; size: number }> {
    // Validate file before upload using shared validator (10MB for KYC documents)
    this.fileValidatorService.validateDocumentFile(fileBuffer, 10, mimeType, originalName);

    const folder = `kyc/${userId}`;
    const sanitizedFileName = this.fileValidatorService.sanitizeFileName(originalName);
    const fileName = `${documentType}-${Date.now()}-${sanitizedFileName}`;
    const filePath = `${folder}/${fileName}`;

    const uploadResult = await this.minioService.uploadFile(fileBuffer, originalName, {
      bucketName: 'documents',
      objectName: filePath,
      metaData: {
        userId,
        documentType,
        originalName: sanitizedFileName,
        uploadedAt: new Date().toISOString(),
        contentType: mimeType || 'application/octet-stream',
        fileSize: fileBuffer.length.toString(),
      },
    });

    this.logger.log(`KYC file uploaded successfully: ${filePath}`, {
      userId,
      documentType,
      fileName,
      size: uploadResult.size,
      objectPath: uploadResult.objectName,
      bucket: uploadResult.bucket,
    });

    return {
      objectPath: uploadResult.objectName, // Use actual objectName from upload result
      bucket: uploadResult.bucket, // Use actual bucket from upload result
      size: uploadResult.size,
    };
  }
}
