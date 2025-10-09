import type { UserSession } from '../../auth/types';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  assertArray,
  assertArrayMapOf,
  assertDefined,
  assertProp,
  check,
  isInstanceOf,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { Auth } from '../../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { validationOptions } from '../../../shared/utils/validation-options.js';
import { Session } from '../../auth/auth.decorator';

@Controller('admin/users')
@ApiTags('Admin - User Management')
@Auth(['Admin'])
export class AdminUsersController {
  private readonly logger = new TelemetryLogger(AdminUsersController.name);

  constructor(private readonly repo: CryptogadaiRepository) {}

  @Get()
  @ApiOperation({
    summary: 'Search and manage users',
    description: 'Basic user search and management interface for admin',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search by email or name' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'suspended', 'locked'],
    description: 'Filter by user status',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  status: { type: 'string', enum: ['active', 'suspended', 'locked'] },
                  kycStatus: { type: 'string', enum: ['none', 'pending', 'verified', 'rejected'] },
                  institutionId: { type: 'string', nullable: true },
                  institutionRole: { type: 'string', nullable: true },
                  lastLogin: { type: 'string', format: 'date-time', nullable: true },
                  registeredDate: { type: 'string', format: 'date-time' },
                },
              },
            },
            statistics: {
              type: 'object',
              properties: {
                totalUsers: { type: 'integer' },
                kycVerified: { type: 'integer' },
                institutionUsers: { type: 'integer' },
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  async getUsers(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 20;
      const offset = (pageNum - 1) * limitNum;

      // Build query with filters
      let whereClause = 'WHERE 1=1';
      const params: unknown[] = [];

      if (search) {
        whereClause += ` AND (u.email ILIKE $${params.length + 1} OR u.name ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      // TODO: Implement status filtering
      // Status filtering is not yet supported because the status field needs proper integration
      // Expected behavior when implemented:
      // - Filter users by status: 'active', 'suspended', or 'locked'
      // - Query: WHERE u.status = $n
      // - Should work with search parameter (AND condition)
      // - Should respect the default value of 'active' for users without explicit status
      // if (status) {
      //   whereClause += ` AND u.status = $${params.length + 1}`;
      //   params.push(status);
      // }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        LEFT JOIN user_kycs uk ON u.id = uk.user_id AND uk.verified_date IS NOT NULL
        ${whereClause}
      `;

      const countResult = await this.repo.rawQuery(countQuery, params);
      assertArray(countResult);
      assertArrayMapOf(countResult, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'total');
        return row;
      });

      const total = Number(countResult[0].total);

      // Get users with pagination
      const usersQuery = `
        SELECT
          u.id,
          u.email,
          u.name,
          COALESCE(u.status, 'active') as status,
          u.created_date,
          u.last_login_date,
          CASE
            WHEN uk.verified_date IS NOT NULL THEN 'verified'
            WHEN uk.rejected_date IS NOT NULL THEN 'rejected'
            WHEN uk.submitted_date IS NOT NULL THEN 'pending'
            ELSE 'none'
          END as kyc_status,
          u.institution_user_id,
          u.institution_role
        FROM users u
        LEFT JOIN user_kycs uk ON u.id = uk.user_id
        ${whereClause}
        ORDER BY u.created_date DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(limitNum, offset);

      const usersResult = await this.repo.rawQuery(usersQuery, params);
      assertArray(usersResult);

      const users = usersResult.map(row => {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isNullable, isString), row, 'email');
        assertProp(check(isNullable, isString), row, 'name');
        assertProp(check(isNullable, isString), row, 'status');
        assertProp(check(isNullable, isInstanceOf(Date)), row, 'created_date');
        assertProp(check(isNullable, isInstanceOf(Date)), row, 'last_login_date');
        assertProp(check(isNullable, isString), row, 'kyc_status');
        assertProp(check(isNullable, isString, isNumber), row, 'institution_user_id');
        assertProp(check(isNullable, isString), row, 'institution_role');

        return {
          id: String(row.id),
          email: row.email || '',
          name: row.name || '',
          status: (row.status as string) || 'active',
          kycStatus: (row.kyc_status as string) || 'none',
          institutionId: row.institution_user_id ? String(row.institution_user_id) : null,
          institutionRole: row.institution_role || null,
          lastLogin: row.last_login_date ? row.last_login_date.toISOString() : null,
          registeredDate: row.created_date
            ? row.created_date.toISOString()
            : new Date().toISOString(),
        };
      });

      // Get statistics
      const statsQuery = `
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN uk.verified_date IS NOT NULL THEN 1 END) as kyc_verified,
          COUNT(CASE WHEN u.institution_user_id IS NOT NULL THEN 1 END) as institution_users
        FROM users u
        LEFT JOIN user_kycs uk ON u.id = uk.user_id
      `;

      const statsResult = await this.repo.rawQuery(statsQuery, []);
      assertArray(statsResult);
      assertArrayMapOf(statsResult, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'total_users');
        assertProp(check(isString, isNumber), row, 'kyc_verified');
        assertProp(check(isString, isNumber), row, 'institution_users');
        return row;
      });

      const stats = statsResult[0];
      const totalPages = Math.ceil(total / limitNum);

      return {
        success: true,
        data: {
          users,
          statistics: {
            totalUsers: Number(stats.total_users),
            kycVerified: Number(stats.kyc_verified),
            institutionUsers: Number(stats.institution_users),
          },
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get users', { error: error.message });
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get individual user profile details',
    description: 'View individual user profile for admin oversight',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string', enum: ['Individual', 'Company', 'Admin'] },
                status: { type: 'string', enum: ['active', 'suspended', 'locked'] },
                kycStatus: { type: 'string', enum: ['none', 'pending', 'verified', 'rejected'] },
                registeredDate: { type: 'string', format: 'date-time' },
                lastLoginDate: { type: 'string', format: 'date-time', nullable: true },
              },
            },
            financialSummary: {
              type: 'object',
              properties: {
                totalDeposits: { type: 'string' },
                totalWithdrawals: { type: 'string' },
                activeLoans: { type: 'integer' },
              },
            },
            adminNotes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  adminId: { type: 'string' },
                  adminName: { type: 'string' },
                  note: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserProfile(@Param('id') userId: string) {
    try {
      // Get user details
      const userQuery = `
        SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          u.user_type,
          COALESCE(u.status, 'active') as status,
          u.created_date,
          u.last_login_date,
          CASE
            WHEN uk.verified_date IS NOT NULL THEN 'verified'
            WHEN uk.rejected_date IS NOT NULL THEN 'rejected'
            WHEN uk.submitted_date IS NOT NULL THEN 'pending'
            ELSE 'none'
          END as kyc_status
        FROM users u
        LEFT JOIN user_kycs uk ON u.id = uk.user_id
        WHERE u.id = $1
      `;

      const userResult = await this.repo.rawQuery(userQuery, [userId]);
      assertArray(userResult);

      if (userResult.length === 0) {
        throw new NotFoundException('User not found');
      }

      assertArrayMapOf(userResult, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isNullable, isString), row, 'email');
        assertProp(check(isNullable, isString), row, 'name');
        assertProp(check(isNullable, isString), row, 'role');
        assertProp(check(isNullable, isString), row, 'user_type');
        assertProp(check(isNullable, isString), row, 'status');
        assertProp(check(isNullable, isInstanceOf(Date)), row, 'created_date');
        assertProp(check(isNullable, isInstanceOf(Date)), row, 'last_login_date');
        assertProp(check(isNullable, isString), row, 'kyc_status');
        return row;
      });

      const user = userResult[0];

      // Get financial summary - deposits (from account_mutations with InvoicePrepaid type)
      const depositQuery = `
        SELECT COALESCE(SUM(am.amount), 0) as total_deposits
        FROM account_mutations am
        JOIN accounts a ON am.account_id = a.id
        WHERE a.user_id = $1
          AND am.mutation_type = 'InvoicePrepaid'
          AND am.amount > 0
      `;

      const depositResult = await this.repo.rawQuery(depositQuery, [userId]);
      assertArray(depositResult);
      assertArrayMapOf(depositResult, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'total_deposits');
        return row;
      });

      // Get financial summary - withdrawals (from withdrawals table)
      const withdrawalQuery = `
        SELECT COALESCE(SUM(w.request_amount), 0) as total_withdrawals
        FROM withdrawals w
        JOIN beneficiaries b ON w.beneficiary_id = b.id
        WHERE b.user_id = $1 AND w.status = 'Confirmed'
      `;

      const withdrawalResult = await this.repo.rawQuery(withdrawalQuery, [userId]);
      assertArray(withdrawalResult);
      assertArrayMapOf(withdrawalResult, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'total_withdrawals');
        return row;
      });

      // Get active loans count (from loans table)
      const loansQuery = `
        SELECT COUNT(*) as active_loans
        FROM loans l
        JOIN loan_offers lo ON l.loan_offer_id = lo.id
        JOIN loan_applications la ON l.loan_application_id = la.id
        WHERE (lo.lender_user_id = $1 OR la.borrower_user_id = $1)
          AND l.status IN ('Originated', 'Active')
      `;

      const loansResult = await this.repo.rawQuery(loansQuery, [userId]);
      assertArray(loansResult);
      assertArrayMapOf(loansResult, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'active_loans');
        return row;
      });

      // Map role and user_type to the API role format
      let apiRole: string;
      if (user.role === 'Admin') {
        apiRole = 'Admin';
      } else if (user.user_type === 'Institution') {
        apiRole = 'Company';
      } else if (user.user_type === 'Individual') {
        apiRole = 'Individual';
      } else {
        apiRole = 'Individual'; // Default fallback
      }

      return {
        success: true,
        data: {
          user: {
            id: String(user.id),
            email: user.email || '',
            name: user.name || '',
            role: apiRole,
            status: user.status || 'active',
            kycStatus: user.kyc_status || 'none',
            registeredDate: user.created_date
              ? user.created_date.toISOString()
              : new Date().toISOString(),
            lastLoginDate: user.last_login_date ? user.last_login_date.toISOString() : null,
          },
          financialSummary: {
            totalDeposits: String(depositResult[0].total_deposits),
            totalWithdrawals: String(withdrawalResult[0].total_withdrawals),
            activeLoans: Number(loansResult[0].active_loans),
          },
          adminNotes: [],
        },
      };
    } catch (error) {
      this.logger.error('Failed to get user profile', { error: error.message, userId });
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve user profile');
    }
  }

  @Post(':id/actions')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Perform user administrative actions',
    description: 'Execute basic administrative actions on user accounts',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User action performed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            userId: { type: 'string' },
            executedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid action or validation error' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async performUserAction(
    @Session() session: UserSession,
    @Param('id') userId: string,
    @Body(new ValidationPipe(validationOptions)) body: { action: string; reason?: string },
  ) {
    try {
      // Validate action
      if (!body.action) {
        throw new BadRequestException('Action is required');
      }

      const validActions = ['suspend', 'activate', 'unlock'];
      if (!validActions.includes(body.action)) {
        throw new BadRequestException(`Invalid action. Must be one of: ${validActions.join(', ')}`);
      }

      // Check if user exists
      const checkUser = await this.repo.sql`
        SELECT id FROM users WHERE id = ${userId}
      `;

      if (checkUser.length === 0) {
        throw new NotFoundException('User not found');
      }

      assertArrayMapOf(checkUser, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'id');
        return row;
      });

      // Perform action and update user status
      let newStatus: string;
      switch (body.action) {
        case 'suspend':
          newStatus = 'suspended';
          break;
        case 'activate':
          newStatus = 'active';
          break;
        case 'unlock':
          newStatus = 'active'; // Unlocking sets status to active
          break;
        default:
          throw new BadRequestException('Invalid action');
      }

      // Update user status in database
      await this.repo.sql`
        UPDATE users
        SET status = ${newStatus}
        WHERE id = ${userId}
      `;

      this.logger.log('Admin performed user action', {
        action: body.action,
        userId,
        adminId: session.user.id,
        reason: body.reason,
        newStatus,
      });

      return {
        success: true,
        data: {
          action: body.action,
          userId: String(userId),
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to perform user action', { error: error.message, userId });
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to perform user action');
    }
  }
}
