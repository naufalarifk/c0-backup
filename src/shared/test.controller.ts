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

import { CryptogadaiRepository } from './repositories/cryptogadai.repository';
import { TelemetryLogger } from './telemetry.logger';
import { assertArrayOf, assertDefined, assertPropString } from './utils/assertions.js';

@Controller()
export class TestController {
  #logger = new TelemetryLogger(TestController.name);

  constructor(private readonly repo: CryptogadaiRepository) {}

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

    const result = await this.repo.systemCreatesTestUsers({ users });

    this.#logger.debug(`Created ${result.users.length} test users`);

    return {
      success: true,
      message: `Created ${result.users.length} test users`,
      users: result.users,
    };
  }

  @Put('admin/kyc/:id/approve')
  async approveKycTest(@Param('id') kycId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    this.#logger.debug(`Attempting to approve KYC ${kycId}`);

    if (!kycId) {
      throw new BadRequestException('KYC ID is required');
    }

    // Check if KYC exists and is still pending
    const checkRows = await this.repo.sql`
      SELECT id, status FROM user_kycs WHERE id = ${kycId}
    `;

    this.#logger.debug(`KYC query result for ID ${kycId}:`, checkRows);

    if (checkRows.length === 0) {
      throw new NotFoundException('KYC submission not found');
    }

    assertArrayOf(checkRows, function (row) {
      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'status');
      return row;
    });

    const currentKyc = checkRows[0];
    this.#logger.debug(`Current KYC status: ${currentKyc.status}`);

    if (currentKyc.status !== 'Submitted') {
      throw new ConflictException(
        `KYC has already been processed. Current status: ${currentKyc.status}`,
      );
    }

    // Update KYC status to approved
    await this.repo.sql`
      UPDATE user_kycs
      SET status = 'Verified',
          verified_date = NOW()
      WHERE id = ${kycId}
    `;

    this.#logger.debug(`Approved KYC ${kycId}`);

    return {
      success: true,
      message: `KYC ${kycId} has been approved`,
      kycId: Number(kycId),
      processedDate: new Date().toISOString(),
      processingAdmin: 'test-admin',
    };
  }

  @Put('admin/kyc/:id/reject')
  async rejectKycTest(@Param('id') kycId: string, @Body() body: { reason: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { reason } = body;

    if (!kycId) {
      throw new BadRequestException('KYC ID is required');
    }

    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    if (reason.trim().length < 10) {
      throw new BadRequestException('Rejection reason must be at least 10 characters long');
    }

    // Check if KYC exists and is still pending
    const checkRows = await this.repo.sql`
      SELECT id, status FROM user_kycs WHERE id = ${kycId}
    `;

    if (checkRows.length === 0) {
      throw new NotFoundException('KYC submission not found');
    }

    assertArrayOf(checkRows, function (row) {
      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'status');
      return row;
    });

    const currentKyc = checkRows[0];
    if (currentKyc.status !== 'Submitted') {
      throw new ConflictException('KYC has already been processed');
    }

    // Update KYC status to rejected
    await this.repo.sql`
      UPDATE user_kycs
      SET status = 'Rejected',
          rejected_date = NOW(),
          rejection_reason = ${reason}
      WHERE id = ${kycId}
    `;

    this.#logger.debug(`Rejected KYC ${kycId} with reason: ${reason}`);

    return {
      success: true,
      message: `KYC ${kycId} has been rejected`,
      kycId: Number(kycId),
      processedDate: new Date().toISOString(),
      processingAdmin: 'test-admin',
    };
  }
}
