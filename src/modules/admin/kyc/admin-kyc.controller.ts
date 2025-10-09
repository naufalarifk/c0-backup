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

import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropNullableString,
  assertPropString,
  check,
  isInstanceOf,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { Auth } from '../../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { MinioService } from '../../../shared/services/minio.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { validationOptions } from '../../../shared/utils/validation-options.js';
import { Session } from '../../auth/auth.decorator';

@Controller('admin/kyc')
@ApiTags('Admin - KYC')
@Auth(['Admin'])
export class AdminKycController {
  private readonly logger = new TelemetryLogger(AdminKycController.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly repo: CryptogadaiRepository,
  ) {}

  @Get('users/:userId/documents/:docType')
  @ApiOperation({
    summary: 'Get KYC document URL for admin review',
    description: 'Generates a fresh URL for admin to view KYC documents from database paths',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '13',
  })
  @ApiParam({
    name: 'docType',
    enum: ['id-card', 'selfie'],
    description: 'Type of document to retrieve',
    example: 'id-card',
  })
  @ApiResponse({
    status: 200,
    description: 'Document URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Fresh document URL (15-minute expiry)' },
        expiresIn: { type: 'number', description: 'Expiry time in seconds' },
        documentPath: { type: 'string', description: 'Internal object path' },
      },
    },
  })
  async getKycDocumentForAdmin(
    @Param('userId') userId: string,
    @Param('docType') docType: 'id-card' | 'selfie',
  ) {
    try {
      // Get KYC data from database with document paths
      const rows = await this.repo.sql`
        SELECT id_card_photo, selfie_with_id_card_photo
        FROM user_kycs
        WHERE user_id = ${userId}
        ORDER BY submitted_date DESC
        LIMIT 1
      `;

      if (rows.length === 0) {
        throw new BadRequestException(`No KYC found for user ${userId}`);
      }

      const kyc = rows[0] as { id_card_photo?: string; selfie_with_id_card_photo?: string };
      let documentPath: string;

      if (docType === 'id-card' && kyc.id_card_photo) {
        documentPath = kyc.id_card_photo;
      } else if (docType === 'selfie' && kyc.selfie_with_id_card_photo) {
        documentPath = kyc.selfie_with_id_card_photo;
      } else {
        throw new BadRequestException(`Document type '${docType}' not found for user ${userId}`);
      }

      // Parse bucket:objectPath format
      const [bucket, objectPath] = documentPath.split(':');
      if (!bucket || !objectPath) {
        throw new BadRequestException('Invalid document path format in database');
      }

      // Generate fresh URL with longer expiry for admin (15 minutes)
      const url = await this.minioService.getFileUrl(bucket, objectPath, 15 * 60);

      this.logger.log(`Admin accessed KYC document`, {
        userId,
        docType,
        documentPath,
        action: 'admin_document_access',
      });

      return {
        url,
        expiresIn: 900, // 15 minutes
        documentPath,
      };
    } catch (error) {
      this.logger.error(`Failed to get KYC document for admin`, {
        error: error.message,
        userId,
        docType,
      });
      throw error;
    }
  }

  @Get('queue')
  @ApiOperation({
    summary: 'Get pending KYC submissions queue',
    description: 'Retrieve pending KYC submissions for admin review with pagination and filtering',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 10 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort by field',
    example: 'submittedDate',
  })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order', example: 'desc' })
  @ApiResponse({
    status: 200,
    description: 'KYC queue retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        submissions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              userId: { type: 'number' },
              userName: { type: 'string' },
              userEmail: { type: 'string' },
              submittedDate: { type: 'string', format: 'date-time' },
              timeInQueue: { type: 'string' },
              priority: { type: 'string', enum: ['normal', 'high', 'urgent'] },
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
  async getKycQueue(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    try {
      const result = await this.repo.adminViewsPendingKYCs();

      // Get user emails for all pending KYC submissions
      const userIds = result.kycs.map(kyc => kyc.userId);
      const userEmails = await this.repo.sql`
        SELECT id::text AS user_id, email
        FROM users
        WHERE id::text = ANY(${userIds})
      `;

      // Create a map of userId to email
      const emailMap = new Map<string, string>();
      userEmails.forEach(user => {
        assertDefined(user);
        assertPropString(user, 'user_id');
        assertPropNullableString(user, 'email');
        emailMap.set(user.user_id, user.email || '');
      });

      const submissions = result.kycs.map(kyc => {
        const submittedDate = new Date(kyc.submittedDate);
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
          id: Number(kyc.id),
          userId: Number(kyc.userId),
          userName: kyc.name,
          userEmail: emailMap.get(kyc.userId) || '',
          submittedDate: submittedDate.toISOString(),
          timeInQueue,
          priority: 'normal' as const,
        };
      });

      // Simple pagination
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 50;
      const total = submissions.length;

      return {
        submissions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get KYC queue', { error: error.message });
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get detailed KYC submission',
    description: 'Retrieve detailed KYC submission for admin review',
  })
  @ApiParam({ name: 'id', description: 'KYC submission ID' })
  @ApiResponse({
    status: 200,
    description: 'KYC submission details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        userId: { type: 'number' },
        userInfo: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            name: { type: 'string' },
            createdDate: { type: 'string', format: 'date-time' },
          },
        },
        submissionData: {
          type: 'object',
          properties: {
            nik: { type: 'string' },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            address: { type: 'string' },
          },
        },
        documents: {
          type: 'object',
          properties: {
            idCardPhotoUrl: { type: 'string' },
            selfieWithIdCardPhotoUrl: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'KYC submission not found' })
  async getKycDetails(@Param('id') kycId: string) {
    try {
      // Get KYC details from database
      const rows = await this.repo.sql`
        SELECT
          uk.id,
          uk.user_id,
          uk.nik,
          uk.name,
          uk.birth_date,
          uk.address,
          uk.id_card_photo,
          uk.selfie_with_id_card_photo,
          uk.submitted_date,
          u.email,
          u.name as user_name,
          u.created_date
        FROM user_kycs uk
        LEFT JOIN users u ON uk.user_id = u.id
        WHERE uk.id = ${kycId}
      `;

      if (rows.length === 0) {
        throw new NotFoundException('KYC submission not found');
      }

      assertArrayMapOf(rows, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isString, isNumber), row, 'user_id');
        assertPropString(row, 'nik');
        assertPropString(row, 'name');
        assertProp(isInstanceOf(Date), row, 'birth_date');
        assertPropString(row, 'address');
        assertPropString(row, 'id_card_photo');
        assertPropString(row, 'selfie_with_id_card_photo');
        assertProp(isInstanceOf(Date), row, 'submitted_date');
        assertPropNullableString(row, 'email');
        assertPropNullableString(row, 'user_name');
        assertProp(check(isNullable, isInstanceOf(Date)), row, 'created_date');
        return row;
      });

      const kyc = rows[0];

      // Generate signed URLs for documents
      let idCardPhotoUrl = '';
      let selfieWithIdCardPhotoUrl = '';

      if (kyc.id_card_photo) {
        const [bucket, objectPath] = kyc.id_card_photo.split(':');
        if (bucket && objectPath) {
          try {
            idCardPhotoUrl = await this.minioService.getFileUrl(bucket, objectPath, 15 * 60);
          } catch (error) {
            this.logger.warn(`Failed to generate ID card photo URL: ${error.message}`, {
              kycId,
              bucket,
              objectPath,
            });
            // Continue without URL - this is acceptable for admin review
          }
        }
      }

      if (kyc.selfie_with_id_card_photo) {
        const [bucket, objectPath] = kyc.selfie_with_id_card_photo.split(':');
        if (bucket && objectPath) {
          try {
            selfieWithIdCardPhotoUrl = await this.minioService.getFileUrl(
              bucket,
              objectPath,
              15 * 60,
            );
          } catch (error) {
            this.logger.warn(`Failed to generate selfie photo URL: ${error.message}`, {
              kycId,
              bucket,
              objectPath,
            });
            // Continue without URL - this is acceptable for admin review
          }
        }
      }

      return {
        id: Number(kyc.id),
        userId: Number(kyc.user_id),
        userInfo: {
          email: kyc.email || 'No email found',
          name: kyc.user_name || 'No name found',
          createdDate: kyc.created_date ? kyc.created_date.toISOString() : new Date().toISOString(),
        },
        submissionData: {
          nik: kyc.nik,
          name: kyc.name,
          birthDate: kyc.birth_date.toISOString().split('T')[0],
          address: kyc.address,
        },
        documents: {
          idCardPhotoUrl,
          selfieWithIdCardPhotoUrl,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get KYC details', { error: error.message, kycId });
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve KYC details');
    }
  }

  @Put(':id/approve')
  @ApiOperation({
    summary: 'Approve KYC submission',
    description: 'Approve a KYC submission after manual review',
  })
  @ApiParam({ name: 'id', description: 'KYC submission ID' })
  @ApiResponse({
    status: 200,
    description: 'KYC approved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        kycId: { type: 'number' },
        processedDate: { type: 'string', format: 'date-time' },
        processingAdmin: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'KYC already processed' })
  async approveKyc(
    @Session() session: UserSession,
    @Param('id') kycId: string,
    @Body(new ValidationPipe(validationOptions)) body: { notes?: string },
  ) {
    try {
      // Check if KYC exists and is pending
      const checkRows = await this.repo.sql`
        SELECT id, verified_date, rejected_date FROM user_kycs WHERE id = ${kycId}
      `;

      if (checkRows.length === 0) {
        throw new NotFoundException('KYC submission not found');
      }

      assertArrayMapOf(checkRows, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isNullable, isInstanceOf(Date)), row, 'verified_date');
        assertProp(check(isNullable, isInstanceOf(Date)), row, 'rejected_date');
        return row;
      });

      const currentKyc = checkRows[0];
      if (currentKyc.verified_date !== null || currentKyc.rejected_date !== null) {
        throw new ConflictException('KYC has already been processed');
      }

      // Approve the KYC
      const result = await this.repo.adminApprovesKyc({
        kycId,
        verifierUserId: session.user.id,
        approvalDate: new Date(),
      });

      this.logger.log('KYC approved by admin', {
        kycId,
        adminId: session.user.id,
        notes: body.notes,
      });

      return {
        success: true,
        message: 'KYC approved successfully',
        kycId: Number(kycId),
        processedDate: result.verifiedDate.toISOString(),
        processingAdmin: session.user.id,
      };
    } catch (error) {
      this.logger.error('Failed to approve KYC', { error: error.message, kycId });
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to approve KYC');
    }
  }

  @Put(':id/reject')
  @ApiOperation({
    summary: 'Reject KYC submission',
    description: 'Reject a KYC submission with reason',
  })
  @ApiParam({ name: 'id', description: 'KYC submission ID' })
  @ApiResponse({
    status: 200,
    description: 'KYC rejected successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        kycId: { type: 'number' },
        processedDate: { type: 'string', format: 'date-time' },
        processingAdmin: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Rejection reason required or invalid' })
  @ApiResponse({ status: 409, description: 'KYC already processed' })
  async rejectKyc(
    @Session() session: UserSession,
    @Param('id') kycId: string,
    @Body(new ValidationPipe(validationOptions)) body: { reason: string },
  ) {
    try {
      // Validate rejection reason
      if (!body.reason || body.reason.trim().length < 10) {
        throw new BadRequestException('Rejection reason must be at least 10 characters long');
      }

      // Check if KYC exists and is pending
      const checkRows = await this.repo.sql`
        SELECT id, verified_date, rejected_date FROM user_kycs WHERE id = ${kycId}
      `;

      if (checkRows.length === 0) {
        throw new NotFoundException('KYC submission not found');
      }

      assertArrayMapOf(checkRows, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isNullable, isInstanceOf(Date)), row, 'verified_date');
        assertProp(check(isNullable, isInstanceOf(Date)), row, 'rejected_date');
        return row;
      });

      const currentKyc = checkRows[0];
      if (currentKyc.verified_date !== null || currentKyc.rejected_date !== null) {
        throw new ConflictException('KYC has already been processed');
      }

      // Reject the KYC
      const result = await this.repo.adminRejectsKyc({
        kycId,
        verifierUserId: session.user.id,
        rejectionReason: body.reason.trim(),
        rejectionDate: new Date(),
      });

      this.logger.log('KYC rejected by admin', {
        kycId,
        adminId: session.user.id,
        reason: body.reason,
      });

      return {
        success: true,
        message: 'KYC rejected successfully',
        kycId: Number(kycId),
        processedDate: result.rejectedDate.toISOString(),
        processingAdmin: session.user.id,
      };
    } catch (error) {
      this.logger.error('Failed to reject KYC', { error: error.message, kycId });
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to reject KYC');
    }
  }
}
