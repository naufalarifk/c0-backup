import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { InvoiceExpirationModule } from '../modules/invoice-expiration/invoice-expiration.module';
import { NotificationModule } from '../modules/notifications/notification.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    ScheduleModule.forRoot(),
    SharedModule,
    NotificationModule,
    InvoiceExpirationModule,
  ],
})
export class InvoiceExpirationEntrypointModule {}
