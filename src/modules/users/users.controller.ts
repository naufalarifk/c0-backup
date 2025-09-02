import type { UserViewsProfileResult } from '../../shared/types';
import type { UserSession } from '../auth/types';

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Session } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type AuthSession = UserSession & {
  user: {
    role: UserViewsProfileResult['role'];
  };
};

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @Patch(':id/role')
  @ApiOperation({
    summary: 'Set role',
    description:
      'Allows a user to decide their account type (Individual or Institution). This decision can only be made once.',
    operationId: 'setUserType',
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the user whose type is being set',
    type: 'string',
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'Role selection data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Role has been successfully set',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid role or role already set',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not allowed to update this user',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async selectUserType(
    @Session() session: AuthSession,
    @Param('id') id: string,
    @Body() selectUserTypeDto: UpdateUserDto,
  ) {
    if (session.user.id !== id && session.user.role !== 'Admin') {
      throw new ForbiddenException('Not allowed to update this user');
    }

    return await this.usersService.setUserType(id, selectUserTypeDto.role!);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
