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
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { ApiFile } from '../../../decorators/swagger.schema';
import { CreateKycIndividualDto, SubmitKycIndividualDto } from './dto/create-kyc-individual.dto';
import { KycIndividualStatusResponseDto } from './dto/kyc-individual-status-response.dto';
import { KycIndividualSubmissionResponseDto } from './dto/kyc-individual-submission-response.dto';
import { KycIndividualService } from './kyc-individual.service';

@Controller('individual')
@ApiTags('KYC')
@Auth()
export class KycIndividualController {
  constructor(private readonly kycIndividualService: KycIndividualService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user KYC status',
    description: 'Retrieve the current KYC verification status for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC status retrieved successfully',
    type: KycIndividualStatusResponseDto,
  })
  getIndividualKyc(@Session() session: UserSession) {
    return this.kycIndividualService.getIndividualKyc(session.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit KYC verification',
    description: 'Submit individual KYC documents and personal information for verification',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'KYC submission successful',
    type: KycIndividualSubmissionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or missing required files',
    schema: {
      example: {
        statusCode: 400,
        message: 'Both ID Card Photo and Selfie with ID Card Photo are required',
        error: 'Bad Request',
      },
    },
  })
  @ApiConflictResponse({
    description: 'KYC already submitted or in conflicting state',
    schema: {
      example: {
        statusCode: 409,
        message: 'KYC submission is already pending review. Please wait for verification.',
        error: 'Conflict',
      },
    },
  })
  @ApiFile([{ name: 'idCardPhoto' }, { name: 'selfieWithIdCardPhoto' }], { isRequired: true })
  async createIndividualKyc(
    @Session() session: UserSession,
    @UploadedFiles() files: {
      idCardPhoto: File[];
      selfieWithIdCardPhoto: File[];
    },
    @Body() kycData: SubmitKycIndividualDto,
  ): Promise<KycIndividualSubmissionResponseDto> {
    if (!files?.idCardPhoto?.[0]) {
      throw new BadRequestException('ID Card Photo is required');
    }
    if (!files?.selfieWithIdCardPhoto?.[0]) {
      throw new BadRequestException('Selfie with ID Card Photo is required');
    }

    const userId = session.user.id;

    // Upload files in parallel
    const [idCardResult, selfieWithIdResult] = await Promise.all([
      this.kycIndividualService.uploadFile(
        files.idCardPhoto[0].buffer,
        files.idCardPhoto[0].originalname,
        userId,
        'id-card',
        files.idCardPhoto[0].mimetype,
      ),
      this.kycIndividualService.uploadFile(
        files.selfieWithIdCardPhoto[0].buffer,
        files.selfieWithIdCardPhoto[0].originalname,
        userId,
        'selfie-with-id',
        files.selfieWithIdCardPhoto[0].mimetype,
      ),
    ]);

    // Create KYC data with object paths
    const createKycDto: CreateKycIndividualDto = {
      ...kycData,
      idCardPhoto: `${idCardResult.bucket}:${idCardResult.objectPath}`,
      selfieWithIdCardPhoto: `${selfieWithIdResult.bucket}:${selfieWithIdResult.objectPath}`,
    };

    return await this.kycIndividualService.createIndividualKyc(userId, createKycDto);
  }
}
