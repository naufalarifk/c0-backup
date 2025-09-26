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

import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isNumber,
  isString,
} from 'typeshaper';

import { CryptogadaiRepository } from './repositories/cryptogadai.repository';
import { TelemetryLogger } from './telemetry.logger';

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

    assertArrayMapOf(checkRows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
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

    assertArrayMapOf(checkRows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
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

  @Post('test-admin-kyc-approve-by-email')
  async approveKycByEmail(@Body() body: { email: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email } = body;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }

    // Find latest pending KYC for the user with this email
    const rows = await this.repo.sql`
      SELECT uk.id, uk.status, uk.user_id
      FROM user_kycs uk
      JOIN users u ON uk.user_id = u.id
      WHERE u.email = ${email}
        AND uk.verified_date IS NULL
        AND uk.rejected_date IS NULL
      ORDER BY uk.submitted_date DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException(`No pending KYC found for email ${email}`);
    }

    const kyc = rows[0];
    assertDefined(kyc);
    assertProp(check(isString, isNumber), kyc, 'id');
    assertProp(check(isString, isNumber), kyc, 'user_id');

    // Approve the KYC
    await this.repo.sql`
      UPDATE user_kycs
      SET verified_date = NOW(), status = 'Verified'
      WHERE id = ${kyc.id}
    `;

    this.#logger.debug(`Approved KYC ${kyc.id} for user ${kyc.user_id}`);

    return {
      success: true,
      message: `KYC ${kyc.id} for ${email} has been approved`,
      kycId: Number(kyc.id),
      processingAdmin: 'test-admin',
    };
  }

  @Post('test-admin-kyc-reject-by-email')
  async rejectKycByEmail(@Body() body: { email: string; reason: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email, reason } = body;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      throw new BadRequestException('Rejection reason must be at least 10 characters long');
    }

    // Find latest pending KYC for the user with this email
    const rows = await this.repo.sql`
      SELECT uk.id, uk.status, uk.user_id
      FROM user_kycs uk
      JOIN users u ON uk.user_id = u.id
      WHERE u.email = ${email}
        AND uk.verified_date IS NULL
        AND uk.rejected_date IS NULL
      ORDER BY uk.submitted_date DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException(`No pending KYC found for email ${email}`);
    }

    const kyc = rows[0];
    assertDefined(kyc);
    assertProp(check(isString, isNumber), kyc, 'id');
    assertProp(check(isString, isNumber), kyc, 'user_id');

    // Reject the KYC
    await this.repo.sql`
      UPDATE user_kycs
      SET rejected_date = NOW(), rejection_reason = ${reason}, status = 'Rejected'
      WHERE id = ${kyc.id}
    `;

    this.#logger.debug(`Rejected KYC ${kyc.id} for user ${kyc.user_id} with reason: ${reason}`);

    return {
      success: true,
      message: `KYC ${kyc.id} for ${email} has been rejected`,
      kycId: Number(kyc.id),
      processingAdmin: 'test-admin',
    };
  }
}
