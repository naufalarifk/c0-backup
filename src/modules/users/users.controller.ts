import type { UserViewsProfileResult } from '../../shared/types';
import type { UserSession } from '../auth/types';

import { Body, Controller, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Session } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type AuthSession = UserSession & {
  user: {
    role: UserViewsProfileResult['role'];
  };
};

@ApiTags('users')
@Controller('users')
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

  // @Post()
  // create(@Body() createUserDto: CreateUserDto) {
  //   return this.usersService.create(createUserDto);
  // }

  // @Get()
  // findAll() {
  //   return this.usersService.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.usersService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
  //   return this.usersService.update(+id, updateUserDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.usersService.remove(+id);
  // }
}
