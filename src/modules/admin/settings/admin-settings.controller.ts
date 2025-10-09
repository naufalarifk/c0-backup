import type { UserSession } from '../../auth/types';

import { Body, Controller, Get, Put, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { validationOptions } from '../../../shared/utils/validation-options.js';
import { Session } from '../../auth/auth.decorator';
import { AdminSettingsService } from './admin-settings.service';
import {
  PlatformConfigResponseDto,
  PlatformConfigUpdateDto,
  PlatformConfigUpdateResponseDto,
} from './dto/admin-settings.dto';

@Controller('admin/settings')
@ApiTags('Admin - Platform Configuration')
@Auth(['Admin'])
export class AdminSettingsController {
  private readonly logger = new TelemetryLogger(AdminSettingsController.name);

  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current platform configuration',
    description: 'Retrieve current configurable platform settings for admin dashboard.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform configuration retrieved successfully',
    type: PlatformConfigResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  async getPlatformConfig(): Promise<PlatformConfigResponseDto> {
    try {
      this.logger.log('Getting platform configuration');
      const config = await this.adminSettingsService.getPlatformConfig();
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error('Failed to get platform configuration', { error: error.message });
      throw error;
    }
  }

  @Put()
  @ApiOperation({
    summary: 'Update platform configuration',
    description: 'Update platform configuration settings from admin dashboard.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform configuration updated successfully',
    type: PlatformConfigUpdateResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  async updatePlatformConfig(
    @Session() session: UserSession,
    @Body(new ValidationPipe(validationOptions)) updateData: PlatformConfigUpdateDto,
  ): Promise<PlatformConfigUpdateResponseDto> {
    try {
      this.logger.log('Updating platform configuration', {
        adminId: session.user.id,
        updateData,
      });

      const config = await this.adminSettingsService.updatePlatformConfig(
        session.user.id,
        updateData,
      );

      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error('Failed to update platform configuration', {
        error: error.message,
        adminId: session.user.id,
      });
      throw error;
    }
  }
}
