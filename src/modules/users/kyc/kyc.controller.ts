import type { File } from '../../../shared/types';
import type { UserSession } from '../../auth/types';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ApiFile } from '../../../shared/decorators/swagger.schema';
import { TelemetryLogger } from '../../../telemetry.logger';
import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { CreateKycDto, SubmitKycDto } from './dto/create-kyc.dto';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';
import { KycSubmissionResponseDto } from './dto/kyc-submission-response.dto';
import { KycService } from './kyc.service';
import { KycFileService } from './kyc-file.service';

@Controller('users/kyc')
@ApiTags('users')
@UseGuards(AuthGuard)
export class KycController {
  private readonly logger = new TelemetryLogger(KycController.name);

  constructor(
    private readonly kycService: KycService,
    private readonly kycFileService: KycFileService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get current user KYC status',
    description: 'Retrieves the KYC verification status and details for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC status retrieved successfully',
    type: KycStatusResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  getKycStatus(@Session() session: UserSession): Promise<KycStatusResponseDto> {
    return this.kycService.getKycByUserId(session.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiFile([{ name: 'idCardPhoto' }, { name: 'selfieWithIdCardPhoto' }], { isRequired: true })
  @ApiOperation({
    summary: 'Submit KYC verification documents',
    description:
      'Submits KYC documents and personal information for verification. Files are uploaded to storage automatically.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'KYC submission successful - documents under review',
    type: KycSubmissionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid KYC data - validation errors or missing files',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'KYC already submitted or verified',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded - too many KYC submission attempts',
  })
  async submitKyc(
    @Session() session: UserSession,
    @UploadedFiles() files: {
      idCardPhoto: File[];
      selfieWithIdCardPhoto: File[];
    },
    @Body() kycData: SubmitKycDto,
  ): Promise<KycSubmissionResponseDto> {
    // Validate required files first
    if (!files?.idCardPhoto?.[0]) {
      throw new BadRequestException('ID Card Photo is required');
    }
    if (!files?.selfieWithIdCardPhoto?.[0]) {
      throw new BadRequestException('Selfie with ID Card Photo is required');
    }

    // Log KYC submission attempt for security monitoring
    this.logger.log(`KYC submission request from user: ${session.user.id}`, {
      userId: session.user.id,
      timestamp: new Date().toISOString(),
      action: 'kyc_submission_request',
      hasIdCard: !!files.idCardPhoto?.[0],
      hasSelfieWithId: !!files.selfieWithIdCardPhoto?.[0],
    });

    try {
      // Upload files to Minio - files are already validated by @ApiFile decorator
      const [idCardResult, selfieWithIdResult] = await Promise.all([
        this.kycFileService.uploadFile(
          files.idCardPhoto[0].buffer,
          files.idCardPhoto[0].originalname,
          session.user.id,
          'id-card',
          files.idCardPhoto[0].mimetype,
        ),
        this.kycFileService.uploadFile(
          files.selfieWithIdCardPhoto[0].buffer,
          files.selfieWithIdCardPhoto[0].originalname,
          session.user.id,
          'selfie-with-id',
          files.selfieWithIdCardPhoto[0].mimetype,
        ),
      ]);

      // Create KYC data with uploaded file URLs
      const createKycDto: CreateKycDto = {
        ...kycData,
        idCardPhoto: idCardResult.url,
        selfieWithIdCardPhoto: selfieWithIdResult.url,
      };

      this.logger.log(`Files uploaded successfully for user: ${session.user.id}`, {
        userId: session.user.id,
        idCardUrl: idCardResult.url,
        selfieWithIdUrl: selfieWithIdResult.url,
      });

      // Submit KYC data with URLs
      return await this.kycService.createKyc(session.user.id, createKycDto);
    } catch (error) {
      // Business context logging before re-throwing
      this.logger.error(`KYC submission failed for user ${session.user.id}:`, {
        error: error.message,
        userId: session.user.id,
        action: 'kyc_submission_failed',
        step: error.message.includes('upload') ? 'file_upload' : 'data_submission',
      });

      // Re-throw to let NestJS global exception filter handle the response
      throw error;
    }
  }
}
