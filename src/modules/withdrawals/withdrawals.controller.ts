import type { UserSession } from '../auth/types';

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { Auth } from '../../decorators/auth.decorator';
import { Session } from '../auth/auth.decorator';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalDto } from './dto/update-withdrawal.dto';
import { WithdrawalsService } from './withdrawals.service';

@Controller('withdrawals')
@Auth()
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  create(@Session() session: UserSession, @Body() createWithdrawalDto: CreateWithdrawalDto) {
    return this.withdrawalsService.create(session.user.id, createWithdrawalDto);
  }

  @Get()
  findAll() {
    return this.withdrawalsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.withdrawalsService.findOne(+id);
  }

  @Post(':id/refund')
  refund(@Param('id') id: string, @Body() updateWithdrawalDto: UpdateWithdrawalDto) {
    return this.withdrawalsService.refund(+id, updateWithdrawalDto);
  }
}
