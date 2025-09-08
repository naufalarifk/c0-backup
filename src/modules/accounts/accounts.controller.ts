import type { UserSession } from '../auth/types';

import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
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

import { Session } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { AccountsService } from './accounts.service';
import {
  AccountBalancesResponseDto,
  AccountMutationsResponseDto,
  GetAccountMutationsQueryDto,
} from './dto/accounts.dto';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('accounts')
export class AccountsController {
  private readonly logger = new Logger(AccountsController.name);

  constructor(private readonly accountsService: AccountsService) {}

  /**
   * Get account balances for the authenticated user
   */
  @Get('balances')
  @ApiOperation({
    summary: 'Get Account Balances',
    description: 'Retrieve all account balances for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved account balances',
    type: AccountBalancesResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request - Failed to retrieve account balances',
  })
  async getAccountBalances(@Session() session: UserSession): Promise<AccountBalancesResponseDto> {
    const {
      session: { id },
    } = session;
    this.logger.log(`Getting account balances for user: ${id}`);
    return await this.accountsService.getAccountBalances(id);
  }

  /**
   * Get account transaction history (mutations) by account ID
   */
  @Get(':accountId/mutations')
  @ApiOperation({
    summary: 'Get Account Transaction History',
    description: 'Retrieve transaction history (mutations) for a specific account',
  })
  @ApiParam({
    name: 'accountId',
    description: 'The ID of the account to retrieve mutations for',
    type: 'string',
    example: '123',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination',
    type: 'number',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of records per page (max 100)',
    type: 'number',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'mutationType',
    description: 'Filter by mutation type',
    type: 'string',
    required: false,
    enum: [
      'invoiceReceived',
      'loanCollateralDeposit',
      'loanApplicationCollateralEscrowed',
      'loanPrincipalDisbursement',
      'loanDisbursementReceived',
      'loanPrincipalDisbursementFee',
      'loanRepayment',
      'loanCollateralRelease',
      'loanCollateralReturned',
      'loanCollateralReleased',
      'loanLiquidationRelease',
      'loanLiquidationSurplus',
      'loanLiquidationReleaseFee',
      'loanPrincipalFunded',
      'loanOfferPrincipalEscrowed',
      'loanPrincipalReturned',
      'loanPrincipalReturnedFee',
      'loanInterestReceived',
      'loanRepaymentReceived',
      'loanLiquidationRepayment',
      'loanDisbursementPrincipal',
      'loanDisbursementFee',
      'loanRedeliveryFee',
      'loanLiquidationFee',
      'loanLiquidationCollateralUsed',
      'withdrawalRequested',
      'withdrawalRefunded',
      'platformFeeCharged',
      'platformFeeRefunded',
    ],
  })
  @ApiQuery({
    name: 'fromDate',
    description: 'Filter mutations from this date (ISO 8601 format)',
    type: 'string',
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'toDate',
    description: 'Filter mutations to this date (ISO 8601 format)',
    type: 'string',
    required: false,
    example: '2024-12-31T23:59:59Z',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved account mutations',
    type: AccountMutationsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Account not found or user does not have access to this account',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad Request - Invalid query parameters or failed to retrieve mutations',
  })
  async getAccountMutations(
    @Param('accountId') accountId: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: GetAccountMutationsQueryDto,
    @Session() session: UserSession,
  ): Promise<AccountMutationsResponseDto> {
    const {
      session: { id },
    } = session;
    this.logger.log(`Getting mutations for account: ${accountId}, user: ${id}`);
    return await this.accountsService.getAccountMutations(accountId, query);
  }
}
