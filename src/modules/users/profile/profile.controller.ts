import type { File } from '../../../shared/types';
import type { UserSession } from '../../auth/types';

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ApiFile } from '../../../decorators/swagger.schema';
import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthService } from '../../auth/auth.service';
import { CreateCredentialProviderDto } from './dto/create-credential-provider.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateProfileResponseDto } from './dto/update-profile-response.dto';
import { ProfileService } from './profile.service';

@Controller()
@ApiTags('Profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly auth: AuthService,
  ) {}

  @Post('credential-provider')
  @ApiOperation({
    summary: 'Add credential provider (email/password) to existing user',
    description: 'Allows users who signed up via social provider to add email/password login',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Credential provider added successfully',
  })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Credential provider already exists' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  addCredentialProvider(
    @Session() session: UserSession,
    @Body() createCredentialProviderDto: CreateCredentialProviderDto,
  ) {
    return this.profileService.addCredentialProvider(
      session.user.id,
      createCredentialProviderDto.password,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get current user profile',
    description: "Retrieves the authenticated user's profile information",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  findOne(@Session() session: UserSession): Promise<ProfileResponseDto> {
    return this.profileService.findOne(session.user.id);
  }

  @Patch()
  @ApiFile({ name: 'profilePicture' })
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Updates user profile information. Optionally upload a new profile picture in the same request. Uses the same secure file handling patterns as KYC document uploads.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    type: UpdateProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request validation failed or invalid file format',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async update(
    @Session() session: UserSession,
    @Headers() headers: HeadersInit,
    @UploadedFile() profilePicture: File,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    // Process profile update with optional file upload
    const updateData = await this.profileService.processProfileUpdate(
      session.user.id,
      updateProfileDto,
      profilePicture,
    );

    return this.auth.api.updateUser({
      headers,
      body: updateData,
    });
  }
}
