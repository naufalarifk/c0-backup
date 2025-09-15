import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { FileValidatorService } from '../../../shared/services/file-validator.service';
import { MinioService } from '../../../shared/services/minio.service';
import { File } from '../../../shared/types';
import { ensure, ensureUnique, ResponseHelper } from '../../../shared/utils';
import { TelemetryLogger } from '../../../telemetry.logger';
import { CreateKycDto, SubmitKycDto } from './dto/create-kyc.dto';

@Injectable()
export class KycService {
  private readonly logger = new TelemetryLogger(KycService.name);

  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly minioService: MinioService,
    private readonly fileValidatorService: FileValidatorService,
  ) {}

  getKyc(userId: string) {
    return this.repo.userViewsKYCStatus({ userId });
  }

  /**
   * Submit KYC with required file uploads
   */
  async createKyc(
    userId: string,
    kycData: SubmitKycDto,
    files: {
      idCardPhoto: File[];
      selfieWithIdCardPhoto: File[];
    },
  ) {
    // Validate required files
    const validatedFiles = this.validateFiles(files);

    // Upload files in parallel
    const [idCardResult, selfieWithIdResult] = await Promise.all([
      this.uploadFile(
        validatedFiles.idCardPhoto.buffer,
        validatedFiles.idCardPhoto.originalname,
        userId,
        'id-card',
        validatedFiles.idCardPhoto.mimetype,
      ),
      this.uploadFile(
        validatedFiles.selfieWithIdCardPhoto.buffer,
        validatedFiles.selfieWithIdCardPhoto.originalname,
        userId,
        'selfie-with-id-card',
        validatedFiles.selfieWithIdCardPhoto.mimetype,
      ),
    ]);

    // Create KYC data with file paths
    const createKycDto: CreateKycDto = {
      ...kycData,
      idCardPhoto: `${idCardResult.bucket}:${idCardResult.objectPath}`,
      selfieWithIdCardPhoto: `${selfieWithIdResult.bucket}:${selfieWithIdResult.objectPath}`,
    };

    return this.submitKyc(userId, createKycDto);
  }

  /**
   * Internal method for KYC submission logic
   */
  private async submitKyc(userId: string, createKycDto: CreateKycDto) {
    // 1. Get current user KYC status to enforce security policies
    const userKyc = await this.repo.userViewsKYCStatus({ userId });

    // 2. Security check: Prevent duplicate or unauthorized submissions
    if (userKyc.id && userKyc.submittedDate) {
      ensureUnique(
        userKyc.status !== 'pending',
        'KYC submission is already pending review. Please wait for verification.',
      );

      ensureUnique(
        userKyc.status !== 'verified',
        'KYC is already verified. No need for resubmission.',
      );

      ensureUnique(
        userKyc.status !== 'rejected' || userKyc.canResubmit,
        'KYC resubmission is not allowed at this time. Please contact support.',
      );

      // Log resubmission attempt for rejected KYC (only reached if canResubmit is true)
      if (userKyc.status === 'rejected' && userKyc.canResubmit) {
        this.logger.log(`KYC resubmission after rejection`, { userId, kycId: userKyc.id });
      }
    } else if (userKyc.status === 'none') {
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

    const res = await this.repo.userSubmitsKyc(kycData);

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
   * Validate that all required KYC files are present
   */
  private validateFiles(files: { idCardPhoto: File[]; selfieWithIdCardPhoto: File[] }) {
    ensure(files?.idCardPhoto?.[0], 'ID Card Photo is required');
    ensure(files?.selfieWithIdCardPhoto?.[0], 'Selfie with ID Card Photo is required');

    return {
      idCardPhoto: files.idCardPhoto[0],
      selfieWithIdCardPhoto: files.selfieWithIdCardPhoto[0],
    };
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
    // Validate file before upload using shared validator (2MB for KYC documents)
    this.fileValidatorService.validateDocumentFile(fileBuffer, 2, mimeType, originalName);

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
