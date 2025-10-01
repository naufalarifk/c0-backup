import { ApiProperty } from '@nestjs/swagger';

import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

// Create Push Token
export class CreatePushTokenDto {
  @ApiProperty({
    description: 'Expo push token',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^ExponentPushToken\[.+\]$/, {
    message: 'Invalid Expo push token format',
  })
  pushToken: string;

  @ApiProperty({
    description: 'Persistent device ID from Expo Device API',
    example: '1A2B3C4D-5E6F-7G8H-9I0J-1K2L3M4N5O6P',
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({
    description: 'Device type',
    enum: ['ios', 'android'],
    example: 'ios',
  })
  @IsEnum(['ios', 'android'])
  @IsNotEmpty()
  deviceType: 'ios' | 'android';

  @ApiProperty({
    description: 'Human-readable device name',
    example: 'iPhone 15 Pro',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiProperty({
    description: 'Device model identifier',
    example: 'iPhone15,2',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceModel?: string;

  @ApiProperty({
    description: 'Current session ID from Better-Auth',
    example: 'session_abc123',
  })
  @IsString()
  @IsNotEmpty()
  currentSessionId: string;

  @ApiProperty({
    description: 'Token registration timestamp',
    example: '2025-10-01T10:30:00.000Z',
  })
  @IsString()
  @IsNotEmpty()
  registeredDate: string;
}

export class CreatePushTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: '123' })
  tokenId: string;

  @ApiProperty({ example: 'Token created successfully' })
  message: string;

  @ApiProperty({ example: true, description: 'True if new token, false if updated' })
  isNew: boolean;
}

// Delete Push Token (no DTO needed - uses session ID from auth)
export class DeletePushTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Push token deleted successfully' })
  message: string;

  @ApiProperty({ example: 1 })
  tokensDeleted: number;
}

// Update Push Token
export class UpdatePushTokenDto {
  @ApiProperty({
    description: 'Expo push token',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    required: false,
  })
  @IsString()
  @IsOptional()
  pushToken?: string;

  @ApiProperty({
    description: 'Device ID',
    example: '1A2B3C4D-5E6F-7G8H-9I0J-1K2L3M4N5O6P',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({
    description: 'Current session ID',
    example: 'session_abc123',
  })
  @IsString()
  @IsNotEmpty()
  currentSessionId: string;

  @ApiProperty({
    description: 'Last used timestamp',
    example: '2025-10-01T10:30:00.000Z',
  })
  @IsString()
  @IsNotEmpty()
  lastUsedDate: string;
}

export class UpdatePushTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 1 })
  tokensUpdated: number;
}

// List Push Tokens
export class ListPushTokensQueryDto {
  @ApiProperty({
    description: 'Filter to show only active tokens',
    required: false,
    type: 'boolean',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  activeOnly?: boolean;
}

export class PushTokenItemDto {
  @ApiProperty({ example: '123' })
  id: string;

  @ApiProperty({ example: 'ExponentPushToken[xxx]' })
  pushToken: string;

  @ApiProperty({ example: 'device_123', nullable: true })
  deviceId: string | null;

  @ApiProperty({ example: 'ios' })
  deviceType: 'ios' | 'android';

  @ApiProperty({ example: 'iPhone 15 Pro', required: false, nullable: true })
  deviceName?: string | null;

  @ApiProperty({ example: 'iPhone15,2', required: false, nullable: true })
  deviceModel?: string | null;

  @ApiProperty({ example: 'session_abc123', required: false, nullable: true })
  currentSessionId?: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-10-01T10:30:00.000Z' })
  lastUsedDate: string;
}

export class ListPushTokensResponseDto {
  @ApiProperty({ type: [PushTokenItemDto] })
  tokens: PushTokenItemDto[];
}

// Send Push Notification (Internal API)
export class SendPushNotificationDto {
  @ApiProperty({
    description: 'User ID to send notification to',
    example: '456',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Payment Due',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification body',
    example: 'Your loan payment is due tomorrow',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({
    description: 'Additional notification data',
    required: false,
    example: { type: 'payment_reminder', loanId: '789' },
  })
  @IsOptional()
  data?: Record<string, unknown>;

  @ApiProperty({
    description: 'Target device selection',
    enum: ['all', 'active_sessions', 'specific'],
    required: false,
    example: 'active_sessions',
  })
  @IsEnum(['all', 'active_sessions', 'specific'])
  @IsOptional()
  targetDevices?: 'all' | 'active_sessions' | 'specific';

  @ApiProperty({
    description: 'Specific device IDs to target (when targetDevices is "specific")',
    required: false,
    type: [String],
    example: ['device_123', 'device_456'],
  })
  @IsOptional()
  @IsString({ each: true })
  deviceIds?: string[];

  @ApiProperty({
    description: 'Notification priority',
    enum: ['high', 'normal'],
    required: false,
    example: 'high',
  })
  @IsEnum(['high', 'normal'])
  @IsOptional()
  priority?: 'high' | 'normal';
}

export class SendPushNotificationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 3 })
  sent: number;

  @ApiProperty({ example: 0 })
  failed: number;
}
