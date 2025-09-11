import type { File } from '../../shared/types';
import type { UserSession } from '../auth/types';

import {
  BadRequestException,
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
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { CreateInstitutionInviteDto } from './dto/create-institution-invite.dto';
import { InvitationStatus, UpdateInvitationStatusDto } from './dto/update-invitation-status.dto';
import { InstitutionsService } from './institutions.service';

@Controller('institutions')
@Auth()
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  @ApiOperation({ summary: 'Apply for institution registration' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Institution application submitted successfully',
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
    @Body() createInstitutionDto: CreateInstitutionDto,
  ) {
    const validatedFiles = this.validateInstitutionFiles(files);
    const userId = session.user.id;

    // Upload files in parallel
    const [npwpResult, registrationResult, deedResult, directorIdResult] = await Promise.all([
      this.institutionsService.uploadFile(
        validatedFiles.npwpDocument.buffer,
        validatedFiles.npwpDocument.originalname,
        userId,
        'npwp-document',
        validatedFiles.npwpDocument.mimetype,
      ),
      this.institutionsService.uploadFile(
        validatedFiles.registrationDocument.buffer,
        validatedFiles.registrationDocument.originalname,
        userId,
        'registration-document',
        validatedFiles.registrationDocument.mimetype,
      ),
      this.institutionsService.uploadFile(
        validatedFiles.deedOfEstablishment.buffer,
        validatedFiles.deedOfEstablishment.originalname,
        userId,
        'deed-of-establishment',
        validatedFiles.deedOfEstablishment.mimetype,
      ),
      this.institutionsService.uploadFile(
        validatedFiles.directorIdCard.buffer,
        validatedFiles.directorIdCard.originalname,
        userId,
        'director-id-card',
        validatedFiles.directorIdCard.mimetype,
      ),
    ]);

    // Create institution data with file paths
    const institutionData = {
      ...createInstitutionDto,
      npwpDocumentPath: `${npwpResult.bucket}:${npwpResult.objectPath}`,
      registrationDocumentPath: `${registrationResult.bucket}:${registrationResult.objectPath}`,
      deedOfEstablishmentPath: `${deedResult.bucket}:${deedResult.objectPath}`,
      directorIdCardPath: `${directorIdResult.bucket}:${directorIdResult.objectPath}`,
    };

    return this.institutionsService.apply(session.user.id, institutionData);
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

  private validateInstitutionFiles(files: {
    npwpDocument: File[];
    registrationDocument: File[];
    deedOfEstablishment: File[];
    directorIdCard: File[];
  }) {
    if (!files?.npwpDocument?.[0]) {
      throw new BadRequestException('NPWP document is required');
    }
    if (!files?.registrationDocument?.[0]) {
      throw new BadRequestException('Registration document is required');
    }
    if (!files?.deedOfEstablishment?.[0]) {
      throw new BadRequestException('Deed of establishment document is required');
    }
    if (!files?.directorIdCard?.[0]) {
      throw new BadRequestException('Director ID card is required');
    }

    return {
      npwpDocument: files.npwpDocument[0],
      registrationDocument: files.registrationDocument[0],
      deedOfEstablishment: files.deedOfEstablishment[0],
      directorIdCard: files.directorIdCard[0],
    };
  }
}
