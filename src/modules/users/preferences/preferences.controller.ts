import type { UserSession } from '../../auth/types';

import { Body, Controller, Get, HttpException, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { UserPreferencesDto } from './dto/user-preferences.dto';
import { PreferencesService } from './preferences.service';

@Controller()
@ApiTags('Preferences')
@UseGuards(AuthGuard)
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
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
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
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async updatePreferences(
    @Session() session: UserSession,
    @Body() preferences: UserPreferencesDto,
  ) {
    return await this.preferencesService.updatePreferences(session.user.id, preferences);
  }
}
