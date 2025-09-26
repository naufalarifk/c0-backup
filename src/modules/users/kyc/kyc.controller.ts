import type { File } from '../../../shared/types';
import type { UserSession } from '../../auth/types';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Session,
  UploadedFiles,
  ValidationPipe,
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
import { RequireUserType } from '../../../decorators/user-type.decorator';
import { validationOptions } from '../../../shared/utils/validation-options.js';
import { SubmitKycDto } from './dto/create-kyc.dto';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';
import { KycService } from './kyc.service';

@Controller()
@ApiTags('KYC')
@Auth()
@RequireUserType('Individual')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('status')
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

  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit KYC verification',
    description: 'Submit individual KYC documents and personal information for verification',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'KYC submission successful',
    type: KycStatusResponseDto,
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
    @Body(new ValidationPipe(validationOptions)) kycData: SubmitKycDto,
  ) {
    return this.kycService.createKyc(session.user.id, kycData, files);
  }
}
