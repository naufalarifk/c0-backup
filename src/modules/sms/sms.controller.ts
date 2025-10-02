import type { UserSession } from '../auth/types';

import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
import { Session } from '../auth/auth.decorator';
import { PushSenderService } from '../notifications/services/push-sender.service';
import { SmsService } from './sms.service';

@Controller('sms')
@Auth()
export class SmsController {
  constructor(
    private readonly smsService: SmsService,
    private readonly pushSender: PushSenderService,
  ) {}

  @Get(':phoneNumber')
  @ApiOperation({
    summary: 'Get verification code for testing',
    description:
      'Get the current verification code for a phone number - for testing/debugging only',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification code retrieved successfully',
  })
  getVerificationCode(@Param('phoneNumber') phoneNumber: string) {
    return this.smsService.getVerificationCode(phoneNumber);
  }

  @Get('test/push-notification')
  @ApiOperation({
    summary: 'Test push notification',
    description: 'Send a test push notification to the current user - for testing/debugging only',
  })
  @ApiResponse({
    status: 200,
    description: 'Push notification sent successfully',
  })
  async testPushNotification(@Session() session: UserSession) {
    await this.pushSender.sendNotification({
      userId: session.user.id,
      title: '🎉 Test Push Notification',
      body: 'Tap to open your profile. System berjalan dengan baik!',
      subtitle: 'Test Notification',
      data: {
        type: 'test',
        action: 'open_profile',
        targetScreen: '/(tabs)/profile',
        metadata: {
          timestamp: new Date().toISOString(),
          userId: session.user.id,
        },
      },
      priority: 'high',
      badge: 1,
      channelId: 'important', // Android channel
    });

    return {
      success: true,
      message: 'Push notification sent with navigation data',
      userId: session.user.id,
    };
  }
}
