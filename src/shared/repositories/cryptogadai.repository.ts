import { Injectable } from '@nestjs/common';

import { LoanPlatformRepository } from './loan-platform.repository';

/**
 * CryptogadaiRepository <- LoanPlatformRepository <- LoanUserRepository <- LoanRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
@Injectable()
export abstract class CryptogadaiRepository extends LoanPlatformRepository {}
