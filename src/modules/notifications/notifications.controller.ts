import type { UserSession } from '../auth/types';

import { Controller, Delete, Get, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
import { Session } from '../auth/auth.decorator';
import {
  ArchiveNotificationResponseDto,
  DeleteNotificationResponseDto,
  GetNotificationsQueryDto,
  GetNotificationsResponseDto,
  MarkAllNotificationsReadResponseDto,
  MarkNotificationReadResponseDto,
  NotificationParamsDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Auth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Retrieve paginated list of notifications for the authenticated user with optional filtering',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of notifications per page (max 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by notification type',
    example: 'LoanRepaymentDue',
  })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    description: 'Filter to show only unread notifications',
    type: 'boolean',
    example: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications retrieved successfully',
    type: GetNotificationsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters',
  })
  findAll(
    @Session() session: UserSession,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<GetNotificationsResponseDto> {
    return this.notificationsService.findAll(session.user.id, query);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Mark a specific notification as read for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '47',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification marked as read successfully',
    type: MarkNotificationReadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found or does not belong to user',
  })

  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Notification already read or invalid status',
  })
  read(
    @Session() session: UserSession,
    @Param() params: NotificationParamsDto,
  ): Promise<MarkNotificationReadResponseDto> {
    return this.notificationsService.read(session.user.id, params.id);
  }

  @Patch('read')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications as read for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All notifications marked as read successfully',
    type: MarkAllNotificationsReadResponseDto,
  })
  readAll(@Session() session: UserSession): Promise<MarkAllNotificationsReadResponseDto> {
    return this.notificationsService.readAll(session.user.id);
  }

  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Archive notification',
    description: 'Archive a specific notification for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '47',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification archived successfully',
    type: ArchiveNotificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found or does not belong to user',
  })

  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Notification already archived or invalid status',
  })
  archive(
    @Session() session: UserSession,
    @Param() params: NotificationParamsDto,
  ): Promise<ArchiveNotificationResponseDto> {
    return this.notificationsService.archive(session.user.id, params.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Permanently delete a specific notification for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '47',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification deleted successfully',
    type: DeleteNotificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Notification not found or does not belong to user',
  })
  remove(
    @Session() session: UserSession,
    @Param() params: NotificationParamsDto,
  ): Promise<DeleteNotificationResponseDto> {
    return this.notificationsService.remove(session.user.id, params.id);
  }
}
