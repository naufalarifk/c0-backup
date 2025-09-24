import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
import { SmsService } from './sms.service';

@Controller('sms')
@Auth()
@ApiTags('SMS')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

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
}
