import { Injectable } from '@nestjs/common';

import { FinanceRepository } from './finance.repository';

/**
 * CryptogadaiRepository <- AdminRepository <- LoanRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
@Injectable()
export abstract class CryptogadaiRepository extends FinanceRepository {}
