import type { UserSession } from '../../auth/types';

import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { TelemetryLogger } from '../../../telemetry.logger';
import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { CreateKycDto } from './dto/create-kyc.dto';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';
import { KycSubmissionResponseDto } from './dto/kyc-submission-response.dto';
import { KycService } from './kyc.service';

@Controller('users/kyc')
@ApiTags('users')
@UseGuards(AuthGuard)
export class KycController {
  private readonly logger = new TelemetryLogger(KycController.name);

  constructor(private readonly kycService: KycService) {}

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
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // Maximum 3 attempts per hour for security
  @ApiOperation({
    summary: 'Submit KYC verification documents',
    description:
      'Submits KYC documents for verification. Users can only have one active KYC submission at a time.',
  })
  @ApiBody({
    type: CreateKycDto,
    description: 'KYC verification documents and personal information',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'KYC submission successful - documents under review',
    type: KycSubmissionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid KYC data - validation errors',
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
  submitKyc(
    @Session() session: UserSession,
    @Body() createKycDto: CreateKycDto,
  ): Promise<KycSubmissionResponseDto> {
    // Log KYC submission attempt for security monitoring
    this.logger.log(`KYC submission request from user: ${session.user.id}`, {
      userId: session.user.id,
      timestamp: new Date().toISOString(),
      action: 'kyc_submission_request',
      userAgent: 'unknown', // You can get this from request headers
    });

    return this.kycService.createKyc(session.user.id, createKycDto);
  }

  // @Put()
  // async updateKyc(@Param('userId') userId: string, @Body() updateKycDto: UpdateKycDto) {
  //   return await this.kycService.updateKyc(userId, updateKycDto);
  // }

  // @Post('verify')
  // async verifyKyc(@Param('userId') userId: string) {
  //   return await this.kycService.verifyKyc(userId);
  // }

  // @Post('reject')
  // async rejectKyc(@Param('userId') userId: string, @Body('reason') reason: string) {
  //   return await this.kycService.rejectKyc(userId, reason);
  // }

  // @Get('documents')
  // async getKycDocuments(@Param('userId') userId: string) {
  //   return await this.kycService.getDocuments(userId);
  // }

  // @Post('documents')
  // async uploadDocument(@Param('userId') userId: string, @Body() documentData: any) {
  //   return await this.kycService.uploadDocument(userId, documentData);
  // }
}
