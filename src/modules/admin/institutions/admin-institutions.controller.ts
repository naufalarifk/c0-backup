import type { UserSession } from '../../auth/types';

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { MinioService } from '../../../shared/services/minio.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import {
  assertArrayOf,
  assertDefined,
  assertPropNullableString,
  assertPropString,
  assertPropStringOrNumber,
  validationOptions,
} from '../../../shared/utils';
import { Session } from '../../auth/auth.decorator';

@Controller('admin/institutions')
@ApiTags('Admin - Institutions')
@Auth(['Admin'])
export class AdminInstitutionsController {
  private readonly logger = new TelemetryLogger(AdminInstitutionsController.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly repo: CryptogadaiRepository,
  ) {}

  @Get('applications')
  @ApiOperation({
    summary: 'Get pending institution applications',
    description:
      'Retrieve pending institution applications for admin review with pagination and filtering',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 10 })
  @ApiQuery({ name: 'search', required: false, description: 'Search by business name' })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort by field',
    example: 'businessName',
  })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order', example: 'asc' })
  @ApiResponse({
    status: 200,
    description: 'Institution applications retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        applications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              businessName: { type: 'string' },
              submittedDate: { type: 'string', format: 'date-time' },
              timeInQueue: { type: 'string' },
              priority: { type: 'string', enum: ['normal', 'high', 'urgent'] },
              applicantInfo: {
                type: 'object',
                properties: {
                  userId: { type: 'number' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  kycStatus: { type: 'string', enum: ['none', 'pending', 'verified', 'rejected'] },
                },
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
          },
        },
      },
    },
  })
  async getInstitutionApplications(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    try {
      // Query pending institution applications directly
      const rows = await this.repo.sql`
        SELECT
          ia.id,
          ia.business_name,
          ia.submitted_date,
          ia.applicant_user_id,
          u.name as applicant_name,
          u.email as applicant_email,
          COALESCE(uk.status, 'none') as kyc_status
        FROM institution_applications ia
        JOIN users u ON ia.applicant_user_id = u.id
        LEFT JOIN user_kycs uk ON u.id = uk.user_id AND uk.status = 'Verified'
        WHERE ia.status = 'Submitted'
        ORDER BY ia.submitted_date DESC
      `;

      const applications = rows.map(app => {
        assertDefined(app);
        assertPropStringOrNumber(app, 'id');
        assertPropString(app, 'business_name');
        // submitted_date should be a string or Date - let's assert it exists first
        if (
          !('submitted_date' in app) ||
          app.submitted_date === null ||
          app.submitted_date === undefined
        ) {
          throw new Error('submitted_date property is missing or null');
        }
        if (typeof app.submitted_date !== 'string' && !(app.submitted_date instanceof Date)) {
          throw new Error(
            `Expected submitted_date to be string or Date, got ${typeof app.submitted_date}`,
          );
        }
        assertPropStringOrNumber(app, 'applicant_user_id');
        assertPropNullableString(app, 'applicant_name');
        assertPropNullableString(app, 'applicant_email');
        assertPropString(app, 'kyc_status');
        const submittedDate =
          app.submitted_date instanceof Date
            ? app.submitted_date
            : new Date(app.submitted_date as string);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60));

        let timeInQueue: string;
        if (diffHours < 1) {
          timeInQueue = 'Less than 1 hour';
        } else if (diffHours < 24) {
          timeInQueue = `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          timeInQueue = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
        }

        return {
          id: Number(app.id),
          businessName: app.business_name,
          submittedDate: submittedDate.toISOString(),
          timeInQueue,
          priority: 'normal' as const,
          applicantInfo: {
            userId: Number(app.applicant_user_id),
            name: app.applicant_name || 'N/A',
            email: app.applicant_email || 'N/A',
            kycStatus: app.kyc_status === 'Verified' ? 'verified' : 'none',
          },
        };
      });

      // Filter by search if provided
      let filteredApplications = applications;
      if (search) {
        filteredApplications = applications.filter(app =>
          app.businessName.toLowerCase().includes(search.toLowerCase()),
        );
      }

      // Simple pagination
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 50;
      const total = filteredApplications.length;

      return {
        applications: filteredApplications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get institution applications', { error: error.message });
      throw error;
    }
  }

  @Get('applications/:id')
  @ApiOperation({
    summary: 'Get detailed institution application',
    description: 'Retrieve detailed institution application for admin review',
  })
  @ApiParam({ name: 'id', description: 'Institution application ID' })
  @ApiResponse({
    status: 200,
    description: 'Institution application details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        businessName: { type: 'string' },
        submittedDate: { type: 'string', format: 'date-time' },
        applicantUser: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            name: { type: 'string' },
            kycStatus: { type: 'string', enum: ['none', 'pending', 'verified', 'rejected'] },
          },
        },
        businessDocuments: {
          type: 'object',
          properties: {
            incorporationCertificateUrl: { type: 'string' },
            taxRegistrationUrl: { type: 'string' },
            businessLicenseUrl: { type: 'string' },
          },
        },
        dueDiligenceChecklist: {
          type: 'object',
          properties: {
            kycVerified: { type: 'boolean' },
            businessDocumentsValid: { type: 'boolean' },
            regulatoryCompliance: { type: 'boolean' },
            riskAssessmentComplete: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Institution application not found' })
  async getInstitutionApplicationDetails(@Param('id') applicationId: string) {
    try {
      // Get application details from database
      const rows = await this.repo.sql`
        SELECT
          ia.id,
          ia.business_name,
          ia.submitted_date,
          ia.applicant_user_id,
          ia.npwp_document_path,
          ia.registration_document_path,
          ia.deed_of_establishment_path,
          ia.director_id_card_path,
          ia.ministry_approval_document_path,
          u.email,
          u.name as user_name,
          COALESCE(uk.status, 'none') as kyc_status
        FROM institution_applications ia
        JOIN users u ON ia.applicant_user_id = u.id
        LEFT JOIN user_kycs uk ON u.id = uk.user_id AND uk.status = 'Verified'
        WHERE ia.id = ${applicationId}
      `;

      if (rows.length === 0) {
        throw new NotFoundException('Institution application not found');
      }

      assertArrayOf(rows, function (row) {
        assertDefined(row);
        assertPropStringOrNumber(row, 'id');
        assertPropString(row, 'business_name');
        // submitted_date should be a string or Date - let's assert it exists first
        if (
          !('submitted_date' in row) ||
          row.submitted_date === null ||
          row.submitted_date === undefined
        ) {
          throw new Error('submitted_date property is missing or null');
        }
        if (typeof row.submitted_date !== 'string' && !(row.submitted_date instanceof Date)) {
          throw new Error(
            `Expected submitted_date to be string or Date, got ${typeof row.submitted_date}`,
          );
        }
        assertPropStringOrNumber(row, 'applicant_user_id');
        assertPropNullableString(row, 'npwp_document_path');
        assertPropNullableString(row, 'registration_document_path');
        assertPropNullableString(row, 'deed_of_establishment_path');
        assertPropNullableString(row, 'director_id_card_path');
        assertPropNullableString(row, 'ministry_approval_document_path');
        assertPropString(row, 'email');
        assertPropNullableString(row, 'user_name');
        assertPropString(row, 'kyc_status');
        return row;
      });

      const app = rows[0];

      // Generate signed URLs for documents
      let incorporationCertificateUrl = '';
      let taxRegistrationUrl = '';
      let businessLicenseUrl = '';

      if (app.registration_document_path) {
        const [bucket, objectPath] = app.registration_document_path.split(':');
        if (bucket && objectPath) {
          incorporationCertificateUrl = await this.minioService.getFileUrl(
            bucket,
            objectPath,
            15 * 60,
          );
        }
      }

      if (app.npwp_document_path) {
        const [bucket, objectPath] = app.npwp_document_path.split(':');
        if (bucket && objectPath) {
          taxRegistrationUrl = await this.minioService.getFileUrl(bucket, objectPath, 15 * 60);
        }
      }

      if (app.deed_of_establishment_path) {
        const [bucket, objectPath] = app.deed_of_establishment_path.split(':');
        if (bucket && objectPath) {
          businessLicenseUrl = await this.minioService.getFileUrl(bucket, objectPath, 15 * 60);
        }
      }

      return {
        id: Number(app.id),
        businessName: app.business_name,
        submittedDate: (app.submitted_date instanceof Date
          ? app.submitted_date
          : new Date(app.submitted_date as string)
        ).toISOString(),
        applicantUser: {
          id: Number(app.applicant_user_id),
          email: app.email,
          name: app.user_name,
          kycStatus: app.kyc_status === 'Verified' ? 'verified' : 'none',
        },
        businessDocuments: {
          incorporationCertificateUrl,
          taxRegistrationUrl,
          businessLicenseUrl,
        },
        dueDiligenceChecklist: {
          kycVerified: app.kyc_status === 'Verified',
          businessDocumentsValid: Boolean(app.npwp_document_path && app.registration_document_path),
          regulatoryCompliance: true,
          riskAssessmentComplete: false,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get institution application details', {
        error: error.message,
        applicationId,
      });
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve institution application details');
    }
  }

  @Put('applications/:id/approve')
  @ApiOperation({
    summary: 'Approve institution application',
    description: 'Approve an institution application after manual review',
  })
  @ApiParam({ name: 'id', description: 'Institution application ID' })
  @ApiResponse({
    status: 200,
    description: 'Institution application approved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        applicationId: { type: 'number' },
        processedDate: { type: 'string', format: 'date-time' },
        processingAdmin: { type: 'string' },
        institutionId: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Institution application already processed' })
  async approveInstitutionApplication(
    @Session() session: UserSession,
    @Param('id') applicationId: string,
    @Body(new ValidationPipe(validationOptions)) body: { notes?: string },
  ) {
    try {
      // Check if application exists and is pending
      const checkRows = await this.repo.sql`
        SELECT id, status FROM institution_applications WHERE id = ${applicationId}
      `;

      if (checkRows.length === 0) {
        throw new NotFoundException('Institution application not found');
      }

      assertArrayOf(checkRows, function (row) {
        assertDefined(row);
        assertPropStringOrNumber(row, 'id');
        assertPropString(row, 'status');
        return row;
      });

      const currentApp = checkRows[0];
      if (currentApp.status !== 'Submitted') {
        throw new ConflictException('Institution application has already been processed');
      }

      // Approve the application
      const result = await this.repo.adminApprovesInstitutionApplication({
        applicationId,
        reviewerUserId: session.user.id,
        approvalDate: new Date(),
      });

      this.logger.log('Institution application approved by admin', {
        applicationId,
        adminId: session.user.id,
        notes: body.notes,
      });

      return {
        success: true,
        message: 'Institution application approved successfully',
        applicationId: Number(applicationId),
        processedDate: new Date().toISOString(),
        processingAdmin: session.user.id,
        institutionId: Number(result.institutionId),
      };
    } catch (error) {
      this.logger.error('Failed to approve institution application', {
        error: error.message,
        applicationId,
      });
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to approve institution application');
    }
  }

  @Put('applications/:id/reject')
  @ApiOperation({
    summary: 'Reject institution application',
    description: 'Reject an institution application with reason',
  })
  @ApiParam({ name: 'id', description: 'Institution application ID' })
  @ApiResponse({
    status: 200,
    description: 'Institution application rejected successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        applicationId: { type: 'number' },
        processedDate: { type: 'string', format: 'date-time' },
        processingAdmin: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Rejection reason required or invalid' })
  @ApiResponse({ status: 409, description: 'Institution application already processed' })
  async rejectInstitutionApplication(
    @Session() session: UserSession,
    @Param('id') applicationId: string,
    @Body(new ValidationPipe(validationOptions)) body: { reason: string },
  ) {
    try {
      // Validate rejection reason
      if (!body.reason || body.reason.trim().length < 10) {
        throw new BadRequestException('Rejection reason must be at least 10 characters long');
      }

      // Check if application exists and is pending
      const checkRows = await this.repo.sql`
        SELECT id, status FROM institution_applications WHERE id = ${applicationId}
      `;

      if (checkRows.length === 0) {
        throw new NotFoundException('Institution application not found');
      }

      assertArrayOf(checkRows, function (row) {
        assertDefined(row);
        assertPropStringOrNumber(row, 'id');
        assertPropString(row, 'status');
        return row;
      });

      const currentApp = checkRows[0];
      if (currentApp.status !== 'Submitted') {
        throw new ConflictException('Institution application has already been processed');
      }

      // Reject the application
      const result = await this.repo.adminRejectInstitutionApplication({
        applicationId,
        reviewerUserId: session.user.id,
        rejectionReason: body.reason.trim(),
        rejectionDate: new Date(),
      });

      this.logger.log('Institution application rejected by admin', {
        applicationId,
        adminId: session.user.id,
        reason: body.reason,
      });

      return {
        success: true,
        message: 'Institution application rejected successfully',
        applicationId: Number(applicationId),
        processedDate: result.rejectedDate.toISOString(),
        processingAdmin: session.user.id,
      };
    } catch (error) {
      this.logger.error('Failed to reject institution application', {
        error: error.message,
        applicationId,
      });
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to reject institution application');
    }
  }
}
