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
import { TelemetryLogger } from '../../../telemetry.logger';
import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthService } from '../../auth/auth.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateProfileResponseDto } from './dto/update-profile-response.dto';
import { ProfileService } from './profile.service';

/**
 * ProfileController handles user profile operations including profile picture upload
 *
 * Consistent with KYC patterns:
 * - Uses ProfileService for both profile data and file handling
 * - Security: Files are validated for type, size, and malicious content
 * - Returns bucket:objectPath format for database storage
 * - Frontend gets presigned URLs from ProfileService.findOne()
 *
 * Example usage:
 * ```
 * const formData = new FormData();
 * formData.append('name', 'John Doe'); // Optional text update
 * formData.append('profilePicture', file); // Optional file
 * ```
 */
@Controller()
@ApiTags('Profile')
@UseGuards(AuthGuard)
export class ProfileController {
  private readonly logger = new TelemetryLogger(ProfileController.name);

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
    const profilePictureFile = profilePicture;

    let profilePictureUrl: string | undefined;

    // Debug logging to check if file is received
    this.logger.log('Profile update request received', {
      userId: session.user.id,
      hasFile: !!profilePictureFile,
      fileInfo: profilePictureFile
        ? {
            originalName: profilePictureFile.originalname,
            mimeType: profilePictureFile.mimetype,
            size: profilePictureFile.size,
          }
        : null,
      updateData: updateProfileDto,
    });

    // If user uploaded a new profile picture, upload it first
    if (profilePictureFile) {
      // Upload file using ProfileService (merged from ProfileFileService)
      const uploadResult = await this.profileService.uploadProfilePicture(
        profilePictureFile.buffer,
        profilePictureFile.originalname,
        session.user.id,
        profilePictureFile.mimetype,
      );

      // Store bucket:objectPath format (consistent with KYC)
      profilePictureUrl = `${uploadResult.bucket}:${uploadResult.objectPath}`;

      this.logger.log('Profile picture uploaded successfully', {
        userId: session.user.id,
        objectPath: uploadResult.objectPath,
        fileSize: uploadResult.size,
        mimeType: profilePictureFile.mimetype,
        bucket: uploadResult.bucket,
      });
    }

    return this.auth.api.updateUser({
      headers,
      body: { name: updateProfileDto.name, image: profilePictureUrl },
    });
  }
}
