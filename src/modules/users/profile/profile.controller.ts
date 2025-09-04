import type { UserSession } from '../../auth/types';

import { Body, Controller, Get, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateProfileResponseDto } from './dto/update-profile-response.dto';
import { ProfileService } from './profile.service';

@Controller('users/profile')
@ApiTags('users')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

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
  @ApiOperation({
    summary: 'Update current user profile',
    description: "Updates the authenticated user's profile information",
  })
  @ApiBody({
    type: UpdateProfileDto,
    description: 'Profile update data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    type: UpdateProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request validation failed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  update(
    @Session() session: UserSession,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UpdateProfileResponseDto> {
    // Use session.user.id to ensure user can only update their own profile
    return this.profileService.update(session.user.id, updateProfileDto);
  }
}
