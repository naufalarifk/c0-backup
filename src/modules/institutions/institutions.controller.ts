import type { UserSession } from '../auth/types';

import { Body, Controller, HttpStatus, Param, Patch, Post, Session } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
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
  apply(@Session() session: UserSession, @Body() createInstitutionDto: CreateInstitutionDto) {
    return this.institutionsService.apply(session.user.id, createInstitutionDto);
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
