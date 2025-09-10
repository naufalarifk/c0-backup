import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { KycInstitutionService } from './kyc-institution.service';

@Controller('institution')
@ApiTags('KYC')
@Auth()
export class KycInstitutionController {
  constructor(private readonly kycKycInstitutionService: KycInstitutionService) {}

  @Get()
  getInstitutionKyc() {
    return this.kycKycInstitutionService.getInstitutionKyc();
  }

  @Post()
  createInstitutionKyc() {
    return this.kycKycInstitutionService.createInstitutionKyc();
  }
}
