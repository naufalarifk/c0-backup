import type { File } from '../../shared/types';
import type { UserSession } from '../auth/types';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Session,
  UploadedFiles,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
import { ApiFile } from '../../decorators/swagger.schema';
import { RequireUserType } from '../../decorators/user-type.decorator';
import { SubmitCreateInstitutionDto } from './dto/create-institution.dto';
import { CreateInstitutionInviteDto } from './dto/create-institution-invite.dto';
import { RejectInvitationDto } from './dto/reject-invitation.dto';
import { InvitationStatus, UpdateInvitationStatusDto } from './dto/update-invitation-status.dto';
import { InstitutionsService } from './institutions.service';

@Controller('institutions')
@Auth()
@ApiTags('Institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get institution details' })
  @ApiParam({ name: 'id', description: 'Institution ID', example: '1' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Institution details retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Institution not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - not a member of this institution',
  })
  async getInstitution(@Session() session: UserSession, @Param('id') institutionId: string) {
    return this.institutionsService.getInstitutionDetails(institutionId, session.user.id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get institution members' })
  @ApiParam({ name: 'id', description: 'Institution ID', example: '1' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Institution members retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Institution not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - not a member of this institution',
  })
  async getInstitutionMembers(@Session() session: UserSession, @Param('id') institutionId: string) {
    return this.institutionsService.getInstitutionMembers(institutionId, session.user.id);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member from the institution' })
  @ApiParam({ name: 'id', description: 'Institution ID', example: '1' })
  @ApiParam({ name: 'memberId', description: 'Member User ID', example: '123' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member removed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot remove owner or invalid request',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Institution or member not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only owners can remove members',
  })
  async removeInstitutionMember(
    @Session() session: UserSession,
    @Param('id') institutionId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.institutionsService.removeInstitutionMember(
      institutionId,
      memberId,
      session.user.id,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Apply for institution registration' })
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
  @RequireUserType('Individual')
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

  @Get(':id/invitations')
  @ApiOperation({ summary: 'List pending invitations for institution' })
  @ApiParam({ name: 'id', description: 'Institution ID', example: '1' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending invitations retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Institution not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - only institution owners can view invitations',
  })
  async getInstitutionInvitations(
    @Session() session: UserSession,
    @Param('id') institutionId: string,
  ) {
    return this.institutionsService.listInstitutionInvitations(institutionId, session.user.id);
  }

  @Post('invitations')
  @RequireUserType('Institution')
  @ApiOperation({ summary: 'Invite user to institution' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Invitation sent successfully' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'User not found or invalid request',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User is already a member of an institution',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Only institution owners can invite users',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Validation error',
  })
  invite(
    @Session() session: UserSession,
    @Body() createInstitutionInviteDto: CreateInstitutionInviteDto,
  ) {
    return this.institutionsService.invite(session.user.id, createInstitutionInviteDto);
  }

  @Post('invitations/:id/resend')
  @RequireUserType('Institution')
  @ApiOperation({ summary: 'Resend institution invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID', example: '123' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation resent successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot resend invitation that has already been accepted or rejected',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only institution owners can resend invitations',
  })
  async resendInvitation(@Session() session: UserSession, @Param('id') invitationId: string) {
    return this.institutionsService.resendInvitation(invitationId, session.user.id);
  }

  @Get('invitations/:id')
  @ApiOperation({ summary: 'Get invitation details' })
  @ApiParam({ name: 'id', description: 'Invitation ID', example: '123' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation details retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  async getInvitationDetails(@Session() session: UserSession, @Param('id') invitationId: string) {
    return this.institutionsService.getInvitationDetails(invitationId, session.user.id);
  }

  @Post('invitations/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept institution invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID', example: '123' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation accepted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invitation has expired or already been responded to',
  })
  async acceptInvitation(@Session() session: UserSession, @Param('id') invitationId: string) {
    return this.institutionsService.acceptInvite(session.user.id, invitationId);
  }

  @Post('invitations/:id/reject')
  @ApiOperation({ summary: 'Reject institution invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID', example: '123' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation rejected successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  async rejectInvitation(
    @Session() session: UserSession,
    @Param('id') invitationId: string,
    @Body() rejectDto: RejectInvitationDto,
  ) {
    return this.institutionsService.rejectInvite(session.user.id, invitationId, rejectDto.reason);
  }

  @Delete('invitations/:id')
  @ApiOperation({ summary: 'Cancel institution invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID', example: '123' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation cancelled successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot cancel invitation that has already been accepted or rejected',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only institution owners can cancel invitations',
  })
  async cancelInvitation(@Session() session: UserSession, @Param('id') invitationId: string) {
    return this.institutionsService.cancelInvitation(invitationId, session.user.id);
  }

  @Patch('invitations/:id')
  @ApiOperation({ summary: 'Update invitation status (accept or reject) - Legacy endpoint' })
  @ApiParam({
    name: 'id',
    description: 'Invitation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Invitation status updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Invitation not found' })
  @RequireUserType('Individual')
  updateInvitationStatus(
    @Session() session: UserSession,
    @Param('id') inviteId: string,
    @Body() updateStatusDto: UpdateInvitationStatusDto,
  ) {
    console.log(session);

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
