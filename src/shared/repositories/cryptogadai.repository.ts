import { FinanceRepository } from './finance-repository';

/**
 * CryptogadaiRepository <- AdminRepository <- LoanRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
export abstract class CryptogadaiRepository extends FinanceRepository {}
