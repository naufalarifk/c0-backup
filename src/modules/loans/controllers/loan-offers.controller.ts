import type { UserSession } from '../../auth/types';

import {
  Body,
  Controller,
  Get,
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

import { validationOptions } from '../../../shared/utils/validation-options';
import { Session } from '../../auth/auth.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { ErrorResponseDto } from '../dto/common.dto';
import {
  CreateLoanOfferDto,
  LoanOfferListResponseDto,
  LoanOfferResponseDto,
  UpdateLoanOfferDto,
} from '../dto/loan-offers.dto';
import { LoanOffersService } from '../services/loan-offers.service';

@ApiTags('Loan Offers')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('loan-offers')
export class LoanOffersController {
  private readonly logger = new Logger(LoanOffersController.name);

  constructor(private readonly loanOffersService: LoanOffersService) {}

  /**
   * Create a new loan offer
   */
  @Post()
  @ApiOperation({
    summary: 'Create new loan offer',
    description:
      'Create a new loan offer with specified terms. The offer will be unpublished until the principal funding invoice is paid.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Loan offer created successfully',
    type: LoanOfferResponseDto,
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
  async createLoanOffer(
    @Session() session: UserSession,
    @Body(new ValidationPipe(validationOptions)) createLoanOfferDto: CreateLoanOfferDto,
  ): Promise<{ success: boolean; data: LoanOfferResponseDto }> {
    this.logger.log(`Creating loan offer for lender: ${session.user.id}`);
    const loanOffer = await this.loanOffersService.createLoanOffer(
      session.user.id,
      createLoanOfferDto,
    );
    return {
      success: true,
      data: loanOffer,
    };
  }

  /**
   * List available loan offers
   */
  @Get()
  @ApiOperation({
    summary: 'List available loan offers',
    description: 'Retrieve paginated list of published loan offers available for matching',
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of loan offers',
    type: LoanOfferListResponseDto,
  })
  async listLoanOffers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('collateralBlockchainKey') collateralBlockchainKey?: string,
    @Query('collateralTokenId') collateralTokenId?: string,
    @Query('principalBlockchainKey') principalBlockchainKey?: string,
    @Query('principalTokenId') principalTokenId?: string,
  ): Promise<LoanOfferListResponseDto> {
    this.logger.log('Listing available loan offers');
    return await this.loanOffersService.listLoanOffers({
      page: page || 1,
      limit: limit || 20,
      collateralBlockchainKey,
      collateralTokenId,
      principalBlockchainKey,
      principalTokenId,
    });
  }

  /**
   * Get my loan offers
   */
  @Get('my-offers')
  @ApiOperation({
    summary: 'Get my loan offers',
    description: 'Retrieve all loan offers created by the authenticated lender',
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
    description: "Lender's loan offers",
    type: LoanOfferListResponseDto,
  })
  async getMyLoanOffers(
    @Session() session: UserSession,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<LoanOfferListResponseDto> {
    this.logger.log(`Getting loan offers for lender: ${session.user.id}`);
    return await this.loanOffersService.getMyLoanOffers(session.user.id, {
      page: page || 1,
      limit: limit || 20,
    });
  }

  /**
   * Update loan offer
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update loan offer',
    description: 'Update loan offer status (close)',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Loan offer ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Loan offer updated',
    type: LoanOfferResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan offer not found',
    type: ErrorResponseDto,
  })
  async updateLoanOffer(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body(ValidationPipe) updateLoanOfferDto: UpdateLoanOfferDto,
  ): Promise<{ success: boolean; data: LoanOfferResponseDto }> {
    this.logger.log(`Updating loan offer ${id} for lender: ${session.user.id}`);
    const loanOffer = await this.loanOffersService.updateLoanOffer(
      session.user.id,
      id,
      updateLoanOfferDto,
    );
    return {
      success: true,
      data: loanOffer,
    };
  }

  /**
   * Get loan offer details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get loan offer details',
    description: 'Retrieve detailed information about a specific loan offer',
  })
  @ApiParam({ name: 'id', type: String, description: 'Loan offer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Loan offer details',
    type: LoanOfferResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Loan offer not found',
    type: ErrorResponseDto,
  })
  async getLoanOfferById(
    @Param('id') id: string,
  ): Promise<{ success: boolean; data: LoanOfferResponseDto }> {
    this.logger.log(`Fetching loan offer details for id: ${id}`);
    const offer = await this.loanOffersService.getLoanOfferById(id);
    return { success: true, data: offer };
  }
}
