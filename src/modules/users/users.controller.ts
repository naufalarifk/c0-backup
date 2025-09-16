import type { UserViewsProfileResult } from '../../shared/types';
import type { UserSession } from '../auth/types';

import { Body, Controller, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Session } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { CreateCredentialProviderDto } from './dto/create-credential-provider.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type AuthSession = UserSession & {
  user: {
    role: UserViewsProfileResult['role'];
  };
};

@Controller()
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('type-selection')
  @ApiOperation({
    summary: 'Set account type',
    description:
      'Allows a user to decide their account type (Individual or Institution). This decision can only be made once.',
    operationId: 'setUserType',
  })
  @ApiBody({
    type: UpdateUserDto,
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
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  selectUserType(@Session() session: AuthSession, @Body() selectUserTypeDto: UpdateUserDto) {
    const userId = session.user.id;
    return this.usersService.setUserType(userId, selectUserTypeDto.userType!);
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
}
