import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Put,
} from '@nestjs/common';

import { assertDefined, assertProp, check, isNumber, isString } from 'typeshaper';

import { Auth } from '../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../shared/telemetry.logger';

@Controller('test')
@Auth({ public: true })
export class AdminTestController {
  #logger = new TelemetryLogger(AdminTestController.name);

  constructor(private readonly repo: CryptogadaiRepository) {}

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

  @Get('test-admin-view-pending-kycs')
  async viewPendingKycs() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const pendingKycs = await this.repo.adminViewsPendingKYCs();

    this.#logger.debug('Pending KYCs:', pendingKycs);

    return {
      success: true,
      pendingKycs,
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

    await this.repo.adminApprovesKyc({
      approvalDate: new Date(),
      kycId: String(kyc.id),
      verifierUserId: '1',
    });

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

    await this.repo.adminRejectsKyc({
      rejectionDate: new Date(),
      rejectionReason: reason,
      kycId: String(kyc.id),
      verifierUserId: '1',
    });

    this.#logger.debug(`Rejected KYC ${kyc.id} for user ${kyc.user_id} with reason: ${reason}`);

    return {
      success: true,
      message: `KYC ${kyc.id} for ${email} has been rejected`,
      kycId: Number(kyc.id),
      processingAdmin: 'test-admin',
    };
  }

  @Post('query-institution-application')
  async queryInstitutionApplication(@Body() body: { email: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email } = body;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }

    const rows = await this.repo.sql`
			SELECT ia.*
			FROM institution_applications ia
			JOIN users u ON ia.applicant_user_id = u.id
			WHERE u.email = ${email}
			ORDER BY ia.submitted_date DESC
			LIMIT 1
		`;

    if (rows.length === 0) {
      throw new NotFoundException(`No institution application found for email ${email}`);
    }

    return {
      success: true,
      application: rows[0],
    };
  }

  @Post('test-admin-institution-approve-by-email')
  async approveInstitutionByEmail(@Body() body: { email: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email } = body;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }

    const rows = await this.repo.sql`
			SELECT ia.id, ia.status, ia.applicant_user_id, u.id as user_id
			FROM institution_applications ia
			JOIN users u ON ia.applicant_user_id = u.id
			WHERE u.email = ${email}
				AND ia.verified_date IS NULL
				AND ia.rejected_date IS NULL
			ORDER BY ia.submitted_date DESC
			LIMIT 1
		`;

    if (rows.length === 0) {
      throw new NotFoundException(`No pending institution application found for email ${email}`);
    }

    const application = rows[0];
    assertDefined(application);
    assertProp(check(isString, isNumber), application, 'id');
    assertProp(check(isString, isNumber), application, 'applicant_user_id');
    assertProp(check(isString, isNumber), application, 'user_id');

    const applicationId = String(application.id);
    const userId = String(application.user_id);

    await this.repo.adminApprovesInstitutionApplication({
      approvalDate: new Date(),
      applicationId,
      reviewerUserId: '1',
    });

    this.#logger.debug(`Approved institution application ${applicationId} for user ${userId}`);

    return {
      success: true,
      message: `Institution application ${applicationId} for ${email} has been approved`,
      applicationId: Number(applicationId),
      userId: Number(userId),
      processingAdmin: 'test-admin',
    };
  }

  @Post('test-admin-institution-reject-by-email')
  async rejectInstitutionByEmail(@Body() body: { email: string; reason: string }) {
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

    const rows = await this.repo.sql`
			SELECT ia.id, ia.status, ia.applicant_user_id, u.id as user_id
			FROM institution_applications ia
			JOIN users u ON ia.applicant_user_id = u.id
			WHERE u.email = ${email}
				AND ia.verified_date IS NULL
				AND ia.rejected_date IS NULL
			ORDER BY ia.submitted_date DESC
			LIMIT 1
		`;

    if (rows.length === 0) {
      throw new NotFoundException(`No pending institution application found for email ${email}`);
    }

    const application = rows[0];
    assertDefined(application);
    assertProp(check(isString, isNumber), application, 'id');
    assertProp(check(isString, isNumber), application, 'applicant_user_id');
    assertProp(check(isString, isNumber), application, 'user_id');

    const applicationId = String(application.id);
    const userId = String(application.user_id);

    await this.repo.adminRejectInstitutionApplication({
      rejectionDate: new Date(),
      rejectionReason: reason,
      applicationId,
      reviewerUserId: '1',
    });

    this.#logger.debug(
      `Rejected institution application ${applicationId} for user ${userId} with reason: ${reason}`,
    );

    return {
      success: true,
      message: `Institution application ${applicationId} for ${email} has been rejected`,
      applicationId: Number(applicationId),
      userId: Number(userId),
      processingAdmin: 'test-admin',
    };
  }

  @Post('mark-kyc-verified-by-email')
  async markKycVerifiedByEmail(@Body() body: { email: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email } = body;
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }

    const userRows = await this.repo.sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (userRows.length === 0) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const user = userRows[0];
    assertDefined(user);
    assertProp(check(isString, isNumber), user, 'id');
    const userId = String(user.id);

    // Delete any existing KYC records for this user
    await this.repo.sql`
      DELETE FROM user_kycs WHERE user_id = ${userId}
    `;

    // Generate unique NIK for test using user ID (pad to 16 digits)
    const testNik = userId.toString().padStart(16, '0');

    // Create a verified KYC record directly
    await this.repo.sql`
      INSERT INTO user_kycs (
        user_id,
        id_card_photo,
        selfie_with_id_card_photo,
        nik,
        name,
        birth_city,
        birth_date,
        province,
        city,
        district,
        subdistrict,
        address,
        postal_code,
        status,
        submitted_date,
        verified_date,
        verifier_user_id
      )
      VALUES (
        ${userId},
        'test://id-card.jpg',
        'test://selfie-with-id.jpg',
        ${testNik},
        'Test User',
        'Jakarta',
        '1990-01-01',
        'DKI Jakarta',
        'Jakarta Pusat',
        'Menteng',
        'Gondangdia',
        '123 Test Street',
        '10310',
        'Verified',
        NOW(),
        NOW(),
        1
      )
    `;

    this.#logger.debug(`Marked user ${userId} (${email}) as KYC verified for testing`);

    return {
      success: true,
      message: `User ${email} has been marked as KYC verified`,
      userId: Number(userId),
    };
  }
}
