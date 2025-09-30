import type { File } from '../../shared/types';
import type { UserSession } from '../auth/types';

import { Body, Controller, Get, HttpStatus, Post, Session, UploadedFiles } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
import { ApiFile } from '../../decorators/swagger.schema';
import { RequireUserType } from '../../decorators/user-type.decorator';
import { SubmitCreateInstitutionDto } from './dto/create-institution.dto';
import { InstitutionsService } from './institutions.service';

@Controller('institution-applications')
@Auth()
@ApiTags('Institution Applications')
export class InstitutionApplicationsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit institution application' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Institution application submitted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Institution application created successfully' },
        application: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 123 },
            businessName: { type: 'string', example: 'PT. Example' },
            submittedDate: { type: 'string', format: 'date-time' },
            status: { type: 'string', example: 'Submitted' },
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data or missing required files',
  })
  @ApiFile(
    [
      { name: 'npwpDocument' },
      { name: 'registrationDocument' },
      { name: 'deedOfEstablishment' },
      { name: 'directorIdCard' },
      { name: 'ministryApprovalDocument' },
    ],
    { isRequired: true },
  )
  async apply(
    @Session() session: UserSession,
    @UploadedFiles() files: {
      npwpDocument: File[];
      registrationDocument: File[];
      deedOfEstablishment: File[];
      directorIdCard: File[];
      ministryApprovalDocument: File[];
    },
    @Body() createInstitutionDto: SubmitCreateInstitutionDto,
  ) {
    return this.institutionsService.apply(session.user.id, createInstitutionDto, files);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get institution application status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Institution application status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        application: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 123 },
            businessName: { type: 'string', example: 'PT. Example' },
            submittedDate: { type: 'string', format: 'date-time' },
            status: { type: 'string', example: 'Submitted' },
          },
        },
        progress: {
          type: 'object',
          properties: {
            currentStep: { type: 'number', example: 1 },
            totalSteps: { type: 'number', example: 3 },
            completedSteps: { type: 'array', items: { type: 'number' } },
            nextAction: { type: 'string', example: 'Wait for review' },
          },
        },
        documents: {
          type: 'object',
          properties: {
            uploaded: { type: 'number', example: 5 },
            required: { type: 'number', example: 5 },
            status: { type: 'string', example: 'complete' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Institution application not found',
  })
  async getApplicationStatus(@Session() session: UserSession) {
    return this.institutionsService.getApplicationStatus(session.user.id);
  }
}
