import { PartialType } from '@nestjs/mapped-types';

import { CreateKycIndividualDto } from './create-kyc-individual.dto';

export class UpdateKycIndividualDto extends PartialType(CreateKycIndividualDto) {}
