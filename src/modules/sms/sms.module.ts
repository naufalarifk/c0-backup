import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';

@Module({
  imports: [SharedModule],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
