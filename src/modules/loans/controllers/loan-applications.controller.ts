import type { UserSession } from '../../auth/types';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
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
import { ErrorResponseDto } from '../dto/common.dto';
import {
  CreateLoanApplicationDto,
  LoanApplicationDetailResponseDto,
  LoanApplicationListResponseDto,
  LoanApplicationResponseDto,
  LoanCalculationRequestDto,
  LoanCalculationResponseDto,
  UpdateLoanApplicationDto,
} from '../dto/loan-applications.dto';
import { LoanApplicationsService } from '../services/loan-applications.service';

@ApiTags('Loan Applications')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('loan-applications')
export class LoanApplicationsController {
  private readonly logger = new TelemetryLogger(LoanApplicationsController.name);

  constructor(private readonly loanApplicationsService: LoanApplicationsService) {}

  /**
   * Calculate loan application requirements
   */
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate loan application requirements',
    description: 'Calculate required collateral amount and generate preview for loan application',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Loan calculation results',
    type: LoanCalculationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseDto,
  })
  async calculateLoanRequirements(
    @Body(ValidationPipe) calculationRequest: LoanCalculationRequestDto,
  ): Promise<LoanCalculationResponseDto> {
    this.logger.log('Calculating loan requirements');
    return await this.loanApplicationsService.calculateLoanRequirements(calculationRequest);
  }

  /**
   * Create a new loan application
   */
  @Post()
  @ApiOperation({
    summary: 'Create loan application',
    description: 'Create a new loan application. Requires collateral deposit to be published.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Loan application created',
    type: LoanApplicationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Insufficient balance',
    type: ErrorResponseDto,
  })
  async createLoanApplication(
    @Session() session: UserSession,
    @Body(ValidationPipe) createLoanApplicationDto: CreateLoanApplicationDto,
  ): Promise<{ success: boolean; data: LoanApplicationResponseDto }> {
    this.logger.log(`Creating loan application for borrower: ${session.user.id}`);
    const loanApplication = await this.loanApplicationsService.createLoanApplication(
      session.user.id,
      createLoanApplicationDto,
    );
    return {
      success: true,
      data: loanApplication,
    };
  }

  /**
   * List available loan applications
   */
  @Get()
  @ApiOperation({
    summary: 'List available loan applications',
    description: 'Retrieve paginated list of published loan applications available for matching',
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
    name: 'collateralBlockchainKey',
    required: false,
    type: String,
    description: 'Filter by collateral blockchain key',
  })
  @ApiQuery({
    name: 'collateralTokenId',
    required: false,
    type: String,
    description: 'Filter by collateral token ID',
  })
  @ApiQuery({
    name: 'principalBlockchainKey',
    required: false,
    type: String,
    description: 'Filter by principal blockchain key',
  })
  @ApiQuery({
    name: 'principalTokenId',
    required: false,
    type: String,
    description: 'Filter by principal token ID',
  })
  @ApiQuery({
    name: 'minPrincipalAmount',
    required: false,
    type: Number,
    description: 'Minimum principal amount filter',
  })
  @ApiQuery({
    name: 'maxPrincipalAmount',
    required: false,
    type: Number,
    description: 'Maximum principal amount filter',
  })
  @ApiQuery({
    name: 'liquidationMode',
    required: false,
    type: String,
    description: 'Liquidation mode filter (Full/Partial)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of loan applications',
    type: LoanApplicationListResponseDto,
  })
  async listLoanApplications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('collateralBlockchainKey') collateralBlockchainKey?: string,
    @Query('collateralTokenId') collateralTokenId?: string,
    @Query('principalBlockchainKey') principalBlockchainKey?: string,
    @Query('principalTokenId') principalTokenId?: string,
    @Query('minPrincipalAmount') minPrincipalAmount?: number,
    @Query('maxPrincipalAmount') maxPrincipalAmount?: number,
    @Query('liquidationMode') liquidationMode?: string,
  ): Promise<LoanApplicationListResponseDto> {
    this.logger.log('Listing available loan applications');
    return await this.loanApplicationsService.listLoanApplications({
      page: page || 1,
      limit: limit || 20,
      collateralBlockchainKey,
      collateralTokenId,
      principalBlockchainKey,
      principalTokenId,
      minPrincipalAmount,
      maxPrincipalAmount,
      liquidationMode,
    });
  }

  /**
   * Get my loan applications
   */
  @Get('my-applications')
  @ApiOperation({
    summary: 'Get my loan applications',
    description: 'Retrieve all loan applications created by the authenticated borrower',
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
    description: "Borrower's loan applications",
    type: LoanApplicationListResponseDto,
  })
  async getMyLoanApplications(
    @Session() session: UserSession,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<LoanApplicationListResponseDto> {
    this.logger.log(`Getting loan applications for borrower: ${session.user.id}`);
    return await this.loanApplicationsService.getMyLoanApplications(session.user.id, {
      page: page || 1,
      limit: limit || 20,
    });
  }

  /**
   * Update loan application
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update loan application',
    description: 'Update loan application (cancel, extend, modify terms)',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Loan application ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Loan application updated',
    type: LoanApplicationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan application not found',
    type: ErrorResponseDto,
  })
  async updateLoanApplication(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body(ValidationPipe) updateLoanApplicationDto: UpdateLoanApplicationDto,
  ): Promise<{ success: boolean; data: LoanApplicationResponseDto }> {
    this.logger.log(`Updating loan application ${id} for borrower: ${session.user.id}`);
    const loanApplication = await this.loanApplicationsService.updateLoanApplication(
      session.user.id,
      id,
      updateLoanApplicationDto,
    );
    return {
      success: true,
      data: loanApplication,
    };
  }

  /**
   * Get loan application details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get loan application details',
    description:
      'Retrieve detailed information about a specific loan application with calculations',
  })
  @ApiParam({ name: 'id', type: String, description: 'Loan application ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Loan application details',
    type: LoanApplicationDetailResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan application not found',
    type: ErrorResponseDto,
  })
  async getLoanApplicationById(
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: LoanApplicationDetailResponseDto }> {
    this.logger.log(`Fetching loan application details for id: ${id}`);
    const application = await this.loanApplicationsService.getLoanApplicationDetailById(id);
    return { success: true, data: application };
  }
}
