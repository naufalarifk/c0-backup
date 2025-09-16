import type { File } from '../../../shared/types';
import type { UserSession } from '../../auth/types';

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Patch,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ApiFile } from '../../../decorators/swagger.schema';
import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthService } from '../../auth/auth.service';
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
