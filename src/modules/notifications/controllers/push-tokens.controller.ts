import type { UserSession } from '../../auth/types';

import { Body, Controller, Delete, Get, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { Session } from '../../auth/auth.decorator';
import {
  CreatePushTokenDto,
  CreatePushTokenResponseDto,
  DeletePushTokenResponseDto,
  ListPushTokensQueryDto,
  ListPushTokensResponseDto,
  UpdatePushTokenDto,
  UpdatePushTokenResponseDto,
} from '../dto/push-tokens.dto';
import { PushTokensService } from '../services/push-tokens.service';

@Auth()
@ApiTags('Push Tokens')
@Controller('notifications/push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post()
  @ApiOperation({
    summary: 'Create push token',
    description:
      'Register or update push notification token for current device and session. Uses UPSERT strategy.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Push token created successfully',
    type: CreatePushTokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid push token format or missing required fields',
  })
  createToken(
    @Session() session: UserSession,
    @Body() dto: CreatePushTokenDto,
  ): Promise<CreatePushTokenResponseDto> {
    return this.pushTokensService.createToken(session.user.id, dto);
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete push token',
    description: 'Unregister push token for current session (soft cleanup - nullifies session ID)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Push token deleted successfully',
    type: DeletePushTokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No active push token found for this session',
  })
  deleteToken(@Session() session: UserSession): Promise<DeletePushTokenResponseDto> {
    return this.pushTokensService.deleteToken(session.user.id, session.session.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update push token',
    description: 'Update last_used_date and current_session_id for existing push token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Push token updated successfully',
    type: UpdatePushTokenResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Push token not found for this user',
  })
  updateToken(
    @Session() session: UserSession,
    @Body() dto: UpdatePushTokenDto,
  ): Promise<UpdatePushTokenResponseDto> {
    return this.pushTokensService.updateToken(session.user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List push tokens',
    description: 'Get all registered push tokens for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Push tokens retrieved successfully',
    type: ListPushTokensResponseDto,
  })
  listTokens(
    @Session() session: UserSession,
    @Query() query: ListPushTokensQueryDto,
  ): Promise<ListPushTokensResponseDto> {
    return this.pushTokensService.listUserTokens(session.user.id, query);
  }
}
