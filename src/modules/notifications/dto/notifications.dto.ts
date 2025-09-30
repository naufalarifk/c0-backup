import type {
  NotificationItem,
  NotificationType,
  PaginationMeta,
  UserListsNotificationsParams,
  UserListsNotificationsResult,
} from '../../../shared/repositories/user.types';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { notificationTypes } from '../../../shared/repositories/user.types';

export class NotificationDto implements NotificationItem {
  @ApiProperty({
    description: 'Unique notification identifier',
    example: '123',
    type: 'string',
  })
  @IsNumber()
  id: string;

  @ApiProperty({
    description: 'Notification type matching database enum',
    enum: notificationTypes,
    example: 'LoanRepaymentDue',
  })
  @IsEnum(notificationTypes)
  type: NotificationType;

  @ApiProperty({
    description: 'Notification title/subject',
    example: 'Loan Repayment Due Tomorrow',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Notification body content',
    example: 'Your loan payment of $500 is due tomorrow. Please ensure sufficient balance.',
  })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  @IsBoolean()
  isRead: boolean;

  @ApiPropertyOptional({
    description: 'When the notification was read',
    type: 'string',
    format: 'date-time',
    nullable: true,
    example: null,
  })
  @IsOptional()
  @IsDateString()
  readDate?: Date;

  @ApiProperty({
    description: 'When the notification was created',
    type: 'string',
    format: 'date-time',
    example: '2024-03-15T10:30:00Z',
  })
  @IsDateString()
  createdAt: Date;
}

export class GetNotificationsQueryDto implements Omit<UserListsNotificationsParams, 'userId'> {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    type: 'integer',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of notifications per page (max 100)',
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by notification type',
    enum: notificationTypes,
    example: 'LoanRepaymentDue',
  })
  @IsOptional()
  @IsString()
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Filter to show only unread notifications',
    type: 'boolean',
    default: false,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean = false;
}

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({
    description: 'Current page number (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  limit: number;

  @ApiProperty({
    description: 'Total number of items across all pages',
    example: 150,
    minimum: 0,
  })
  @IsNumber()
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
    minimum: 0,
  })
  @IsNumber()
  totalPages: number;

  @ApiProperty({
    description: 'Whether there are more pages after current',
    example: true,
  })
  @IsBoolean()
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there are pages before current',
    example: false,
  })
  @IsBoolean()
  hasPrev: boolean;
}

export class GetNotificationsResponseDto implements UserListsNotificationsResult {
  @ApiProperty({
    description: 'List of user notifications',
    type: [NotificationDto],
  })
  @Type(() => NotificationDto)
  notifications: NotificationDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  @Type(() => PaginationMetaDto)
  pagination: PaginationMetaDto;

  @ApiProperty({
    description: 'Total count of unread notifications',
    example: 5,
  })
  @IsNumber()
  unreadCount: number;
}

export class MarkNotificationReadResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Notification marked as read',
  })
  @IsString()
  message: string;
}

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'All notifications marked as read',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Number of notifications that were updated',
    example: 12,
  })
  @IsNumber()
  updatedCount: number;
}

export class ArchiveNotificationResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Notification archived successfully',
  })
  @IsString()
  message: string;
}

export class DeleteNotificationResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Notification deleted successfully',
  })
  @IsString()
  message: string;
}

export class NotificationParamsDto {
  @ApiProperty({
    description: 'Notification ID',
    type: 'integer',
    format: 'int64',
    example: 456,
  })
  @Type(() => Number)
  @IsNumber()
  id: number;
}
