import { PartialType } from '@nestjs/swagger';

import { CreateProfileDto } from './create-profile.dto';

export class UpdateUserProfileDto extends PartialType(CreateProfileDto) {}
