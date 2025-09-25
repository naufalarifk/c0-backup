import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { FileValidatorService } from '../../shared/services/file-validator.service';
import { MinioService } from '../../shared/services/minio.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { File } from '../../shared/types';
import { ensure, ensureExists, ensurePrecondition } from '../../shared/utils';
import { ResponseHelper } from '../../shared/utils/response.helper';
import { CreateInstitutionDto, SubmitCreateInstitutionDto } from './dto/create-institution.dto';
import { CreateInstitutionInviteDto } from './dto/create-institution-invite.dto';

@Injectable()
export class InstitutionsService {
  private readonly logger = new TelemetryLogger(InstitutionsService.name);

  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly minioService: MinioService,
    private readonly fileValidatorService: FileValidatorService,
  ) {}

  /**
   * Apply for institution registration with required file uploads
   */
  async apply(
    userId: string,
    createInstitutionDto: SubmitCreateInstitutionDto,
    files: {
      npwpDocument: File[];
      registrationDocument: File[];
      deedOfEstablishment: File[];
      directorIdCard: File[];
      ministryApprovalDocument: File[];
    },
  ) {
    // Process file uploads (required)
    const fileUploadResults = await this.processInstitutionFiles(userId, files);

    // Create institution data with file paths
    const institutionData: CreateInstitutionDto = {
      ...createInstitutionDto,
      ...fileUploadResults,
    };

    // Submit application
    const payload = {
      ...institutionData,
      applicantUserId: userId,
      applicationDate: new Date(),
    };

    const result = await this.repo.userAppliesForInstitution(payload);

    return {
      message: 'Institution application created successfully',
      application: {
        id: result.id,
        businessName: institutionData.businessName,
        submittedDate: payload.applicationDate,
        status: 'Submitted',
      },
    };
  }

  /**
   * Process and upload all institution files
   */
  private async processInstitutionFiles(
    userId: string,
    files: {
      npwpDocument: File[];
      registrationDocument: File[];
      deedOfEstablishment: File[];
      directorIdCard: File[];
      ministryApprovalDocument: File[];
    },
  ): Promise<{
    npwpDocumentPath: string;
    registrationDocumentPath: string;
    deedOfEstablishmentPath: string;
    directorIdCardPath: string;
    ministryApprovalDocumentPath: string;
  }> {
    // Validate required files
    const validatedFiles = this.validateInstitutionFiles(files);

    // Upload files in parallel
    const [npwpResult, registrationResult, deedResult, directorIdResult, ministryResult] =
      await Promise.all([
        this.uploadFile(
          validatedFiles.npwpDocument.buffer,
          validatedFiles.npwpDocument.originalname,
          userId,
          'npwp-document',
          validatedFiles.npwpDocument.mimetype,
        ),
        this.uploadFile(
          validatedFiles.registrationDocument.buffer,
          validatedFiles.registrationDocument.originalname,
          userId,
          'registration-document',
          validatedFiles.registrationDocument.mimetype,
        ),
        this.uploadFile(
          validatedFiles.deedOfEstablishment.buffer,
          validatedFiles.deedOfEstablishment.originalname,
          userId,
          'deed-of-establishment',
          validatedFiles.deedOfEstablishment.mimetype,
        ),
        this.uploadFile(
          validatedFiles.directorIdCard.buffer,
          validatedFiles.directorIdCard.originalname,
          userId,
          'director-id-card',
          validatedFiles.directorIdCard.mimetype,
        ),
        this.uploadFile(
          validatedFiles.ministryApprovalDocument.buffer,
          validatedFiles.ministryApprovalDocument.originalname,
          userId,
          'ministry-approval-document',
          validatedFiles.ministryApprovalDocument.mimetype,
        ),
      ]);

    return {
      npwpDocumentPath: `${npwpResult.bucket}:${npwpResult.objectPath}`,
      registrationDocumentPath: `${registrationResult.bucket}:${registrationResult.objectPath}`,
      deedOfEstablishmentPath: `${deedResult.bucket}:${deedResult.objectPath}`,
      directorIdCardPath: `${directorIdResult.bucket}:${directorIdResult.objectPath}`,
      ministryApprovalDocumentPath: `${ministryResult.bucket}:${ministryResult.objectPath}`,
    };
  }

  /**
   * Validate that all required institution files are present
   */
  private validateInstitutionFiles(files: {
    npwpDocument: File[];
    registrationDocument: File[];
    deedOfEstablishment: File[];
    directorIdCard: File[];
    ministryApprovalDocument: File[];
  }) {
    ensure(files?.npwpDocument?.[0], 'NPWP document is required');
    ensure(files?.registrationDocument?.[0], 'Registration document is required');
    ensure(files?.deedOfEstablishment?.[0], 'Deed of establishment document is required');
    ensure(files?.directorIdCard?.[0], 'Director ID card is required');
    ensure(files?.ministryApprovalDocument?.[0], 'Ministry approval document is required');

    return {
      npwpDocument: files.npwpDocument[0],
      registrationDocument: files.registrationDocument[0],
      deedOfEstablishment: files.deedOfEstablishment[0],
      directorIdCard: files.directorIdCard[0],
      ministryApprovalDocument: files.ministryApprovalDocument[0],
    };
  }

  async invite(userId: string, createInstitutionInviteDto: CreateInstitutionInviteDto) {
    const userInstitution = await this.repo.userViewsProfile({ userId });
    ensurePrecondition(userInstitution.emailVerified, 'Email verification required');
    ensurePrecondition(userInstitution.kycStatus === 'verified', 'KYC verification required');

    const targetUser = await this.repo.userViewsProfile({
      userId: createInstitutionInviteDto.userId,
    });

    // Ensure target user exists
    ensureExists(targetUser, 'User not found');

    // Check if target user has verified KYC (only if not already institution member)
    ensure(targetUser.kycStatus === 'verified', 'Can only invite users with verified KYC');

    // Target must be Individual user
    ensure(targetUser.userType === 'Individual', 'Can only invite Individual users');

    // Check if user is already a member of ANY institution (from targetUser data)
    ensure(!targetUser.institutionUserId, 'User is already a member of an institution');

    // Check for pending invitations to this specific institution
    const hasPendingInvitation = await this.checkPendingInvitation(
      createInstitutionInviteDto.userId,
      createInstitutionInviteDto.institutionId,
    );
    ensure(!hasPendingInvitation, 'User already has a pending invitation to this institution');

    const payload = {
      ...createInstitutionInviteDto,
      inviterUserId: userId,
      invitationDate: new Date(),
    };
    return this.repo.ownerUserInvitesUserToInstitution(payload);
  }

  async acceptInvite(userId: string, inviteId: string) {
    const payload = {
      invitationId: inviteId,
      userId: userId,
      acceptanceDate: new Date(),
    };
    const result = await this.repo.userAcceptsInstitutionInvitation(payload);

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
    const result = await this.repo.userRejectsInstitutionInvitation(payload);

    return ResponseHelper.action('Invitation rejection', {
      invitationId: inviteId,
      rejectedAt: result.rejectedDate,
      status: 'rejected',
      reason: reason,
    });
  }

  /**
   * Get institution application status for a user
   */
  async getApplicationStatus(userId: string) {
    // Get user's institution application
    const application = await this.repo.userViewsInstitutionApplicationStatus({ userId });

    if (!application || !application.id) {
      throw new Error('Institution application not found');
    }

    // Calculate progress based on status
    const progress = this.calculateApplicationProgress(application.status);

    // Calculate document status
    const documents = {
      uploaded: 5, // All required documents are uploaded when application is created
      required: 5,
      status: 'complete' as const,
    };

    return {
      application: {
        id: application.id,
        businessName: application.businessName,
        submittedDate: application.submittedDate,
        status: application.status,
      },
      progress,
      documents,
    };
  }

  /**
   * Calculate application progress based on status
   */
  private calculateApplicationProgress(status: string) {
    const totalSteps = 3;
    let currentStep: number;
    let completedSteps: number[];
    let nextAction: string;

    switch (status) {
      case 'Submitted':
        currentStep = 1;
        completedSteps = [1];
        nextAction = 'Wait for review';
        break;
      case 'UnderReview':
        currentStep = 2;
        completedSteps = [1, 2];
        nextAction = 'Under review by admin';
        break;
      case 'Verified':
        currentStep = 3;
        completedSteps = [1, 2, 3];
        nextAction = 'Application completed';
        break;
      case 'Rejected':
        currentStep = 3;
        completedSteps = [1, 2];
        nextAction = 'Application rejected';
        break;
      default:
        currentStep = 1;
        completedSteps = [];
        nextAction = 'Submit application';
    }

    return {
      currentStep,
      totalSteps,
      completedSteps,
      nextAction,
    };
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

  /**
   * Check if user has pending invitation to specific institution
   */
  private async checkPendingInvitation(userId: string, institutionId: string): Promise<boolean> {
    try {
      // Check for pending invitations to this specific institution
      const pendingInvitation = await this.repo.sql`
        SELECT id
        FROM institution_invitations
        WHERE institution_user_id = ${institutionId}
          AND target_user_id = ${userId}
          AND status = 'pending'
          AND accepted_date IS NULL
          AND rejected_date IS NULL
      `;

      return pendingInvitation.length > 0;
    } catch (error) {
      this.logger.error('Error checking pending invitation', {
        userId,
        institutionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // On error, be conservative and allow the invitation
      return false;
    }
  }
}
