import type { UserSession } from '../../auth/types';

import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { ErrorResponseDto, LoanStatus, UserRole } from '../dto/common.dto';
import {
  EarlyLiquidationEstimateResponseDto,
  EarlyLiquidationRequestDto,
  EarlyLiquidationRequestResponseDto,
  EarlyRepaymentRequestDto,
  EarlyRepaymentRequestResponseDto,
} from '../dto/loan-operations.dto';
import {
  LoanAgreementResponseDto,
  LoanListResponseDto,
  LoanResponseDto,
  LoanValuationListResponseDto,
} from '../dto/loans.dto';
import { LoansService } from '../services/loans.service';

@ApiTags('Loans')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('loans')
export class LoansController {
  private readonly logger = new TelemetryLogger(LoansController.name);

  constructor(private readonly loansService: LoansService) {}

  /**
   * Convert string status to LoanStatus enum
   */
  private convertStringToUserRole(role?: string): UserRole | undefined {
    if (!role) return undefined;

    // Map common string values to enum values
    switch (role.toLowerCase()) {
      case 'borrower':
        return UserRole.BORROWER;
      case 'lender':
        return UserRole.LENDER;
      default:
        return undefined;
    }
  }

  private convertStringToLoanStatus(status?: string): LoanStatus | undefined {
    if (!status) return undefined;

    // Map common string values to enum values
    switch (status.toLowerCase()) {
      case 'originated':
        return LoanStatus.ORIGINATED;
      case 'disbursed':
        return LoanStatus.DISBURSED;
      case 'active':
        return LoanStatus.ACTIVE;
      case 'repaid':
        return LoanStatus.REPAID;
      case 'liquidated':
        return LoanStatus.LIQUIDATED;
      default:
        return undefined;
    }
  }

  /**
   * List loans for authenticated user
   */
  @Get()
  @ApiOperation({
    summary: 'List loans',
    description: 'Get loans for authenticated user (as borrower or lender)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (1-100)',
    example: 20,
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['borrower', 'lender'],
    description: 'Filter by user role',
  })
  @ApiQuery({
    name: 'loanOfferId',
    required: false,
    type: String,
    description: 'Filter by loan offer ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: LoanStatus,
    description: 'Filter by loan status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of loans',
    type: LoanListResponseDto,
  })
  async listLoans(
    @Session() session: UserSession,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: string,
    @Query('loanOfferId') loanOfferId?: string,
    @Query('status') status?: string,
  ): Promise<LoanListResponseDto> {
    this.logger.log(`Listing loans for user: ${session.user.id}`);
    return await this.loansService.listLoans(session.user.id, {
      page: page || 1,
      limit: limit || 20,
      role: this.convertStringToUserRole(role),
      loanOfferId,
      status: this.convertStringToLoanStatus(status),
    });
  }

  /**
   * Get loan details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get loan details',
    description: 'Retrieve detailed information about a specific loan',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Loan ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Loan details',
    type: LoanResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan not found',
    type: ErrorResponseDto,
  })
  async getLoanDetails(
    @Session() session: UserSession,
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: LoanResponseDto }> {
    this.logger.log(`Getting loan details for loan: ${id}, user: ${session.user.id}`);
    const loan = await this.loansService.getLoanDetails(session.user.id, id);
    return {
      success: true,
      data: loan,
    };
  }

  /**
   * Get loan valuation history
   */
  @Get(':id/valuations')
  @ApiOperation({
    summary: 'Get loan valuation history',
    description: 'Retrieve LTV ratio history for a loan',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Loan ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (1-100)',
    example: 20,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Loan valuation history',
    type: LoanValuationListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan not found',
    type: ErrorResponseDto,
  })
  async getLoanValuations(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<LoanValuationListResponseDto> {
    this.logger.log(`Getting loan valuations for loan: ${id}, user: ${session.user.id}`);
    return await this.loansService.getLoanValuations(session.user.id, id, {
      page: page || 1,
      limit: limit || 20,
    });
  }

  /**
   * Calculate early liquidation estimate
   */
  @Post(':id/early-liquidation/estimate')
  @ApiOperation({
    summary: 'Calculate early liquidation estimate',
    description: 'Calculate the estimated outcome of early liquidation for an active loan.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Loan ID to estimate early liquidation for',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Early liquidation estimate calculated successfully',
    type: EarlyLiquidationEstimateResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not the borrower of this loan',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Loan not eligible for early liquidation',
    type: ErrorResponseDto,
  })
  async calculateEarlyLiquidation(
    @Session() session: UserSession,
    @Param('id') id: string,
  ): Promise<EarlyLiquidationEstimateResponseDto> {
    this.logger.log(`Calculating early liquidation for loan: ${id}, borrower: ${session.user.id}`);
    return await this.loansService.estimateEarlyLiquidation(session.user.id, id);
  }

  /**
   * Request early liquidation
   */
  @Post(':id/early-liquidation/request')
  @ApiOperation({
    summary: 'Request early liquidation',
    description: 'Submit a request for early liquidation of an active loan.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Loan ID to request early liquidation for',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Early liquidation request submitted successfully',
    type: EarlyLiquidationRequestResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not the borrower of this loan',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Early liquidation already in progress or loan not eligible',
    type: ErrorResponseDto,
  })
  async requestEarlyLiquidation(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body(ValidationPipe) requestDto: EarlyLiquidationRequestDto,
  ): Promise<EarlyLiquidationRequestResponseDto> {
    this.logger.log(`Requesting early liquidation for loan: ${id}, borrower: ${session.user.id}`);
    return await this.loansService.requestEarlyLiquidation(session.user.id, id, requestDto);
  }

  /**
   * Request early loan repayment
   */
  @Post(':id/early-repayment/request')
  @ApiOperation({
    summary: 'Request early loan repayment',
    description: 'Submit a request for early repayment of an active loan before maturity date.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Loan ID to request early repayment for',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Early repayment request submitted successfully',
    type: EarlyRepaymentRequestResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not the borrower of this loan',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Early repayment already in progress or loan not eligible',
    type: ErrorResponseDto,
  })
  async requestEarlyRepayment(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body(ValidationPipe) requestDto: EarlyRepaymentRequestDto,
  ): Promise<EarlyRepaymentRequestResponseDto> {
    this.logger.log(`Requesting early repayment for loan: ${id}, borrower: ${session.user.id}`);
    return await this.loansService.requestEarlyRepayment(session.user.id, id, requestDto);
  }

  /**
   * Download loan agreement document
   */
  @Get(':id/agreement')
  @ApiOperation({
    summary: 'Download loan agreement document',
    description: 'Download the loan agreement contract document in PDF or HTML format.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Loan ID',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['pdf', 'html'],
    description: 'Document format to download',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Loan agreement document',
    type: LoanAgreementResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - user not party to this loan',
    type: ErrorResponseDto,
  })
  async getLoanAgreement(
    @Session() session: UserSession,
    @Param('id') id: string,
  ): Promise<LoanAgreementResponseDto> {
    this.logger.log(`Getting loan agreement for loan: ${id}, user: ${session.user.id}`);
    return await this.loansService.getLoanAgreement(session.user.id, id);
  }
}
