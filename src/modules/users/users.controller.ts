import type { UserSession } from '../auth/types';

import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Session } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { CreateCredentialProviderDto } from './dto/create-credential-provider.dto';
import { SelectUserTypeDto } from './dto/select-user-type.dto';
import { UsersService } from './users.service';

@Controller()
@UseGuards(AuthGuard)
@ApiTags('Users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('type-selection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set account type',
    description:
      'Allows a user to decide their account type (Individual or Institution). This decision can only be made once.',
    operationId: 'setUserType',
  })
  @ApiBody({
    type: SelectUserTypeDto,
    description: 'Account type selection data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account type has been successfully set',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid account type or account type already set',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not allowed to update this user',
  })
  async selectUserType(
    @Session() session: UserSession,
    @Body() selectUserTypeDto: SelectUserTypeDto,
  ) {
    const userId = session.user.id;
    const result = await this.usersService.setUserType(userId, selectUserTypeDto.userType);
    return result;
  }

  @Post('credential-provider')
  @ApiOperation({
    summary: 'Add credential provider (email/password) to existing user',
    description: 'Allows users who signed up via social provider to add email/password login',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Credential provider added successfully',
  })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Credential provider already exists' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  addCredentialProvider(
    @Session() session: UserSession,
    @Body() createCredentialProviderDto: CreateCredentialProviderDto,
  ) {
    return this.usersService.addCredentialProvider(
      session.user.id,
      createCredentialProviderDto.password,
    );
  }

  @Get('provider-accounts')
  @ApiOperation({
    summary: 'Get all authentication provider accounts linked to the user',
    description:
      'Retrieves a list of all authentication providers associated with the user account',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of authentication provider accounts retrieved successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  getProviderAccounts(@Session() session: UserSession) {
    return this.usersService.getProviderAccounts(session.user.id);
  }

  @Get('institutions')
  @ApiOperation({
    summary: 'Get user institution memberships',
    description: "Retrieves the authenticated user's institution memberships",
  })
  @ApiResponse({
    status: 200,
    description: 'Institution memberships retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  async getInstitutionMemberships(@Session() session: UserSession) {
    // For now, return empty array for individual users
    return {
      memberships: [],
    };
  }
}
