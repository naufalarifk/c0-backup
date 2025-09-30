import type { Request } from 'express';
import type {} from 'multer';
import type { UserViewsProfileResult } from '../../shared/types';
import type { UserSession } from '../auth/types';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Session } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { CreateCredentialProviderDto } from './dto/create-credential-provider.dto';
import { UpdatePushTokenDto } from './dto/push-token.dto';
import { SelectUserTypeDto } from './dto/select-user-type.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPreferencesDto } from './preferences/dto/user-preferences.dto';
import { PreferencesService } from './preferences/preferences.service';
import { UsersService } from './users.service';

@Controller()
@UseGuards(AuthGuard)
@ApiTags('Users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly preferencesService: PreferencesService,
  ) {}

  @Post('type-selection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set account type',
    description:
      'Allows a user to decide their account type (Individual or Institution). This decision can only be made once.',
    operationId: 'setUserType',
  })
  @ApiBody({
    type: SelectUserTypeDto,
    description: 'Account type selection data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account type has been successfully set',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid account type or account type already set',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not allowed to update this user',
  })
  async selectUserType(
    @Session() session: UserSession,
    @Body() selectUserTypeDto: SelectUserTypeDto,
  ) {
    const userId = session.user.id;
    const result = await this.usersService.setUserType(userId, selectUserTypeDto.userType);
    return result;
  }

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
    return this.usersService.addCredentialProvider(
      session.user.id,
      createCredentialProviderDto.password,
    );
  }

  @Get('provider-accounts')
  @ApiOperation({
    summary: 'Get all authentication provider accounts linked to the user',
    description:
      'Retrieves a list of all authentication providers associated with the user account',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of authentication provider accounts retrieved successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  getProviderAccounts(@Session() session: UserSession) {
    return this.usersService.getProviderAccounts(session.user.id);
  }

  @Get('institutions')
  @ApiOperation({
    summary: 'Get user institution memberships',
    description: "Retrieves the authenticated user's institution memberships",
  })
  @ApiResponse({
    status: 200,
    description: 'Institution memberships retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  async getInstitutionMemberships(@Session() session: UserSession) {
    // For now, return empty array for individual users
    return {
      memberships: [],
    };
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get user profile',
    description: "Retrieves the authenticated user's profile information",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
  })
  async getUserProfile(@Session() session: UserSession) {
    return this.usersService.getUserProfile(session.user.id);
  }

  @Put('profile')
  @UseInterceptors(FileInterceptor('profilePicture'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update user profile',
    description: "Updates the authenticated user's profile information",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    description: 'File too large',
  })
  async updateProfile(
    @Session() session: UserSession,
    @Req() req: Request,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() profilePicture?: Express.Multer.File,
  ) {
    // Validate content type for multipart form data
    const contentType = req.get('content-type') || '';
    if (contentType && !contentType.includes('multipart/form-data')) {
      throw new HttpException(
        {
          success: false,
          error: { message: 'Invalid content type. Expected multipart/form-data' },
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    // Validate file size (5MB limit)
    if (profilePicture && profilePicture.size > 5 * 1024 * 1024) {
      throw new HttpException(
        {
          success: false,
          error: { message: 'File too large' },
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // Validate file type
    if (
      profilePicture &&
      !['image/jpeg', 'image/png', 'image/gif'].includes(profilePicture.mimetype)
    ) {
      throw new HttpException(
        {
          success: false,
          error: { message: 'Invalid file type' },
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // For now, we'll skip file upload implementation and just update the profile
    // In a real implementation, you would upload the file to storage and get the URL
    const profilePictureUrl = profilePicture
      ? '/uploads/profile-pictures/placeholder.jpg'
      : undefined;

    return this.usersService.updateUserProfile(
      session.user.id,
      updateProfileDto,
      profilePictureUrl,
    );
  }

  @Get('preferences')
  @ApiOperation({
    summary: 'Get user preferences',
    description: "Retrieves the authenticated user's preferences",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences retrieved successfully',
  })
  async getPreferences(@Session() session: UserSession) {
    return this.preferencesService.getPreferences(session.user.id);
  }

  @Put('preferences')
  @ApiOperation({
    summary: 'Update user preferences',
    description: "Updates the authenticated user's preferences",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferences updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid preference values',
  })
  async updatePreferences(
    @Session() session: UserSession,
    @Body() preferences: UserPreferencesDto,
  ) {
    // Manual validation for theme
    if (preferences.display?.theme && !['light', 'dark'].includes(preferences.display.theme)) {
      throw new HttpException(
        {
          success: false,
          error: {
            message: 'Invalid theme value',
          },
          errors: {}, // This triggers the direct return path in GlobalExceptionFilter
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Manual validation for language
    if (preferences.display?.language && !['en', 'id'].includes(preferences.display.language)) {
      throw new HttpException(
        {
          success: false,
          error: {
            message: 'Unsupported language',
          },
          errors: {}, // This triggers the direct return path in GlobalExceptionFilter
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Manual validation for currency
    if (
      preferences.display?.currency &&
      !['USD', 'IDR', 'EUR', 'BTC', 'ETH'].includes(preferences.display.currency)
    ) {
      throw new HttpException(
        {
          success: false,
          error: {
            message: 'Invalid currency',
          },
          errors: {}, // This triggers the direct return path in GlobalExceptionFilter
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Manual validation for profile visibility
    if (
      preferences.privacy?.profileVisibility &&
      !['private', 'public'].includes(preferences.privacy.profileVisibility)
    ) {
      throw new HttpException(
        {
          success: false,
          error: {
            message: 'Invalid profile visibility',
          },
          errors: {}, // This triggers the direct return path in GlobalExceptionFilter
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return await this.preferencesService.updatePreferences(session.user.id, preferences);
  }

  @Post('push-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update push notification token',
    description: 'Allows users to update their push notification token for mobile notifications',
    operationId: 'updatePushToken',
  })
  @ApiBody({
    type: UpdatePushTokenDto,
    description: 'Push token update data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Push token updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid push token format',
  })
  async updatePushToken(
    @Session() session: UserSession,
    @Body() updatePushTokenDto: UpdatePushTokenDto,
  ) {
    return this.usersService.updatePushToken(session.user.id, updatePushTokenDto);
  }
}
