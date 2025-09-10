import { Test, TestingModule } from '@nestjs/testing';

import { KycIndividualService } from './kyc-individual.service';

describe('KycIndividualService', () => {
  let service: KycIndividualService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KycIndividualService],
    }).compile();

    service = module.get<KycIndividualService>(KycIndividualService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
