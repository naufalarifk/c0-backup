import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
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

import { LoansService } from '../modules/loans/services/loans.service';
import { CryptogadaiRepository } from './repositories/cryptogadai.repository';
import { CgTestnetBlockchainEventService } from './services/cg-testnet-blockchain-event.service';
import { TelemetryLogger } from './telemetry.logger';

@Controller('test')
export class TestController {
  #logger = new TelemetryLogger(TestController.name);

  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly loansService: LoansService,
    private readonly testBlockchainEvents: CgTestnetBlockchainEventService,
  ) {}

  @Get('test')
  getTest() {
    if (Math.random() < 0.2) {
      throw new Error('Random test error occurred');
    }

    const pendingKycs = this.repo.adminViewsPendingKYCs();

    this.#logger.debug(`Pending KYCs:`, pendingKycs);

    return {
      status: 'ok',
      message: 'This endpoint is expected to have 20% chance of error',
    };
  }

  @Put('assign-admin-role')
  async assignAdminRole(@Body() body: { userId: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { userId } = body;

    if (!userId) {
      throw new Error('userId is required');
    }

    await this.repo.sql`
      UPDATE users
      SET role = 'Admin'
      WHERE id = ${userId}
    `;

    this.#logger.debug(`Assigned admin role to user ${userId}`);

    return {
      success: true,
      message: `User ${userId} has been assigned admin role`,
    };
  }

  @Post('create-test-users')
  async createTestUsers(
    @Body() body: { users: Array<{ email: string; name: string; role?: string }> },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { users } = body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      throw new Error('users array is required');
    }

    const result = await this.repo.testCreatesUsers({ users });

    this.#logger.debug(`Created ${result.users.length} test users`);

    return {
      success: true,
      message: `Created ${result.users.length} test users`,
      users: result.users,
    };
  }

  @Get('test-admin-view-pending-kycs')
  async viewPendingKycs() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const pendingKycs = await this.repo.adminViewsPendingKYCs();

    this.#logger.debug(`Pending KYCs:`, pendingKycs);

    return {
      success: true,
      pendingKycs,
    };
  }

  @Post('test-admin-kyc-approve-by-email')
  async approveKycByEmail(@Body() body: { email: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email } = body;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }

    // Find latest pending KYC for the user with this email
    const rows = await this.repo.sql`
      SELECT uk.id, uk.status, uk.user_id
      FROM user_kycs uk
      JOIN users u ON uk.user_id = u.id
      WHERE u.email = ${email}
        AND uk.verified_date IS NULL
        AND uk.rejected_date IS NULL
      ORDER BY uk.submitted_date DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException(`No pending KYC found for email ${email}`);
    }

    const kyc = rows[0];
    assertDefined(kyc);
    assertProp(check(isString, isNumber), kyc, 'id');
    assertProp(check(isString, isNumber), kyc, 'user_id');

    // Approve the KYC
    await this.repo.adminApprovesKyc({
      approvalDate: new Date(),
      kycId: String(kyc.id),
      verifierUserId: '1',
    });

    this.#logger.debug(`Approved KYC ${kyc.id} for user ${kyc.user_id}`);

    return {
      success: true,
      message: `KYC ${kyc.id} for ${email} has been approved`,
      kycId: Number(kyc.id),
      processingAdmin: 'test-admin',
    };
  }

  @Post('test-admin-kyc-reject-by-email')
  async rejectKycByEmail(@Body() body: { email: string; reason: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email, reason } = body;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      throw new BadRequestException('Rejection reason must be at least 10 characters long');
    }

    // Find latest pending KYC for the user with this email
    const rows = await this.repo.sql`
      SELECT uk.id, uk.status, uk.user_id
      FROM user_kycs uk
      JOIN users u ON uk.user_id = u.id
      WHERE u.email = ${email}
        AND uk.verified_date IS NULL
        AND uk.rejected_date IS NULL
      ORDER BY uk.submitted_date DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException(`No pending KYC found for email ${email}`);
    }

    const kyc = rows[0];
    assertDefined(kyc);
    assertProp(check(isString, isNumber), kyc, 'id');
    assertProp(check(isString, isNumber), kyc, 'user_id');

    // Reject the KYC
    await this.repo.adminRejectsKyc({
      rejectionDate: new Date(),
      rejectionReason: reason,
      kycId: String(kyc.id),
      verifierUserId: '1',
    });

    this.#logger.debug(`Rejected KYC ${kyc.id} for user ${kyc.user_id} with reason: ${reason}`);

    return {
      success: true,
      message: `KYC ${kyc.id} for ${email} has been rejected`,
      kycId: Number(kyc.id),
      processingAdmin: 'test-admin',
    };
  }

  @Post('test-admin-institution-approve-by-email')
  async approveInstitutionByEmail(@Body() body: { email: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email } = body;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }

    // Find latest pending institution application for the user with this email
    const rows = await this.repo.sql`
      SELECT ia.id, ia.status, ia.applicant_user_id, u.id as user_id
      FROM institution_applications ia
      JOIN users u ON ia.applicant_user_id = u.id
      WHERE u.email = ${email}
        AND ia.verified_date IS NULL
        AND ia.rejected_date IS NULL
      ORDER BY ia.submitted_date DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException(`No pending institution application found for email ${email}`);
    }

    const application = rows[0];
    assertDefined(application);
    assertProp(check(isString, isNumber), application, 'id');
    assertProp(check(isString, isNumber), application, 'applicant_user_id');
    assertProp(check(isString, isNumber), application, 'user_id');

    const applicationId = String(application.id);
    const userId = String(application.user_id);

    // Approve the institution application
    await this.repo.adminApprovesInstitutionApplication({
      approvalDate: new Date(),
      applicationId: applicationId,
      reviewerUserId: '1',
    });

    this.#logger.debug(`Approved institution application ${applicationId} for user ${userId}`);

    return {
      success: true,
      message: `Institution application ${applicationId} for ${email} has been approved`,
      applicationId: Number(applicationId),
      userId: Number(userId),
      processingAdmin: 'test-admin',
    };
  }

  @Post('test-admin-institution-reject-by-email')
  async rejectInstitutionByEmail(@Body() body: { email: string; reason: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email, reason } = body;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      throw new BadRequestException('Rejection reason must be at least 10 characters long');
    }

    // Find latest pending institution application for the user with this email
    const rows = await this.repo.sql`
      SELECT ia.id, ia.status, ia.applicant_user_id, u.id as user_id
      FROM institution_applications ia
      JOIN users u ON ia.applicant_user_id = u.id
      WHERE u.email = ${email}
        AND ia.verified_date IS NULL
        AND ia.rejected_date IS NULL
      ORDER BY ia.submitted_date DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException(`No pending institution application found for email ${email}`);
    }

    const application = rows[0];
    assertDefined(application);
    assertProp(check(isString, isNumber), application, 'id');
    assertProp(check(isString, isNumber), application, 'applicant_user_id');
    assertProp(check(isString, isNumber), application, 'user_id');

    const applicationId = String(application.id);
    const userId = String(application.user_id);

    // Reject the institution application
    await this.repo.adminRejectInstitutionApplication({
      rejectionDate: new Date(),
      rejectionReason: reason,
      applicationId: applicationId,
      reviewerUserId: '1',
    });

    this.#logger.debug(
      `Rejected institution application ${applicationId} for user ${userId} with reason: ${reason}`,
    );

    return {
      success: true,
      message: `Institution application ${applicationId} for ${email} has been rejected`,
      applicationId: Number(applicationId),
      userId: Number(userId),
      processingAdmin: 'test-admin',
    };
  }

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
    if (process.env.NODE_ENV === 'production') {
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
    if (process.env.NODE_ENV === 'production') {
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
    if (process.env.NODE_ENV === 'production') {
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
    if (process.env.NODE_ENV === 'production') {
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
    if (process.env.NODE_ENV === 'production') {
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
    if (process.env.NODE_ENV === 'production') {
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
    if (process.env.NODE_ENV === 'production') {
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
    };

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

    const matchResult = await this.repo.platformMatchesLoanOffers({
      loanOfferId,
      loanApplicationId,
      matchedLtvRatio,
      matchedCollateralValuationAmount,
      matchedDate: matchedDateValue,
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
    if (process.env.NODE_ENV === 'production') {
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

  @Post('setup-account-balance-by-email')
  async setupAccountBalanceByEmail(
    @Body()
    body: {
      email: string;
      currencyBlockchainKey: string;
      currencyTokenId: string;
      balance: string;
    },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email, currencyBlockchainKey, currencyTokenId, balance } = body;

    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    if (!currencyBlockchainKey || typeof currencyBlockchainKey !== 'string') {
      throw new BadRequestException('currencyBlockchainKey is required');
    }
    if (!currencyTokenId || typeof currencyTokenId !== 'string') {
      throw new BadRequestException('currencyTokenId is required');
    }
    if (!balance || typeof balance !== 'string') {
      throw new BadRequestException('balance is required');
    }

    // Find user by email
    const userRows = await this.repo.sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (userRows.length === 0) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const user = userRows[0];
    assertDefined(user);
    assertProp(check(isString, isNumber), user, 'id');
    const userId = String(user.id);

    // Create currency if it doesn't exist
    // Map common currencies to their proper symbols and decimals
    let currencyName = 'Test Currency';
    let currencySymbol = 'TEST';
    let currencyDecimals = 18;

    if (currencyTokenId === 'slip44:0') {
      currencyName = 'Bitcoin';
      currencySymbol = 'BTC';
      currencyDecimals = 8;
    } else if (currencyTokenId === 'slip44:60') {
      currencyName = 'Ethereum';
      currencySymbol = 'ETH';
      currencyDecimals = 18;
    } else if (currencyTokenId.startsWith('erc20:0x8ac76a51')) {
      currencyName = 'USD Coin';
      currencySymbol = 'USDC';
      currencyDecimals = 18;
    } else if (currencyTokenId.startsWith('erc20:0x55d398')) {
      currencyName = 'Tether USD';
      currencySymbol = 'USDT';
      currencyDecimals = 18;
    } else if (currencyTokenId === 'slip44:501') {
      currencyName = 'Solana';
      currencySymbol = 'SOL';
      currencyDecimals = 9;
    } else if (currencyTokenId === 'slip44:714') {
      currencyName = 'Binance Coin';
      currencySymbol = 'BNB';
      currencyDecimals = 18;
    } else {
      // Generate a short symbol from token ID (max 16 chars for DB constraint)
      currencySymbol = currencyTokenId.substring(0, 16);
    }

    await this.repo.sql`
      INSERT INTO currencies (
        blockchain_key,
        token_id,
        name,
        symbol,
        decimals,
        image
      )
      VALUES (
        ${currencyBlockchainKey},
        ${currencyTokenId},
        ${currencyName},
        ${currencySymbol},
        ${currencyDecimals},
        'https://assets.cryptogadai.com/currencies/default.png'
      )
      ON CONFLICT (blockchain_key, token_id)
      DO NOTHING
    `;

    // Create account if it doesn't exist (with 0 balance initially)
    await this.repo.sql`
      INSERT INTO accounts (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        balance,
        account_type
      )
      VALUES (
        ${userId},
        ${currencyBlockchainKey},
        ${currencyTokenId},
        0,
        'User'
      )
      ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type)
      DO NOTHING
    `;

    // Insert account mutation to create balance - the trigger will update the account balance
    await this.repo.sql`
      INSERT INTO account_mutation_entries (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        account_type,
        mutation_type,
        mutation_date,
        amount
      ) VALUES (
        ${userId},
        ${currencyBlockchainKey},
        ${currencyTokenId},
        'User',
        'InvoiceReceived',
        NOW(),
        ${balance}
      )
    `;

    this.#logger.debug(
      `Set up account balance for user ${email}: ${balance} ${currencyTokenId} on ${currencyBlockchainKey}`,
    );

    return {
      success: true,
      message: `Account balance set up for ${email}`,
      userId: Number(userId),
      balance,
      currency: {
        blockchainKey: currencyBlockchainKey,
        tokenId: currencyTokenId,
      },
    };
  }

  @Post('setup-account-mutations-by-email')
  async setupAccountMutationsByEmail(
    @Body()
    body: {
      email: string;
      mutations: Array<{
        currencyBlockchainKey: string;
        currencyTokenId: string;
        mutationType: string;
        amount: string;
        mutationDate?: string;
      }>;
    },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email, mutations } = body;

    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    if (!mutations || !Array.isArray(mutations) || mutations.length === 0) {
      throw new BadRequestException('mutations array is required and must not be empty');
    }

    // Find user by email
    const userRows = await this.repo.sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (userRows.length === 0) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const user = userRows[0];
    assertDefined(user);
    assertProp(check(isString, isNumber), user, 'id');
    const userId = String(user.id);

    // Insert mutations
    for (const mutation of mutations) {
      const { currencyBlockchainKey, currencyTokenId, mutationType, amount, mutationDate } =
        mutation;

      if (!currencyBlockchainKey || typeof currencyBlockchainKey !== 'string') {
        throw new BadRequestException('currencyBlockchainKey is required for each mutation');
      }
      if (!currencyTokenId || typeof currencyTokenId !== 'string') {
        throw new BadRequestException('currencyTokenId is required for each mutation');
      }
      if (!mutationType || typeof mutationType !== 'string') {
        throw new BadRequestException('mutationType is required for each mutation');
      }
      if (!amount || typeof amount !== 'string') {
        throw new BadRequestException('amount is required for each mutation');
      }

      const effectiveMutationDate = mutationDate ? new Date(mutationDate) : new Date();

      // Create currency if it doesn't exist
      // Map common currencies to their proper symbols and decimals
      let currencyName = 'Test Currency';
      let currencySymbol = 'TEST';
      let currencyDecimals = 18;

      if (currencyTokenId === 'slip44:0') {
        currencyName = 'Bitcoin';
        currencySymbol = 'BTC';
        currencyDecimals = 8;
      } else if (currencyTokenId === 'slip44:60') {
        currencyName = 'Ethereum';
        currencySymbol = 'ETH';
        currencyDecimals = 18;
      } else if (currencyTokenId.startsWith('erc20:0x8ac76a51')) {
        currencyName = 'USD Coin';
        currencySymbol = 'USDC';
        currencyDecimals = 18;
      } else if (currencyTokenId.startsWith('erc20:0x55d398')) {
        currencyName = 'Tether USD';
        currencySymbol = 'USDT';
        currencyDecimals = 18;
      } else if (currencyTokenId === 'slip44:501') {
        currencyName = 'Solana';
        currencySymbol = 'SOL';
        currencyDecimals = 9;
      } else if (currencyTokenId === 'slip44:714') {
        currencyName = 'Binance Coin';
        currencySymbol = 'BNB';
        currencyDecimals = 18;
      } else {
        // Generate a short symbol from token ID (max 16 chars for DB constraint)
        currencySymbol = currencyTokenId.substring(0, 16);
      }

      await this.repo.sql`
        INSERT INTO currencies (
          blockchain_key,
          token_id,
          name,
          symbol,
          decimals,
          image
        )
        VALUES (
          ${currencyBlockchainKey},
          ${currencyTokenId},
          ${currencyName},
          ${currencySymbol},
          ${currencyDecimals},
          'https://assets.cryptogadai.com/currencies/default.png'
        )
        ON CONFLICT (blockchain_key, token_id)
        DO NOTHING
      `;

      // Create account if it doesn't exist
      await this.repo.sql`
        INSERT INTO accounts (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          balance,
          account_type
        )
        VALUES (
          ${userId},
          ${currencyBlockchainKey},
          ${currencyTokenId},
          0,
          'User'
        )
        ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type)
        DO NOTHING
      `;

      await this.repo.sql`
        INSERT INTO account_mutation_entries (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          account_type,
          mutation_type,
          mutation_date,
          amount
        ) VALUES (
          ${userId},
          ${currencyBlockchainKey},
          ${currencyTokenId},
          'User',
          ${mutationType},
          ${effectiveMutationDate},
          ${amount}
        )
      `;

      // Note: Balance is automatically updated by the apply_account_mutation_trigger
      // No manual balance update needed
    }

    this.#logger.debug(`Set up ${mutations.length} account mutations for user ${email}`);

    return {
      success: true,
      message: `${mutations.length} account mutations set up for ${email}`,
      userId: Number(userId),
      mutationsCount: mutations.length,
    };
  }

  @Post('cg-testnet-blockchain-payments')
  async dispatchMockBlockchainPayment(
    @Body()
    body: {
      blockchainKey?: string;
      tokenId?: string;
      address?: string;
      amount?: string;
      txHash?: string;
      sender?: string;
      timestamp?: string | number;
    },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    if (!body || typeof body !== 'object') {
      throw new BadRequestException('request body is required');
    }

    const blockchainKey =
      typeof body.blockchainKey === 'string' && body.blockchainKey.trim().length > 0
        ? body.blockchainKey
        : 'cg:testnet';

    if (!body.tokenId || typeof body.tokenId !== 'string') {
      throw new BadRequestException('tokenId is required');
    }
    if (!body.address || typeof body.address !== 'string') {
      throw new BadRequestException('address is required');
    }
    if (!body.amount || typeof body.amount !== 'string') {
      throw new BadRequestException('amount is required');
    }
    if (!body.txHash || typeof body.txHash !== 'string') {
      throw new BadRequestException('txHash is required');
    }

    let timestamp: number | undefined;
    if (body.timestamp !== undefined) {
      if (typeof body.timestamp === 'number' && Number.isFinite(body.timestamp)) {
        timestamp = Math.floor(body.timestamp);
      } else if (typeof body.timestamp === 'string') {
        const parsed = Date.parse(body.timestamp);
        if (Number.isNaN(parsed)) {
          throw new BadRequestException(
            'timestamp must be a valid ISO date string or epoch seconds',
          );
        }
        timestamp = Math.floor(parsed / 1000);
      } else {
        throw new BadRequestException('timestamp must be a number or ISO date string');
      }
    }

    await this.testBlockchainEvents.dispatchPayment({
      blockchainKey: blockchainKey.toLowerCase(),
      tokenId: body.tokenId,
      address: body.address,
      amount: body.amount,
      txHash: body.txHash,
      sender:
        typeof body.sender === 'string' && body.sender.trim().length > 0 ? body.sender : undefined,
      timestamp,
    });

    this.#logger.debug('Dispatched cg:testnet blockchain payment event', {
      blockchainKey,
      tokenId: body.tokenId,
      address: body.address,
      txHash: body.txHash,
    });

    return {
      success: true,
      blockchainKey,
      tokenId: body.tokenId,
      address: body.address,
      amount: body.amount,
      txHash: body.txHash,
      timestamp,
    };
  }
}
