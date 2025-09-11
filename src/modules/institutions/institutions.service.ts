import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { FileValidatorService } from '../../shared/services/file-validator.service';
import { MinioService } from '../../shared/services/minio.service';
import { ResponseHelper } from '../../shared/utils/response.helper';
import { TelemetryLogger } from '../../telemetry.logger';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { CreateInstitutionInviteDto } from './dto/create-institution-invite.dto';

@Injectable()
export class InstitutionsService {
  private readonly logger = new TelemetryLogger(InstitutionsService.name);

  constructor(
    private readonly userRepo: CryptogadaiRepository,
    private readonly minioService: MinioService,
    private readonly fileValidatorService: FileValidatorService,
  ) {}

  async apply(userId: string, createInstitutionDto: CreateInstitutionDto) {
    const payload = {
      ...createInstitutionDto,
      applicantUserId: userId,
      applicationDate: new Date(),
    };

    const result = await this.userRepo.userAppliesForInstitution(payload);

    return ResponseHelper.created('Institution application', {
      applicationId: result.id,
      status: 'pending_review',
      submissionDate: payload.applicationDate,
      businessName: createInstitutionDto.businessName,
    });
  }

  invite(userId: string, createInstitutionInviteDto: CreateInstitutionInviteDto) {
    const payload = {
      ...createInstitutionInviteDto,
      inviterUserId: userId,
      invitationDate: new Date(),
    };
    return this.userRepo.ownerUserInvitesUserToInstitution(payload);
  }

  async acceptInvite(userId: string, inviteId: string) {
    const payload = {
      invitationId: inviteId,
      userId: userId,
      acceptanceDate: new Date(),
    };
    const result = await this.userRepo.userAcceptsInstitutionInvitation(payload);

    return ResponseHelper.action('Invitation acceptance', {
      invitationId: inviteId,
      institutionId: result.institutionId,
      acceptedAt: result.acceptedDate,
      status: 'accepted',
    });
  }

  async rejectInvite(userId: string, inviteId: string, reason?: string) {
    const payload = {
      invitationId: inviteId,
      userId: userId,
      rejectionReason: reason,
      rejectionDate: new Date(),
    };
    const result = await this.userRepo.userRejectsInstitutionInvitation(payload);

    return ResponseHelper.action('Invitation rejection', {
      invitationId: inviteId,
      rejectedAt: result.rejectedDate,
      status: 'rejected',
      reason: reason,
    });
  }

  /**
   * Upload institution document file to Minio (images only, no PDF for security)
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    userId: string,
    documentType: string,
    mimeType?: string,
  ): Promise<{ objectPath: string; bucket: string; size: number }> {
    // Validate file - only images allowed (no PDF for security)
    this.fileValidatorService.validateImageFile(fileBuffer, 2, mimeType, originalName);

    const folder = `institutions/${userId}`;
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

    this.logger.log(`Institution file uploaded successfully: ${filePath}`, {
      userId,
      documentType,
      fileName,
      size: uploadResult.size,
      objectPath: uploadResult.objectName,
      bucket: uploadResult.bucket,
    });

    return {
      objectPath: uploadResult.objectName,
      bucket: uploadResult.bucket,
      size: uploadResult.size,
    };
  }
}
