import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { LoanApplicationsController } from './controllers/loan-applications.controller';
import { LoanOffersController } from './controllers/loan-offers.controller';
import { LoansController } from './controllers/loans.controller';
import { LoanApplicationsService } from './services/loan-applications.service';
import { LoanOffersService } from './services/loan-offers.service';
import { LoansService } from './services/loans.service';

@Module({
  imports: [SharedModule],
  controllers: [LoanOffersController, LoanApplicationsController, LoansController],
  providers: [LoanOffersService, LoanApplicationsService, LoansService],
  exports: [LoanOffersService, LoanApplicationsService, LoansService],
})
export class LoansModule {}
