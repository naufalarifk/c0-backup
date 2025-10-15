import { Injectable } from '@nestjs/common';

import { SettlementPlatformRepository } from './settlement-platform.repository';

/**
 * CryptogadaiRepository <- SettlementPlatformRepository <- LoanPlatformRepository <- LoanUserRepository <- LoanBorrowerRepository <- LoanLenderRepository <- LoanTestRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
@Injectable()
export abstract class CryptogadaiRepository extends SettlementPlatformRepository {}
