import type { UserSession } from '../../auth/types';

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { Session } from '../../auth/auth.decorator';
import {
  CreateRealtimeAuthTokenDto,
  CreateRealtimeAuthTokenResponseDto,
} from '../dto/create-realtime-auth-token.dto';
import { RealtimeAuthTokensService } from '../services/realtime-auth-tokens.service';

@Auth()
@ApiTags('Realtime')
@Controller('realtime-auth-tokens')
export class RealtimeAuthTokensController {
  constructor(private readonly authTokensService: RealtimeAuthTokensService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create realtime websocket access token',
    description:
      'Returns a short-lived access token used to authenticate realtime websocket connections.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: CreateRealtimeAuthTokenResponseDto,
    description: 'Realtime access token issued successfully',
  })
  async createRealtimeAuthToken(
    @Session() session: UserSession,
    @Body() dto: CreateRealtimeAuthTokenDto,
  ): Promise<CreateRealtimeAuthTokenResponseDto> {
    const result = await this.authTokensService.createToken(
      session.user.id,
      session.session.id,
      dto.events,
    );

    return {
      token: result.token,
      expiresAt: result.expiresAt,
      expiresIn: result.expiresIn,
      allowedEventTypes: result.allowedEventTypes,
    };
  }
}
