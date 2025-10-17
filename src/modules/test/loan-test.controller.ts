import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';

import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isNumber,
  isString,
} from 'typeshaper';

import { Auth } from '../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { LoansService } from '../loans/services/loans.service';
import { NotificationQueueService } from '../notifications/notification-queue.service';

@Controller('test')
@Auth({ public: true })
export class LoanTestController {
  #logger = new TelemetryLogger(LoanTestController.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly repo: CryptogadaiRepository,
    private readonly loansService: LoansService,
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  @Post('loan-offers/:loanOfferId/funding-invoice/mark-paid')
  async markLoanOfferFundingInvoicePaid(
    @Param('loanOfferId') loanOfferId: string,
    @Body()
    body: {
      amount?: string;
      paymentHash?: string;
      paymentDate?: string;
      invoiceId?: string;
    },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    if (!loanOfferId) {
      throw new BadRequestException('loanOfferId is required');
    }

    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();

    const { invoiceId, amount, paymentHash } = await this.repo.testPaysLoanOfferFundingInvoice({
      loanOfferId,
      paymentDate,
      amount: body.amount,
      paymentHash: body.paymentHash,
    });

    if (body.invoiceId && body.invoiceId !== invoiceId) {
      throw new ConflictException(
        `Provided invoiceId ${body.invoiceId} does not match funding invoice ${invoiceId}`,
      );
    }

    await this.repo.testPublishesLoanOffer({
      loanOfferId,
      publishedDate: paymentDate,
    });

    // Note: Loan matching will be triggered automatically by the hourly cron scheduler
    // or can be manually triggered via admin API at /admin/loan-matcher/trigger
    this.#logger.log(`Loan offer ${loanOfferId} published - will be matched by scheduler`);

    return {
      success: true,
      message: `Marked invoice ${invoiceId} as paid for loan offer ${loanOfferId}`,
      invoiceId,
      loanOfferId,
      amount,
      paymentHash,
      paymentDate: paymentDate.toISOString(),
    };
  }

  @Post('loan-offers/:loanOfferId/normalize-amounts')
  async normalizeLoanOfferAmounts(@Param('loanOfferId') loanOfferId: string) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    if (!loanOfferId) {
      throw new BadRequestException('loanOfferId is required');
    }

    const result = await this.repo.testNormalizesLoanOfferAmounts({ loanOfferId });

    return {
      success: true,
      data: result,
    };
  }

  @Get('loan-offers/:loanOfferId')
  async getLoanOfferStatus(@Param('loanOfferId') loanOfferId: string) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    if (!loanOfferId) {
      throw new BadRequestException('loanOfferId is required');
    }

    const rows = await this.repo.sql`
			SELECT
				id,
				status,
				offered_principal_amount,
				disbursed_principal_amount,
				reserved_principal_amount,
				available_principal_amount,
				published_date
			FROM loan_offers
			WHERE id = ${loanOfferId}
		`;

    if (rows.length === 0) {
      throw new NotFoundException(`Loan offer ${loanOfferId} not found`);
    }

    const [row] = rows as Array<{
      id: string | number;
      status: string;
      offered_principal_amount: string | number;
      disbursed_principal_amount: string | number;
      reserved_principal_amount: string | number;
      available_principal_amount: string | number;
      published_date: Date | null;
    }>;
    assertDefined(row);
    assertProp(check(isString, isNumber), row, 'id');
    assertPropString(row, 'status');
    assertProp(check(isString, isNumber), row, 'offered_principal_amount');
    assertProp(check(isString, isNumber), row, 'disbursed_principal_amount');
    assertProp(check(isString, isNumber), row, 'reserved_principal_amount');
    assertProp(check(isString, isNumber), row, 'available_principal_amount');

    return {
      success: true,
      data: {
        id: String(row.id),
        status: row.status,
        offeredPrincipalAmount: String(row.offered_principal_amount),
        disbursedPrincipalAmount: String(row.disbursed_principal_amount),
        reservedPrincipalAmount: String(row.reserved_principal_amount),
        availablePrincipalAmount: String(row.available_principal_amount),
        publishedDate:
          row.published_date instanceof Date ? row.published_date.toISOString() : undefined,
      },
    };
  }

  @Post('loan-applications/:loanApplicationId/normalize-amounts')
  async normalizeLoanApplicationAmounts(@Param('loanApplicationId') loanApplicationId: string) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    if (!loanApplicationId) {
      throw new BadRequestException('loanApplicationId is required');
    }

    const result = await this.repo.testNormalizesLoanApplicationAmounts({ loanApplicationId });

    return {
      success: true,
      data: result,
    };
  }

  @Post('loan-applications/:loanApplicationId/collateral-invoice/mark-paid')
  async markLoanApplicationCollateralInvoicePaid(
    @Param('loanApplicationId') loanApplicationId: string,
    @Body()
    body: {
      amount?: string;
      paymentHash?: string;
      paymentDate?: string;
      invoiceId?: string;
    },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    if (!loanApplicationId) {
      throw new BadRequestException('loanApplicationId is required');
    }

    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();

    const { invoiceId, amount, paymentHash } =
      await this.repo.testPaysLoanApplicationCollateralInvoice({
        loanApplicationId,
        paymentDate,
        amount: body.amount,
        paymentHash: body.paymentHash,
      });

    if (body.invoiceId && body.invoiceId !== invoiceId) {
      throw new ConflictException(
        `Provided invoiceId ${body.invoiceId} does not match collateral invoice ${invoiceId}`,
      );
    }

    await this.repo.testPublishesLoanApplication({
      loanApplicationId,
      publishedDate: paymentDate,
    });

    // Note: Loan matching will be triggered automatically by the hourly cron scheduler
    // or can be manually triggered via admin API at /admin/loan-matcher/trigger
    this.#logger.log(
      `Loan application ${loanApplicationId} published - will be matched by scheduler`,
    );

    return {
      success: true,
      message: `Marked collateral invoice ${invoiceId} as paid for loan application ${loanApplicationId}`,
      invoiceId,
      loanApplicationId,
      amount,
      paymentHash,
      paymentDate: paymentDate.toISOString(),
    };
  }

  @Get('loan-applications/:loanApplicationId')
  async getLoanApplicationStatus(@Param('loanApplicationId') loanApplicationId: string) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    if (!loanApplicationId) {
      throw new BadRequestException('loanApplicationId is required');
    }

    const rows = await this.repo.sql`
			SELECT
				id,
				status,
				principal_amount,
				collateral_prepaid_amount,
				matched_collateral_valuation_amount,
				matched_ltv_ratio,
				matched_loan_offer_id,
				published_date
			FROM loan_applications
			WHERE id = ${loanApplicationId}
		`;

    if (rows.length === 0) {
      throw new NotFoundException(`Loan application ${loanApplicationId} not found`);
    }

    const [row] = rows as Array<{
      id: string | number;
      status: string;
      principal_amount: string | number;
      collateral_prepaid_amount: string | number | null;
      matched_collateral_valuation_amount: string | number | null;
      matched_ltv_ratio: number | null;
      matched_loan_offer_id: string | number | null;
      published_date: Date | null;
    }>;
    assertDefined(row);
    assertProp(check(isString, isNumber), row, 'id');
    assertPropString(row, 'status');
    assertProp(check(isString, isNumber), row, 'principal_amount');

    return {
      success: true,
      data: {
        id: String(row.id),
        status: row.status,
        principalAmount: String(row.principal_amount),
        collateralPrepaidAmount: row.collateral_prepaid_amount
          ? String(row.collateral_prepaid_amount)
          : undefined,
        matchedCollateralValuationAmount: row.matched_collateral_valuation_amount
          ? String(row.matched_collateral_valuation_amount)
          : undefined,
        matchedLtvRatio:
          typeof row.matched_ltv_ratio === 'number' ? row.matched_ltv_ratio : undefined,
        matchedLoanOfferId: row.matched_loan_offer_id
          ? String(row.matched_loan_offer_id)
          : undefined,
        publishedDate:
          row.published_date instanceof Date ? row.published_date.toISOString() : undefined,
      },
    };
  }

  @Post('loans/match-and-originate')
  async matchAndOriginateLoan(
    @Body()
    body: {
      loanOfferId?: string;
      loanApplicationId?: string;
      matchedLtvRatio?: number;
      matchedCollateralValuationAmount?: string;
      matchedDate?: string;
      principalAmount?: string;
      interestAmount?: string;
      repaymentAmount?: string;
      redeliveryFeeAmount?: string;
      redeliveryAmount?: string;
      premiAmount?: string;
      liquidationFeeAmount?: string;
      minCollateralValuation?: string;
      mcLtvRatio?: number;
      collateralAmount?: string;
      originationDate?: string;
      maturityDate?: string;
    },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    const {
      loanOfferId,
      loanApplicationId,
      matchedLtvRatio,
      matchedCollateralValuationAmount,
      matchedDate,
      principalAmount,
      interestAmount,
      repaymentAmount,
      redeliveryFeeAmount,
      redeliveryAmount,
      premiAmount,
      liquidationFeeAmount,
      minCollateralValuation,
      mcLtvRatio,
      collateralAmount,
      originationDate,
      maturityDate,
    } = body;

    if (!loanOfferId) {
      throw new BadRequestException('loanOfferId is required');
    }

    if (!loanApplicationId) {
      throw new BadRequestException('loanApplicationId is required');
    }

    if (typeof matchedLtvRatio !== 'number') {
      throw new BadRequestException('matchedLtvRatio must be a number');
    }

    if (!matchedCollateralValuationAmount) {
      throw new BadRequestException('matchedCollateralValuationAmount is required');
    }

    const requiredAmounts = {
      principalAmount,
      interestAmount,
      repaymentAmount,
      redeliveryFeeAmount,
      redeliveryAmount,
      premiAmount,
      liquidationFeeAmount,
      minCollateralValuation,
      collateralAmount,
    } as const;

    for (const [key, value] of Object.entries(requiredAmounts)) {
      if (!value) {
        throw new BadRequestException(`${key} is required`);
      }
    }

    const matchedDateValue = matchedDate ? new Date(matchedDate) : new Date();
    const originationDateValue = originationDate ? new Date(originationDate) : new Date();
    const maturityDateValue = maturityDate ? new Date(maturityDate) : new Date();

    const ensuredPrincipalAmount = principalAmount as string;
    const ensuredInterestAmount = interestAmount as string;
    const ensuredRepaymentAmount = repaymentAmount as string;
    const ensuredRedeliveryFeeAmount = redeliveryFeeAmount as string;
    const ensuredRedeliveryAmount = redeliveryAmount as string;
    const ensuredPremiAmount = premiAmount as string;
    const ensuredLiquidationFeeAmount = liquidationFeeAmount as string;
    const ensuredMinCollateralValuation = minCollateralValuation as string;
    const ensuredCollateralAmount = collateralAmount as string;

    const detailRows = await this.repo.sql`
			SELECT
				la.id as app_id,
				la.borrower_user_id,
				la.principal_amount,
				la.term_in_months,
				lo.id as offer_id,
				lo.lender_user_id,
				lo.interest_rate
			FROM loan_applications la
			JOIN loan_offers lo ON lo.id = ${loanOfferId}
			WHERE la.id = ${loanApplicationId}
		`;

    if (detailRows.length === 0) {
      throw new BadRequestException('Loan application or offer not found');
    }

    const details = detailRows[0];
    assertDefined(details);
    assertProp(check(isString, isNumber), details, 'borrower_user_id');
    assertProp(check(isString, isNumber), details, 'lender_user_id');
    assertProp(check(isString, isNumber), details, 'principal_amount');
    assertProp(check(isString, isNumber), details, 'interest_rate');
    assertProp(check(isString, isNumber), details, 'term_in_months');

    const matchResult = await this.repo.platformMatchesLoanOffers({
      loanOfferId,
      loanApplicationId,
      matchedLtvRatio,
      matchedCollateralValuationAmount,
      matchedDate: matchedDateValue,
    });

    await this.notificationQueueService.queueNotification({
      type: 'LoanApplicationMatched',
      userId: String(details.borrower_user_id),
      loanApplicationId,
      loanOfferId,
      principalAmount: String(details.principal_amount),
      interestRate: String(details.interest_rate),
      termInMonths: String(details.term_in_months),
      matchedDate: matchedDateValue.toISOString(),
    });

    await this.notificationQueueService.queueNotification({
      type: 'LoanOfferMatched',
      userId: String(details.lender_user_id),
      loanApplicationId,
      loanOfferId,
      amount: String(details.principal_amount),
      interestRate: String(details.interest_rate),
      term: `${details.term_in_months} months`,
    });

    const originationResult = await this.loansService.originateLoan({
      loanOfferId,
      loanApplicationId,
      principalAmount: ensuredPrincipalAmount,
      interestAmount: ensuredInterestAmount,
      repaymentAmount: ensuredRepaymentAmount,
      redeliveryFeeAmount: ensuredRedeliveryFeeAmount,
      redeliveryAmount: ensuredRedeliveryAmount,
      premiAmount: ensuredPremiAmount,
      liquidationFeeAmount: ensuredLiquidationFeeAmount,
      minCollateralValuation: ensuredMinCollateralValuation,
      mcLtvRatio: mcLtvRatio ?? matchedLtvRatio,
      collateralAmount: ensuredCollateralAmount,
      originationDate: originationDateValue,
      maturityDate: maturityDateValue,
    });

    return {
      success: true,
      matchResult,
      loanId: originationResult.loanId,
    };
  }

  @Get('loans/:loanId/documents')
  async getLoanDocuments(@Param('loanId') loanId: string) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    if (!loanId) {
      throw new BadRequestException('loanId is required');
    }

    const rows = await this.repo.sql`
			SELECT
				id,
				loan_id,
				document_type,
				status AS generation_status,
				CASE WHEN status = 'Completed' THEN false ELSE true END AS signature_required,
				created_at
			FROM loan_documents
			WHERE loan_id = ${loanId}
			ORDER BY created_at DESC
		`;

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'loan_id');
      assertPropString(row, 'document_type');
      assertPropString(row, 'generation_status');
      return row;
    });

    const typedRows = rows as Array<{
      id: string | number;
      loan_id: string | number;
      document_type: string;
      generation_status: string;
      signature_required?: boolean | null;
    }>;

    const documents = typedRows.map(row => ({
      id: String(row.id),
      loanId: String(row.loan_id),
      documentType: row.document_type,
      generationStatus: row.generation_status,
      signatureRequired: Boolean(row.signature_required),
    }));

    return {
      success: true,
      documents,
    };
  }

  @Post('trigger-loan-matching')
  async triggerLoanMatching(
    @Body()
    body: { targetApplicationId?: string; targetOfferId?: string; batchSize?: number },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    const { targetApplicationId, targetOfferId, batchSize = 50 } = body;

    // NOTE: This test endpoint is deprecated.
    // Loan matching is now handled by the cron scheduler (runs hourly)
    // or can be manually triggered via admin API at /admin/loan-matcher/trigger
    //
    // The queue-based approach has been replaced with a scheduler-based approach
    // for consistency with the settlement module.

    this.#logger.log(
      'Loan matching trigger test endpoint called - matching is now handled by scheduler',
    );

    return {
      success: false,
      message:
        'This endpoint is deprecated. Use /admin/loan-matcher/trigger for manual matching or wait for the hourly cron job.',
      note: 'Loan matching runs automatically every hour via cron scheduler',
      adminEndpoint: '/admin/loan-matcher/trigger',
    };
  }
}
