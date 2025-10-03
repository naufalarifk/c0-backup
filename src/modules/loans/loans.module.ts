import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { DocumentModule } from '../documents/document.module';
import { IndexerModule } from '../indexer/indexer.module';
import { LoanApplicationsController } from './controllers/loan-applications.controller';
import { LoanOffersController } from './controllers/loan-offers.controller';
import { LoansController } from './controllers/loans.controller';
import { LoanApplicationsService } from './services/loan-applications.service';
import { LoanCalculationService } from './services/loan-calculation.service';
import { LoanDocumentRequestService } from './services/loan-document-request.service';
import { LoanOffersService } from './services/loan-offers.service';
import { LoansService } from './services/loans.service';

@Module({
  imports: [
    SharedModule,
    DocumentModule,
    IndexerModule,
    BullModule.registerQueue({
      name: 'documentQueue',
    }),
  ],
  controllers: [LoanOffersController, LoanApplicationsController, LoansController],
  providers: [
    LoanOffersService,
    LoanApplicationsService,
    LoansService,
    LoanCalculationService,
    LoanDocumentRequestService,
  ],
  exports: [
    LoanOffersService,
    LoanApplicationsService,
    LoansService,
    LoanCalculationService,
    LoanDocumentRequestService,
  ],
})
export class LoansModule {}
