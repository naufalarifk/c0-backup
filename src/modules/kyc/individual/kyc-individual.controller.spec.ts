import { Test, TestingModule } from '@nestjs/testing';

import { KycIndividualController } from './kyc-individual.controller';

describe('KycIndividualController', () => {
  let controller: KycIndividualController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycIndividualController],
    }).compile();

    controller = module.get<KycIndividualController>(KycIndividualController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
