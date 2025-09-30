import type { Request } from 'express';
import type { File } from '../../../shared/types';
import type { UserSession } from '../../auth/types';

import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Patch,
  Put,
  Req,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { fromNodeHeaders } from 'better-auth/node';

import { ApiFile } from '../../../decorators/swagger.schema';
import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthService } from '../../auth/auth.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateUserProfileDto } from './dto/update-profile.dto';
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
  async findOne(@Session() session: UserSession) {
    const user = await this.profileService.findOne(session.user.id);
    return { user };
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
  async update(
    @Session() session: UserSession,
    @Req() req: Request,
    @UploadedFile() profilePicture: File,
    @Body() updateProfileDto: UpdateUserProfileDto,
  ) {
    // Validate content type for multipart form data
    const contentType = req.get('content-type') || '';
    if (contentType && !contentType.includes('multipart/form-data')) {
      throw new HttpException(
        'Invalid content type. Expected multipart/form-data',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    // Process profile update with optional file upload
    const updateData = await this.profileService.processProfileUpdate(
      session.user.id,
      updateProfileDto,
      profilePicture,
    );

    return this.auth.api.updateUser({
      headers: fromNodeHeaders(req.headers),
      body: updateData,
    });
  }

  @Put()
  @ApiFile({ name: 'profilePicture' })
  @ApiOperation({
    summary: 'Update current user profile (PUT method)',
    description: 'Updates user profile information. Handles FormData with optional file upload.',
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
  async updatePut(
    @Session() session: UserSession,
    @Req() req: Request,
    @UploadedFile() profilePicture: File,
    @Body() updateProfileDto: UpdateUserProfileDto,
  ) {
    // Validate content type for multipart form data
    const contentType = req.get('content-type') || '';
    console.debug(
      'PUT profile update content-type:',
      contentType,
      'includes multipart:',
      contentType.includes('multipart/form-data'),
    );
    if (contentType && !contentType.includes('multipart/form-data')) {
      throw new HttpException(
        'Invalid content type. Expected multipart/form-data',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    // Process profile update with optional file upload
    const updateData = await this.profileService.processProfileUpdate(
      session.user.id,
      updateProfileDto,
      profilePicture,
    );

    await this.auth.api.updateUser({
      headers: fromNodeHeaders(req.headers),
      body: updateData,
    });

    // Get updated profile to return in response
    const updatedProfile = await this.profileService.findOne(session.user.id);

    return {
      user: updatedProfile,
      message: 'Profile updated successfully',
    };
  }
}
