import type { File } from '../../shared/types';
import type { UserSession } from '../auth/types';

import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Patch,
  Post,
  Session,
  UploadedFiles,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
import { ApiFile } from '../../decorators/swagger.schema';
import { RequireUserType } from '../../decorators/user-type.decorator';
import { SubmitCreateInstitutionDto } from './dto/create-institution.dto';
import { CreateInstitutionInviteDto } from './dto/create-institution-invite.dto';
import { InvitationStatus, UpdateInvitationStatusDto } from './dto/update-invitation-status.dto';
import { InstitutionsService } from './institutions.service';

@Controller('institutions')
@Auth()
@RequireUserType('Institution')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  @ApiOperation({ summary: 'Apply for institution registration' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Institution application submitted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Institution application created successfully' },
        data: {
          type: 'object',
          properties: {
            applicationId: { type: 'string', example: 'uuid-123' },
            status: { type: 'string', example: 'Pending' },
            submissionDate: { type: 'string', format: 'date-time' },
            businessName: { type: 'string', example: 'PT. Example' },
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
    },
    @Body() createInstitutionDto: SubmitCreateInstitutionDto,
  ) {
    return this.institutionsService.apply(session.user.id, createInstitutionDto, files);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Invite user to institution' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Invitation sent successfully' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Only institution owners can invite users',
  })
  invite(
    @Session() session: UserSession,
    @Body() createInstitutionInviteDto: CreateInstitutionInviteDto,
  ) {
    return this.institutionsService.invite(session.user.id, createInstitutionInviteDto);
  }

  @Patch('invitations/:id')
  @ApiOperation({ summary: 'Update invitation status (accept or reject)' })
  @ApiParam({
    name: 'id',
    description: 'Invitation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Invitation status updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Invitation not found' })
  updateInvitationStatus(
    @Session() session: UserSession,
    @Param('id') inviteId: string,
    @Body() updateStatusDto: UpdateInvitationStatusDto,
  ) {
    if (updateStatusDto.status === InvitationStatus.ACCEPTED) {
      return this.institutionsService.acceptInvite(session.user.id, inviteId);
    } else {
      return this.institutionsService.rejectInvite(
        session.user.id,
        inviteId,
        updateStatusDto.reason,
      );
    }
  }
}
