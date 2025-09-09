import type { UserSession } from '../../auth/types';

import { BadRequestException, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { MinioService } from '../../../shared/services/minio.service';
import { TelemetryLogger } from '../../../telemetry.logger';
import { Session } from '../../auth/auth.decorator';

@Controller('admin/kyc')
@ApiTags('admin')
@Auth(['Admin'])
export class AdminKycController {
  private readonly logger = new TelemetryLogger(AdminKycController.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly userRepo: CryptogadaiRepository,
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
      const rows = await this.userRepo.sql`
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

  @Post('users/:userId/approve')
  @ApiOperation({
    summary: 'Approve KYC application',
    description: 'Approve a user KYC application after manual review',
  })
  approveKyc(@Session() session: UserSession, @Param('userId') userId: string) {
    // TODO: Implement KYC approval logic
    return { message: 'KYC approved successfully', userId, approvedBy: session.user.id };
  }

  @Post('users/:userId/reject')
  @ApiOperation({
    summary: 'Reject KYC application',
    description: 'Reject a user KYC application with reason',
  })
  rejectKyc(@Session() session: UserSession, @Param('userId') userId: string) {
    // TODO: Implement KYC rejection logic
    return { message: 'KYC rejected successfully', userId, rejectedBy: session.user.id };
  }
}
