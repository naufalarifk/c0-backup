import { Injectable } from '@nestjs/common';

@Injectable()
export class KycInstitutionService {
  getInstitutionKyc() {
    return { message: 'Get Institution KYC' };
  }

  createInstitutionKyc() {
    return { message: 'Create Institution KYC' };
  }
}
