import { Test, TestingModule } from '@nestjs/testing';

import { KycInstitutionController } from './kyc-institution.controller';

describe('KycInstitutionController', () => {
  let controller: KycInstitutionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycInstitutionController],
    }).compile();

    controller = module.get<KycInstitutionController>(KycInstitutionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
