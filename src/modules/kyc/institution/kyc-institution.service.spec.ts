import { Test, TestingModule } from '@nestjs/testing';

import { KycInstitutionService } from './kyc-institution.service';

describe('KycInstitutionService', () => {
  let service: KycInstitutionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KycInstitutionService],
    }).compile();

    service = module.get<KycInstitutionService>(KycInstitutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
