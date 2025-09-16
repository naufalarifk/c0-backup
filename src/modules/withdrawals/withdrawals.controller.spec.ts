import { Test, TestingModule } from '@nestjs/testing';

import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

describe('WithdrawalsController', () => {
  let controller: WithdrawalsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WithdrawalsController],
      providers: [WithdrawalsService],
    }).compile();

    controller = module.get<WithdrawalsController>(WithdrawalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
