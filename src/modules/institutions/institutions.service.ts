import { ConflictException, Injectable } from '@nestjs/common';

import { assertPropNullableStringOrNumber } from 'test/setup/assertions.js';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { FileValidatorService } from '../../shared/services/file-validator.service';
import { MinioService } from '../../shared/services/minio.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { File } from '../../shared/types';
import {
  assertArrayOf,
  assertDefined,
  assertPropNullableDate,
  assertPropNullableString,
  assertPropString,
  assertPropStringOrNumber,
  ensure,
  ensureExists,
  ensurePermission,
  ensurePrecondition,
  setAssertPropValue,
} from '../../shared/utils';
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
    const inviterUser = await this.repo.userViewsProfile({ userId });
    ensurePrecondition(inviterUser.emailVerified, 'Email verification required');
    ensurePermission(
      inviterUser.institutionRole === 'Owner',
      'Only institution owners can send invitations',
    );

    // Get the institution ID from the inviter's profile
    const institutionId = inviterUser.institutionUserId;
    ensureExists(institutionId, 'User is not associated with an institution');

    // Find target user by email
    const targetUsers = await this.repo.sql`
      SELECT id, email, name, user_type, institution_user_id, email_verified_date
      FROM users
      WHERE email = ${createInstitutionInviteDto.userEmail}
    `;

    if (targetUsers.length === 0) {
      const error = new Error('User with email not found');
      setAssertPropValue(error, 'code', 'USER_NOT_FOUND');
      throw error;
    }

    assertArrayOf(targetUsers, function (item) {
      assertDefined(item);
      assertPropStringOrNumber(item, 'id');
      assertPropString(item, 'email');
      assertPropString(item, 'name');
      assertPropString(item, 'user_type');
      assertPropNullableStringOrNumber(item, 'institution_user_id');
      assertPropNullableDate(item, 'email_verified_date');
      return item;
    });

    const targetUser = targetUsers[0];

    // Check if user is already a member of ANY institution (check this first)
    if (targetUser.institution_user_id) {
      if (targetUser.institution_user_id === institutionId) {
        const error = new Error('User is already institution member');
        setAssertPropValue(error, 'code', 'USER_ALREADY_MEMBER');
        setAssertPropValue(error, 'details', { userEmail: createInstitutionInviteDto.userEmail });
        throw error;
      } else {
        const error = new Error('User is already institution member');
        setAssertPropValue(error, 'code', 'USER_ALREADY_MEMBER');
        throw error;
      }
    }

    // Target must be Individual user (check this after membership check)
    if (targetUser.user_type !== 'Individual') {
      const error = new Error('Can only invite Individual users');
      setAssertPropValue(error, 'code', 'USER_INVALID_TYPE');
      throw error;
    }

    // Check for pending invitations to this specific institution
    const hasPendingInvitation = await this.checkPendingInvitation(
      String(targetUser.id),
      institutionId,
    );
    ensure(!hasPendingInvitation, 'User already has a pending invitation to this institution');

    // Create the invitation
    const invitationData = {
      institutionId: userId, // This should be the inviting user's ID, not the institution ID
      userId: String(targetUser.id),
      role: createInstitutionInviteDto.role,
      invitationDate: new Date(),
    };

    // Store message in invitation record if provided
    const result = await this.repo.ownerUserInvitesUserToInstitution(invitationData);

    return {
      invitation: {
        id: result.id,
        userEmail: createInstitutionInviteDto.userEmail,
        role: createInstitutionInviteDto.role,
        invitedDate: invitationData.invitationDate.toISOString(),
      },
    };
  }

  async acceptInvite(userId: string, inviteId: string) {
    // Get invitation details first to validate
    const invitation = await this.getInvitationById(inviteId);
    ensureExists(invitation, 'Invitation not found');

    // Verify this invitation is for this user
    const targetUser = await this.repo.userViewsProfile({ userId });
    const invitationTargetUsers = await this.repo.sql`
      SELECT target_user_id FROM institution_invitations
      WHERE id = ${inviteId} AND target_user_id = ${userId}
    `;
    ensure(invitationTargetUsers.length > 0, 'Invitation not found');

    const payload = {
      invitationId: inviteId,
      userId: userId,
      acceptanceDate: new Date(),
    };
    const result = await this.repo.userAcceptsInstitutionInvitation(payload);

    // Get institution details for response
    const institutionDetails = await this.getInstitutionDetailsById(result.institutionId);

    return {
      institution: {
        id: Number(result.institutionId),
        businessName: institutionDetails?.name || `Institution ${result.institutionId}`,
        role: invitation.role,
      },
      message: 'You have successfully joined the institution',
    };
  }

  async rejectInvite(userId: string, inviteId: string, reason?: string) {
    // Verify this invitation exists and is for this user
    const invitationTargetUsers = await this.repo.sql`
      SELECT target_user_id FROM institution_invitations
      WHERE id = ${inviteId} AND target_user_id = ${userId}
    `;
    ensureExists(
      invitationTargetUsers.length > 0 ? invitationTargetUsers[0] : null,
      'Invitation not found',
    );

    const payload = {
      invitationId: inviteId,
      userId: userId,
      rejectionReason: reason,
      rejectionDate: new Date(),
    };
    const result = await this.repo.userRejectsInstitutionInvitation(payload);

    return {
      message: 'Invitation rejected successfully',
    };
  }

  /**
   * List pending invitations for an institution
   */
  async listInstitutionInvitations(institutionId: string, requestingUserId: string) {
    // Verify that the requesting user has access to this institution
    const user = await this.repo.userViewsProfile({ userId: requestingUserId });
    ensureExists(user, 'User not found');

    // Check if the institution exists
    const institutionExists = await this.checkInstitutionExists(institutionId);
    ensureExists(institutionExists ? {} : null, 'Institution not found');

    // Check if user is a member of this institution and is an owner
    ensurePermission(
      user.institutionUserId === institutionId,
      'You are not a member of this institution',
    );
    ensurePermission(
      user.institutionRole === 'Owner',
      'Only institution owners can view invitations',
    );

    // Get pending invitations for this institution
    const invitations = await this.repo.sql`
      SELECT
        ii.id,
        ii.role,
        ii.invited_date,
        ii.expires_date,
        ii.status,
        u.email as user_email,
        inviter.id as inviter_id,
        inviter.name as inviter_name
      FROM institution_invitations ii
      JOIN users u ON ii.target_user_id = u.id
      LEFT JOIN users inviter ON ii.institution_user_id = inviter.id AND inviter.institution_role = 'Owner'
      WHERE ii.institution_user_id = ${institutionId}
        AND ii.status IN ('Sent')
        AND ii.accepted_date IS NULL
        AND ii.rejected_date IS NULL
      ORDER BY ii.invited_date DESC;
    `;

    assertArrayOf(invitations, function (item) {
      assertDefined(item);
      assertPropStringOrNumber(item, 'id');
      assertPropString(item, 'role');
      assertPropNullableDate(item, 'invited_date');
      assertPropNullableDate(item, 'expires_date');
      assertPropString(item, 'status');
      assertPropString(item, 'user_email');
      assertPropNullableStringOrNumber(item, 'inviter_id');
      assertPropNullableString(item, 'inviter_name');
      return item;
    });

    const formattedInvitations = invitations.map(function (inv) {
      return {
        id: Number(inv.id),
        userEmail: inv.user_email,
        role: inv.role,
        invitedDate: inv.invited_date?.toISOString() || new Date().toISOString(),
        expiresAt:
          inv.expires_date?.toISOString() ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now if not set
        status: inv.status || 'Sent',
        ...(inv.inviter_id
          ? {
              invitedBy: {
                id: Number(inv.inviter_id),
                name: inv.inviter_name,
              },
            }
          : {}),
      };
    });

    return {
      invitations: formattedInvitations,
    };
  }

  /**
   * Resend an invitation
   */
  async resendInvitation(invitationId: string, requestingUserId: string) {
    // Get invitation details
    const invitationRows = await this.repo.sql`
      SELECT
        ii.id,
        ii.institution_user_id,
        ii.target_user_id,
        ii.role,
        ii.status,
        ii.accepted_date,
        ii.rejected_date,
        u.email as user_email
      FROM institution_invitations ii
      JOIN users u ON ii.target_user_id = u.id
      WHERE ii.id = ${invitationId}
    `;

    ensureExists(invitationRows.length > 0 ? invitationRows[0] : null, 'Invitation not found');

    assertArrayOf(invitationRows, function (item) {
      assertDefined(item);
      assertPropStringOrNumber(item, 'id');
      assertPropStringOrNumber(item, 'institution_user_id');
      assertPropStringOrNumber(item, 'target_user_id');
      assertPropString(item, 'role');
      assertPropString(item, 'status');
      assertPropNullableDate(item, 'accepted_date');
      assertPropNullableDate(item, 'rejected_date');
      assertPropString(item, 'user_email');
      return item;
    });

    const invitation = invitationRows[0];

    // Check if invitation has already been responded to first (before permission checks)
    if (invitation.accepted_date || invitation.rejected_date) {
      const error = new Error(
        'Cannot resend invitation that has already been accepted or rejected',
      );
      setAssertPropValue(error, 'code', 'INVITATION_ALREADY_RESPONDED');
      throw error;
    }

    // Verify requesting user is owner of the institution
    const requestingUser = await this.repo.userViewsProfile({ userId: requestingUserId });
    ensurePermission(
      requestingUser.institutionUserId === invitation.institution_user_id,
      'You are not a member of this institution',
    );
    ensurePermission(
      requestingUser.institutionRole === 'Owner',
      'Only institution owners can resend invitations',
    );

    // Update invitation date (simulates resending)
    await this.repo.sql`
      UPDATE institution_invitations
      SET invited_date = NOW(), status = 'Sent'
      WHERE id = ${invitationId}
    `;

    return {
      invitation: {
        id: Number(invitation.id),
        userEmail: invitation.user_email,
        role: invitation.role,
        invitedDate: new Date().toISOString(),
      },
      message: 'Invitation resent successfully',
    };
  }

  /**
   * Get invitation details by ID
   */
  async getInvitationDetails(invitationId: string, requestingUserId: string) {
    const invitationRows = await this.repo.sql`
      SELECT
        ii.id,
        ii.institution_user_id,
        ii.target_user_id,
        ii.role,
        ii.invited_date,
        ii.expires_date,
        ii.status,
        u.email as user_email,
        inviter.id as inviter_id,
        inviter.name as inviter_name,
        inviter.institution_user_id,
        inviter.name as institution_name
      FROM institution_invitations ii
      JOIN users u ON ii.target_user_id = u.id
      LEFT JOIN users inviter ON inviter.institution_user_id = ii.institution_user_id AND inviter.institution_role = 'Owner'
      WHERE ii.id = ${invitationId}
    `;

    ensureExists(invitationRows.length > 0 ? invitationRows[0] : null, 'Invitation not found');

    assertArrayOf(invitationRows, function (item) {
      assertDefined(item);
      assertPropStringOrNumber(item, 'id');
      assertPropNullableStringOrNumber(item, 'institution_user_id');
      assertPropStringOrNumber(item, 'target_user_id');
      assertPropString(item, 'role');
      assertPropNullableDate(item, 'invited_date');
      assertPropNullableDate(item, 'expires_date');
      assertPropString(item, 'status');
      assertPropString(item, 'user_email');
      assertPropNullableStringOrNumber(item, 'inviter_id');
      assertPropNullableString(item, 'inviter_name');
      assertPropNullableStringOrNumber(item, 'institution_user_id');
      assertPropNullableString(item, 'institution_name');
      return item;
    });

    const invitation = invitationRows[0];

    // Verify requesting user is the target of the invitation
    ensure(
      String(invitation.target_user_id) === requestingUserId,
      'You can only view invitations sent to you',
    );

    const result = {
      invitation: {
        id: String(invitation.id),
        userEmail: invitation.user_email,
        role: invitation.role,
        invitedDate: invitation.invited_date?.toISOString() || new Date().toISOString(),
        expiresAt:
          invitation.expires_date?.toISOString() ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        institution: null as unknown,
        rolePermissions: [] as string[],
        roleRestrictions: [] as string[],
        invitedBy: null as unknown,
      },
    };

    // Add institution details if available
    if (invitation.institution_user_id) {
      result.invitation.institution = {
        id: Number(invitation.institution_user_id),
        name: invitation.institution_name || `Institution ${invitation.institution_user_id}`,
        type: 'Business', // Default type
        verificationStatus: 'Unverified', // Default status
      };
    }

    // Add role permissions/restrictions (placeholder)
    result.invitation.rolePermissions = [];
    result.invitation.roleRestrictions = [];

    // Add inviter details if available
    if (invitation.inviter_id) {
      result.invitation.invitedBy = {
        id: Number(invitation.inviter_id),
        name: invitation.inviter_name,
      };
    }

    return result;
  }

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitationId: string, requestingUserId: string) {
    // First verify requesting user has appropriate permissions
    const requestingUser = await this.repo.userViewsProfile({ userId: requestingUserId });

    // Check if user is an institution owner (basic permission check)
    ensurePermission(
      requestingUser.institutionRole === 'Owner',
      'Insufficient permissions - only institution owners can cancel invitations',
    );

    // Get invitation details
    const invitationRows = await this.repo.sql`
      SELECT
        ii.id,
        ii.institution_user_id,
        ii.target_user_id,
        ii.status,
        ii.accepted_date,
        ii.rejected_date,
        u.email as user_email
      FROM institution_invitations ii
      JOIN users u ON ii.target_user_id = u.id
      WHERE ii.id = ${invitationId}
    `;

    ensureExists(invitationRows.length > 0 ? invitationRows[0] : null, 'Invitation not found');

    assertArrayOf(invitationRows, function (item) {
      assertDefined(item);
      assertPropStringOrNumber(item, 'id');
      assertPropStringOrNumber(item, 'institution_user_id');
      assertPropStringOrNumber(item, 'target_user_id');
      assertPropString(item, 'status');
      assertPropNullableDate(item, 'accepted_date');
      assertPropNullableDate(item, 'rejected_date');
      assertPropString(item, 'user_email');
      return item;
    });

    const invitation = invitationRows[0];

    // Check if invitation has already been responded to
    if (invitation.accepted_date || invitation.rejected_date) {
      const error = new Error(
        'Cannot cancel invitation that has already been accepted or rejected',
      );
      setAssertPropValue(error, 'code', 'INVITATION_ALREADY_RESPONDED');
      throw error;
    }

    // Verify requesting user is owner of the same institution as the invitation
    ensurePermission(
      requestingUser.institutionUserId === invitation.institution_user_id,
      'You are not a member of this institution',
    );

    // Delete the invitation (or mark as cancelled)
    await this.repo.sql`
      DELETE FROM institution_invitations
      WHERE id = ${invitationId}
    `;

    return {
      message: 'Invitation cancelled successfully',
    };
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
   * Get institution details by ID
   */
  async getInstitutionDetails(institutionId: string, requestingUserId: string) {
    // Verify that the requesting user has access to this institution
    const user = await this.repo.userViewsProfile({ userId: requestingUserId });
    ensureExists(user, 'User not found');

    // Check if the institution exists by checking if any users belong to it
    const institutionExists = await this.checkInstitutionExists(institutionId);
    ensureExists(institutionExists ? {} : null, 'Institution not found');

    // Check if user is a member of this institution
    ensurePermission(
      user.institutionUserId === institutionId,
      'You are not a member of this institution',
    );

    // For now, we'll construct institution details from the user data
    // In a full implementation, this would query an institutions table
    const memberCount = await this.getInstitutionMemberCount(institutionId);

    return {
      institution: {
        id: Number(institutionId),
        name: user.businessName || `Institution ${institutionId}`,
        type: user.businessType || 'Business',
        verificationStatus: user.kycStatus === 'verified' ? 'Verified' : 'Unverified',
        memberCount,
        activeSince: user.createdAt?.toISOString() || new Date().toISOString(),
        registrationDetails: user.businessName
          ? {
              businessType: user.businessType || 'Unknown',
            }
          : undefined,
      },
    };
  }

  /**
   * Get institution members
   */
  async getInstitutionMembers(institutionId: string, requestingUserId: string) {
    // Verify that the requesting user has access to this institution
    const user = await this.repo.userViewsProfile({ userId: requestingUserId });
    ensureExists(user, 'User not found');

    // Check if the institution exists
    const institutionExists = await this.checkInstitutionExists(institutionId);
    ensureExists(institutionExists ? {} : null, 'Institution not found');

    // Check if user is a member of this institution
    ensurePermission(
      user.institutionUserId === institutionId,
      'You are not a member of this institution',
    );

    // Get all members of this institution
    const members = await this.repo.sql`
      SELECT
        u.id as user_id,
        u.name,
        u.email,
        u.profile_picture as profile_picture_url,
        u.institution_user_id,
        u.institution_role,
        u.created_date as joined_at
      FROM users u
      WHERE u.institution_user_id = ${institutionId}
      ORDER BY u.created_date ASC;
    `;

    const memberCount = members.length;

    const formattedMembers = members.map(function (member: unknown, index) {
      assertDefined(member);
      assertPropStringOrNumber(member, 'user_id');
      assertPropString(member, 'name');
      assertPropString(member, 'email');
      assertPropString(member, 'institution_role');
      assertPropNullableDate(member, 'joined_at');
      assertPropNullableString(member, 'profile_picture_url');
      assertPropStringOrNumber(member, 'institution_user_id');
      return {
        id: String(index + 1), // Simple ID for now
        userId: Number(member.user_id),
        institutionId: Number(institutionId),
        role: member.institution_role,
        verificationStatus: 'Unverified', // TODO: Add KYC status check
        joinedAt: member.joined_at?.toISOString() || new Date().toISOString(),
        invitedBy: null, // TODO: Add invited_by when invitation system is complete
        user: {
          id: Number(member.user_id),
          name: member.name,
          email: member.email,
          profilePictureUrl: member.profile_picture_url,
        },
      };
    });

    return {
      members: formattedMembers,
      memberCount,
    };
  }

  /**
   * Remove a member from the institution
   */
  async removeInstitutionMember(institutionId: string, memberId: string, requestingUserId: string) {
    // Verify that the requesting user has access to this institution
    const requestingUser = await this.repo.userViewsProfile({ userId: requestingUserId });
    ensureExists(requestingUser, 'User not found');

    // Check if the institution exists
    const institutionExists = await this.checkInstitutionExists(institutionId);
    ensureExists(institutionExists ? {} : null, 'Institution not found');

    // Check if requesting user is a member and is an owner
    ensurePermission(
      requestingUser.institutionUserId === institutionId,
      'You are not a member of this institution',
    );
    ensurePermission(
      requestingUser.institutionRole === 'Owner',
      'Only institution owners can remove members',
    );

    // Get the member to be removed
    let memberToRemove;
    try {
      memberToRemove = await this.repo.userViewsProfile({ userId: memberId });
    } catch (error) {
      // If user doesn't exist at all, treat as member not found
      ensureExists(null, 'Member not found');
    }
    ensureExists(memberToRemove, 'Member not found');

    // Check if the member is part of this institution
    ensure(
      memberToRemove.institutionUserId === institutionId,
      'User is not a member of this institution',
    );

    // Check if trying to remove the owner (not allowed)
    if (memberToRemove.institutionRole === 'Owner') {
      const error = new Error('Institution owner cannot be removed from the institution');
      setAssertPropValue(error, 'code', 'CANNOT_REMOVE_OWNER');
      throw error;
    }

    // Remove the member from the institution
    await this.repo.sql`
      UPDATE users
      SET institution_user_id = NULL, institution_role = NULL
      WHERE id = ${memberId};
    `;

    return {
      message: 'Member removed successfully',
      removedMember: {
        id: Number(memberId),
        name: memberToRemove.name,
        email: memberToRemove.email,
      },
    };
  }

  /**
   * Check if an institution exists by checking if any users belong to it
   */
  private async checkInstitutionExists(institutionId: string): Promise<boolean> {
    try {
      const result = await this.repo.sql`
        SELECT COUNT(*) as count
        FROM users
        WHERE institution_user_id = ${institutionId}
      `;

      const count = result[0] as { count: string | number };
      return Number(count.count) > 0;
    } catch (error) {
      this.logger.error('Error checking institution existence', {
        institutionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get the member count for an institution
   */
  private async getInstitutionMemberCount(institutionId: string): Promise<number> {
    try {
      const result = await this.repo.sql`
        SELECT COUNT(*) as count
        FROM users
        WHERE institution_user_id = ${institutionId}
      `;

      const count = result[0] as { count: string | number };
      return Number(count.count);
    } catch (error) {
      this.logger.error('Error getting institution member count', {
        institutionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
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
          AND status IN ('pending', 'Sent')
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

  /**
   * Get invitation by ID (helper method)
   */
  private async getInvitationById(invitationId: string) {
    try {
      const invitations = await this.repo.sql`
        SELECT
          ii.id,
          ii.institution_user_id,
          ii.target_user_id,
          ii.role,
          ii.status,
          ii.accepted_date,
          ii.rejected_date,
          u.email as user_email
        FROM institution_invitations ii
        JOIN users u ON ii.target_user_id = u.id
        WHERE ii.id = ${invitationId}
      `;

      assertArrayOf(invitations, function (item) {
        assertDefined(item);
        assertPropStringOrNumber(item, 'id');
        assertPropNullableStringOrNumber(item, 'institution_user_id');
        assertPropStringOrNumber(item, 'target_user_id');
        assertPropString(item, 'role');
        assertPropString(item, 'status');
        assertPropNullableDate(item, 'accepted_date');
        assertPropNullableDate(item, 'rejected_date');
        assertPropString(item, 'user_email');
        return item;
      });

      return invitations.length > 0 ? invitations[0] : null;
    } catch (error) {
      this.logger.error('Error getting invitation by ID', {
        invitationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get institution details by ID (helper method)
   */
  private async getInstitutionDetailsById(institutionId: string) {
    try {
      const institutions = await this.repo.sql`
        SELECT
          u.name,
          u.business_name
        FROM users u
        WHERE u.institution_user_id = ${institutionId}
          AND u.institution_role = 'Owner'
        LIMIT 1
      `;

      if (institutions.length > 0) {
        assertArrayOf(institutions, function (item) {
          assertDefined(item);
          assertPropNullableString(item, 'name');
          assertPropNullableString(item, 'business_name');
          return item;
        });

        const inst = institutions[0];
        return {
          name: inst.business_name || inst.name || `Institution ${institutionId}`,
        };
      }

      return { name: `Institution ${institutionId}` };
    } catch (error) {
      this.logger.error('Error getting institution details', {
        institutionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { name: `Institution ${institutionId}` };
    }
  }
}
