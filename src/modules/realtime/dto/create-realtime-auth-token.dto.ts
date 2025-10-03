import { ApiProperty } from '@nestjs/swagger';

import { IsArray, IsEnum, IsOptional } from 'class-validator';

import { type RealtimeEventType, RealtimeEventTypeEnum } from '../realtime.types';

export class CreateRealtimeAuthTokenDto {
  @ApiProperty({
    type: [String],
    required: false,
    description: 'Initial realtime event subscriptions permitted by the access token',
    enum: Object.values(RealtimeEventTypeEnum),
  })
  @IsOptional()
  @IsArray()
  @IsEnum(RealtimeEventTypeEnum, { each: true })
  events?: RealtimeEventType[];
}

export class CreateRealtimeAuthTokenResponseDto {
  @ApiProperty({ description: 'Opaque realtime websocket access token' })
  token!: string;

  @ApiProperty({ description: 'ISO timestamp when the token expires' })
  expiresAt!: string;

  @ApiProperty({ description: 'Seconds until the token expires' })
  expiresIn!: number;

  @ApiProperty({
    type: [String],
    description: 'Realtime event types permitted by this token',
    enum: Object.values(RealtimeEventTypeEnum),
  })
  allowedEventTypes!: RealtimeEventType[];
}
