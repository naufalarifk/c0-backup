import type { DrizzleDB } from 'src/database';

import { Inject, Injectable } from '@nestjs/common';

import { UpdateLoanDto } from './dto/update-loan.dto';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DRIZZLE_DB } from 'src/shared/modules/database.module';
import { users } from 'src/database/schema';

@Injectable()
export class LoansService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  users() {
    return this.db.select().from(users);
  }

  create(createLoanDto: CreateLoanDto) {
    return 'This action adds a new loan';
  }

  findAll() {
    return `This action returns all loans`;
  }

  findOne(id: number) {
    return `This action returns a #${id} loan`;
  }

  update(id: number, updateLoanDto: UpdateLoanDto) {
    return `This action updates a #${id} loan`;
  }

  remove(id: number) {
    return `This action removes a #${id} loan`;
  }
}
