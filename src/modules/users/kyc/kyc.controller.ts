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
  Session,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { ApiFile } from '../../../decorators/swagger.schema';
import { CreateKycDto, SubmitKycDto } from './dto/create-kyc.dto';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';
import { KycSubmissionResponseDto } from './dto/kyc-submission-response.dto';
import { KycService } from './kyc.service';

@Controller()
@ApiTags('KYC')
@Auth()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user KYC status',
    description: 'Retrieve the current KYC verification status for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC status retrieved successfully',
    type: KycStatusResponseDto,
  })
  getKyc(@Session() session: UserSession) {
    return this.kycService.getKyc(session.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit KYC verification',
    description: 'Submit individual KYC documents and personal information for verification',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'KYC submission successful',
    type: KycSubmissionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data, validation errors, or missing required files',
  })
  @ApiConflictResponse({
    description: 'KYC already submitted or in conflicting state',
  })
  @ApiFile([{ name: 'idCardPhoto' }, { name: 'selfieWithIdCardPhoto' }], { isRequired: true })
  async createKyc(
    @Session() session: UserSession,
    @UploadedFiles() files: {
      idCardPhoto: File[];
      selfieWithIdCardPhoto: File[];
    },
    @Body() kycData: SubmitKycDto,
  ): Promise<KycSubmissionResponseDto> {
    const { idCardPhoto, selfieWithIdCardPhoto } = this.validateFiles(files);
    const userId = session.user.id;

    // Upload files in parallel
    const [idCardResult, selfieWithIdResult] = await Promise.all([
      this.kycService.uploadFile(
        idCardPhoto.buffer,
        idCardPhoto.originalname,
        userId,
        'id-card',
        idCardPhoto.mimetype,
      ),
      this.kycService.uploadFile(
        selfieWithIdCardPhoto.buffer,
        selfieWithIdCardPhoto.originalname,
        userId,
        'selfie-with-id-card',
        selfieWithIdCardPhoto.mimetype,
      ),
    ]);

    // Create KYC data with object paths
    const createKycDto: CreateKycDto = {
      ...kycData,
      idCardPhoto: `${idCardResult.bucket}:${idCardResult.objectPath}`,
      selfieWithIdCardPhoto: `${selfieWithIdResult.bucket}:${selfieWithIdResult.objectPath}`,
    };

    return await this.kycService.createKyc(userId, createKycDto);
  }

  private validateFiles(files: { idCardPhoto: File[]; selfieWithIdCardPhoto: File[] }) {
    if (!files?.idCardPhoto?.[0]) {
      throw new BadRequestException('ID Card Photo is required');
    }
    if (!files?.selfieWithIdCardPhoto?.[0]) {
      throw new BadRequestException('Selfie with ID Card Photo is required');
    }

    return {
      idCardPhoto: files.idCardPhoto[0],
      selfieWithIdCardPhoto: files.selfieWithIdCardPhoto[0],
    };
  }
}
