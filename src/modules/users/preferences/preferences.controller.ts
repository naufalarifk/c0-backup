import type { UserSession } from '../../auth/types';

import { Body, Controller, Get, HttpException, HttpStatus, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { Session } from '../../auth/auth.decorator';
import { UserPreferencesDto } from './dto/user-preferences.dto';
import { PreferencesService } from './preferences.service';

@Controller()
@ApiTags('Preferences')
@Auth()
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
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

  @Put()
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
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Invalid preference values (theme, language, currency, or profile visibility)',
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
}
