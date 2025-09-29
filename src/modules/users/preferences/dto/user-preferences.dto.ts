import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, ValidateNested } from 'class-validator';

export enum Theme {
  light = 'light',
  dark = 'dark',
}

export enum Language {
  en = 'en',
  id = 'id',
}

export enum Currency {
  USD = 'USD',
  IDR = 'IDR',
  EUR = 'EUR',
  BTC = 'BTC',
  ETH = 'ETH',
}

export enum ProfileVisibility {
  private = 'private',
  public = 'public',
}

export class NotificationTypes {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  paymentAlerts?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  systemNotifications?: boolean;
}

export class EmailNotifications {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => NotificationTypes)
  @IsOptional()
  types?: NotificationTypes;
}

export class PushNotifications {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => NotificationTypes)
  @IsOptional()
  types?: NotificationTypes;
}

export class SmsNotifications {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => NotificationTypes)
  @IsOptional()
  types?: NotificationTypes;
}

export class Notifications {
  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => EmailNotifications)
  @IsOptional()
  email?: EmailNotifications;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => PushNotifications)
  @IsOptional()
  push?: PushNotifications;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => SmsNotifications)
  @IsOptional()
  sms?: SmsNotifications;
}

export class Display {
  @ApiProperty({ enum: Theme, required: false })
  @IsOptional()
  @IsEnum(Theme)
  theme?: string;

  @ApiProperty({ enum: Language, required: false })
  @IsOptional()
  @IsEnum(Language)
  language?: string;

  @ApiProperty({ enum: Currency, required: false })
  @IsOptional()
  @IsEnum(Currency)
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  dateFormat?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  numberFormat?: string;
}

export class DataSharing {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  analytics?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  thirdPartyIntegrations?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  marketResearch?: boolean;
}

export class Privacy {
  @ApiProperty({ enum: ProfileVisibility, required: false })
  @IsOptional()
  @IsEnum(ProfileVisibility)
  profileVisibility?: string;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => DataSharing)
  @IsOptional()
  dataSharing?: DataSharing;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  activityTracking?: boolean;
}

export class UserPreferencesDto {
  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => Notifications)
  @IsOptional()
  notifications?: Notifications;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => Display)
  @IsOptional()
  display?: Display;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => Privacy)
  @IsOptional()
  privacy?: Privacy;
}
