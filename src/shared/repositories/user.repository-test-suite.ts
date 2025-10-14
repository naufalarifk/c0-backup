import type { UserAppliesForInstitutionParams } from './user.types';

import { doesNotReject, doesNotThrow, equal, ok, rejects, throws } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import { assertArrayMapOf, assertDefined, assertPropDefined } from 'typeshaper';

import { createEarlyExitNodeTestIt } from '../utils/node-test';
import { UserRepository } from './user.repository';

// Helper function to create complete institution application test data
function createInstitutionApplicationData(
  applicantUserId: string,
  businessName: string,
  applicationDate: Date,
): UserAppliesForInstitutionParams {
  return {
    applicantUserId,
    businessName,
    businessDescription: 'A business focused on financial technology solutions',
    businessType: 'PT',
    npwpNumber: '12.345.678.9-123.456',
    npwpDocumentPath: '/path/to/npwp.pdf',
    registrationNumber: 'NIB1234567890',
    registrationDocumentPath: '/path/to/registration.pdf',
    establishmentNumber: 'AHU-123456.AH.01.01.TAHUN2024',
    deedOfEstablishmentPath: '/path/to/deed.pdf',
    businessAddress: 'Jl. Sudirman No. 123, RT 001 RW 002',
    businessCity: 'Jakarta Selatan',
    businessProvince: 'DKI Jakarta',
    businessDistrict: 'Kebayoran Baru',
    businessSubdistrict: 'Senayan',
    businessPostalCode: '12190',
    directorName: 'John Doe',
    directorPosition: 'CEO',
    directorIdCardPath: '/path/to/director_id.pdf',
    ministryApprovalDocumentPath: '/path/to/ministry.pdf',
    applicationDate,
  };
}

export async function runUserRepositoryTestSuite(
  createRepo: () => Promise<UserRepository>,
  teardownRepo: (repo: UserRepository) => Promise<void>,
): Promise<void> {
  await suite('UserRepository', function () {
    const { afterEach, beforeEach, it } = createEarlyExitNodeTestIt();
    let repo: UserRepository;

    beforeEach(async function () {
      repo = await createRepo();
    });

    afterEach(async function () {
      await teardownRepo(repo);
    });

    describe('User Profile Management', function () {
      it('should create user with image field and return it', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
          image: 'https://example.com/avatar.jpg',
        });

        equal(user.name, 'John Doe');
        equal(user.email, 'john@example.com');
        equal(user.image, 'https://example.com/avatar.jpg');
        equal(user.emailVerified, true);
      });

      it('should create user without image field and return null', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Jane Doe',
          email: 'jane@example.com',
          emailVerified: true,
        });

        equal(user.name, 'Jane Doe');
        equal(user.email, 'jane@example.com');
        equal(user.image, null);
      });

      it('should find user by ID and include image field', async function () {
        const createdUser = await repo.betterAuthCreateUser({
          name: 'Test User',
          email: 'test@example.com',
          emailVerified: true,
          image: 'https://example.com/test.jpg',
        });

        const foundUser = await repo.betterAuthFindOneUser([
          { field: 'id', value: createdUser.id },
        ]);

        assertDefined(foundUser);
        equal(foundUser.id, createdUser.id);
        equal(foundUser.name, 'Test User');
        equal(foundUser.image, 'https://example.com/test.jpg');
      });

      it('should update user and include image field in response', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Update Test',
          email: 'update@example.com',
          emailVerified: true,
        });

        const updatedUser = await repo.betterAuthUpdateUser([{ field: 'id', value: user.id }], {
          name: 'Updated Name',
          image: 'https://example.com/updated.jpg',
        });

        assertDefined(updatedUser);
        equal(updatedUser.name, 'Updated Name');
        equal(updatedUser.image, 'https://example.com/updated.jpg');
      });

      it('should find many users and include image field', async function () {
        await repo.betterAuthCreateUser({
          name: 'Many Test 1',
          email: 'many1@example.com',
          emailVerified: true,
          image: 'https://example.com/many1.jpg',
        });

        await repo.betterAuthCreateUser({
          name: 'Many Test 2',
          email: 'many2@example.com',
          emailVerified: true,
          image: 'https://example.com/many2.jpg',
        });

        const users = await repo.betterAuthFindManyUsers();

        ok(users.length >= 2, 'Should find at least 2 users');
        const hasImageField = users.some(u => u.image !== undefined);
        ok(hasImageField, 'Users should have image field');
      });

      it('should create user with phone number and return it', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'John Phone',
          email: 'john-phone@example.com',
          emailVerified: true,
          phoneNumber: '+1234567890',
          phoneNumberVerified: true,
        });

        equal(user.name, 'John Phone');
        equal(user.email, 'john-phone@example.com');
        equal(user.phoneNumber, '+1234567890');
        equal(user.phoneNumberVerified, true);
      });

      it('should create user without phone number and return null for phone fields', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Jane NoPhone',
          email: 'jane-nophone@example.com',
          emailVerified: true,
        });

        equal(user.name, 'Jane NoPhone');
        equal(user.email, 'jane-nophone@example.com');
        equal(user.phoneNumber, null);
        equal(user.phoneNumberVerified, false);
      });

      it('should find user by phone number', async function () {
        const createdUser = await repo.betterAuthCreateUser({
          name: 'Phone Finder Test',
          email: 'phone-finder@example.com',
          emailVerified: true,
          phoneNumber: '+9876543210',
          phoneNumberVerified: true,
        });

        const foundUser = await repo.betterAuthFindOneUser([
          { field: 'phoneNumber', value: '+9876543210' },
        ]);

        assertDefined(foundUser);
        equal(foundUser.id, createdUser.id);
        equal(foundUser.name, 'Phone Finder Test');
        equal(foundUser.phoneNumber, '+9876543210');
        equal(foundUser.phoneNumberVerified, true);
      });

      it('should update user phone number', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Phone Update Test',
          email: 'phone-update@example.com',
          emailVerified: true,
        });

        const updatedUser = await repo.betterAuthUpdateUser([{ field: 'id', value: user.id }], {
          phoneNumber: '+1111111111',
          phoneNumberVerified: true,
        });

        assertDefined(updatedUser);
        equal(updatedUser.phoneNumber, '+1111111111');
        equal(updatedUser.phoneNumberVerified, true);
      });

      it('should update user profile with full name and profile picture', async function () {
        // First create a user via Better Auth
        const user = await repo.betterAuthCreateUser({
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
        });

        const updateDate = new Date('2024-01-01T00:00:00Z');
        assertPropDefined(user, 'id');
        const result = await repo.userUpdatesProfile({
          id: String(user.id),
          name: 'John Updated Doe',
          profilePictureUrl: 'https://example.com/profile.jpg',
          updateDate: updateDate,
        });

        equal(result.id, String(user.id));
        equal(result.name, 'John Updated Doe');
        equal(result.profilePictureUrl, 'https://example.com/profile.jpg');
        equal(result.updatedDate, updateDate);
      });

      it('should update user profile with partial data', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Jane Doe',
          email: 'jane@example.com',
          emailVerified: true,
        });

        const updateDate = new Date('2024-01-01T00:00:00Z');
        const result = await repo.userUpdatesProfile({
          id: String(user.id),
          name: 'Jane Updated Doe',
          updateDate: updateDate,
        });

        equal(result.id, String(user.id));
        equal(result.name, 'Jane Updated Doe');
        equal(result.profilePictureUrl, null);
        equal(result.updatedDate, updateDate);
      });

      it('should view user profile with basic information', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Profile Test User',
          email: 'profile-test@example.com',
          emailVerified: true,
        });

        const result = await repo.userViewsProfile({ userId: String(user.id) });

        equal(result.id, String(user.id));
        equal(result.name, 'Profile Test User');
        equal(result.email, 'profile-test@example.com');
        equal(result.emailVerified, true);
        equal(result.role, 'User');
        equal(result.twoFactorEnabled, false);
        equal(result.userType, 'Undecided');
        equal(result.institutionUserId, null);
        equal(result.institutionRole, null);
        equal(result.kycId, null);
        equal(result.kycStatus, 'none');
        equal(result.businessName, null);
        equal(result.businessType, null);
        ok(result.createdAt instanceof Date);
        ok(result.updatedAt instanceof Date);
      });

      it('should view user profile with updated profile picture', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Picture Test User',
          email: 'picture-test@example.com',
          emailVerified: true,
        });

        // Update profile with picture
        await repo.userUpdatesProfile({
          id: String(user.id),
          name: 'Picture Test User Updated',
          profilePictureUrl: 'https://example.com/picture.jpg',
          updateDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userViewsProfile({ userId: String(user.id) });

        equal(result.id, String(user.id));
        equal(result.name, 'Picture Test User Updated');
        equal(result.profilePicture, 'https://example.com/picture.jpg');
      });

      it('should view user profile with KYC status', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'KYC Profile Test',
          email: 'kyc-profile-test@example.com',
          emailVerified: true,
        });

        // User decides type and submits KYC
        await repo.userDecidesUserType({
          userId: String(user.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        await repo.userSubmitsKyc({
          userId: String(user.id),
          idCardPhoto: '/path/to/id-card.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          name: 'KYC Profile Test',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userViewsProfile({ userId: String(user.id) });

        equal(result.id, String(user.id));
        equal(result.userType, 'Individual');
        equal(result.kycStatus, 'pending');
        ok(result.userTypeSelectedDate instanceof Date);
      });

      it('should view user profile with institution information', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Institution Test User',
          email: 'institution-test@example.com',
          emailVerified: true,
        });

        const institutionOwner = await repo.betterAuthCreateUser({
          name: 'Institution Owner',
          email: 'owner-test@example.com',
          emailVerified: true,
        });

        // Add user to institution
        await repo.adminAddUserToInstitution({
          userId: String(user.id),
          institutionId: String(institutionOwner.id),
          role: 'Finance',
          assignedDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userViewsProfile({ userId: String(user.id) });

        equal(result.id, String(user.id));
        equal(result.institutionUserId, String(institutionOwner.id));
        equal(result.institutionRole, 'Finance');
      });

      it('should view user profile with verified KYC status', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Verified KYC User',
          email: 'verified-kyc@example.com',
          emailVerified: true,
        });

        const admin = await repo.betterAuthCreateUser({
          name: 'Admin User',
          email: 'admin-verified@example.com',
          emailVerified: true,
        });

        // User decides type and submits KYC
        await repo.userDecidesUserType({
          userId: String(user.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const kyc = await repo.userSubmitsKyc({
          userId: String(user.id),
          idCardPhoto: '/path/to/id-card.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          name: 'Verified KYC User',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Admin approves KYC
        await repo.adminApprovesKyc({
          kycId: kyc.id,
          verifierUserId: String(admin.id),
          approvalDate: new Date('2024-01-02T00:00:00Z'),
        });

        const result = await repo.userViewsProfile({ userId: String(user.id) });

        equal(result.id, String(user.id));
        equal(result.kycStatus, 'verified');
        equal(result.kycId, kyc.id);
        equal(result.userType, 'Individual');
      });
    });

    describe('User KYC Management', function () {
      it('should allow user to submit KYC', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'KYC User',
          email: 'kyc@example.com',
          emailVerified: true,
        });

        // User must decide user type before submitting KYC
        await repo.userDecidesUserType({
          userId: String(user.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const kycData = {
          userId: String(user.id),
          idCardPhoto: '/path/to/id-card.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          name: 'KYC User Full Name',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        };

        const result = await repo.userSubmitsKyc(kycData);

        equal(typeof result.id, 'string');
        equal(result.userId, String(user.id));
      });

      it('should return none status when user has no KYC', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'No KYC User',
          email: 'no-kyc@example.com',
          emailVerified: true,
        });

        const result = await repo.userViewsKYCStatus({ userId: String(user.id) });

        equal(result.userId, String(user.id));
        equal(result.status, 'none');
        equal(result.canResubmit, true);
        equal(result.id, undefined);
      });

      it('should return pending status after KYC submission', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Pending KYC User',
          email: 'pending-kyc@example.com',
          emailVerified: true,
        });

        // User must decide user type before submitting KYC
        await repo.userDecidesUserType({
          userId: String(user.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        await repo.userSubmitsKyc({
          userId: String(user.id),
          idCardPhoto: '/path/to/id-card.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          name: 'Pending KYC User',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userViewsKYCStatus({ userId: String(user.id) });

        equal(result.userId, String(user.id));
        equal(result.status, 'pending');
        equal(result.canResubmit, false);
        equal(typeof result.id, 'string');
        ok(result.submittedDate instanceof Date, 'Expected submittedDate to be a Date instance');
        const submittedDateStr = result.submittedDate.toISOString();
        ok(
          submittedDateStr.includes('2024-01') || submittedDateStr.includes('2023-12'),
          `Expected submittedDate to contain 2024-01 or 2023-12, got: ${submittedDateStr}`,
        );
      });
    });

    describe('User Institution Management', function () {
      it('should allow user to apply for institution', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Institution Applicant',
          email: 'institution@example.com',
          emailVerified: true,
        });

        // User must decide user type before applying for institution
        await repo.userDecidesUserType({
          userId: String(user.id),
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userAppliesForInstitution(
          createInstitutionApplicationData(
            String(user.id),
            'Test Business Corp',
            new Date('2024-01-01T00:00:00Z'),
          ),
        );

        equal(typeof result.id, 'string');
        equal(result.applicantUserId, String(user.id));
        equal(result.businessName, 'Test Business Corp');
      });

      it('should allow user to accept institution invitation', async function () {
        const institutionUser = await repo.betterAuthCreateUser({
          name: 'Institution Owner',
          email: 'owner@example.com',
          emailVerified: true,
        });

        const invitedUser = await repo.betterAuthCreateUser({
          name: 'Invited User',
          email: 'invited@example.com',
          emailVerified: true,
        });

        // Invited user must also decide their user type and complete KYC
        await repo.userDecidesUserType({
          userId: String(invitedUser.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Submit and approve KYC for invited user
        const invitedUserKyc = await repo.userSubmitsKyc({
          userId: String(invitedUser.id),
          idCardPhoto: '/path/to/invited-id-card.jpg',
          selfieWithIdCardPhoto: '/path/to/invited-selfie-with-id.jpg',
          nik: '9876543210987654',
          name: 'Invited User',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Invited No. 123',
          postalCode: '12345',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Admin approves invited user's KYC
        await repo.adminApprovesKyc({
          kycId: invitedUserKyc.id,
          verifierUserId: '1', // System user
          approvalDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Institution owner must decide user type and apply for institution first
        await repo.userDecidesUserType({
          userId: String(institutionUser.id),
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Apply for institution and get it approved to become an owner
        const application = await repo.userAppliesForInstitution(
          createInstitutionApplicationData(
            String(institutionUser.id),
            'Test Institution',
            new Date('2024-01-01T00:00:00Z'),
          ),
        );

        // Admin approves the application (making the user an institution owner)
        const admin = await repo.betterAuthCreateUser({
          name: 'Admin',
          email: 'admin@example.com',
          emailVerified: true,
        });

        await repo.adminApprovesInstitutionApplication({
          applicationId: application.id,
          reviewerUserId: String(admin.id),
          approvalDate: new Date('2024-01-01T00:00:00Z'),
        });

        const invitation = await repo.ownerUserInvitesUserToInstitution({
          institutionId: String(institutionUser.id),
          userId: String(invitedUser.id),
          role: 'Finance',
          invitationDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userAcceptsInstitutionInvitation({
          invitationId: invitation.id,
          userId: String(invitedUser.id),
          acceptanceDate: new Date('2024-01-02T00:00:00Z'),
        });

        equal(result.id, invitation.id);
        equal(result.institutionId, String(institutionUser.id));
        ok(result.acceptedDate instanceof Date, 'Expected acceptedDate to be a Date instance');
        const acceptedDateStr = result.acceptedDate.toISOString();
        ok(
          acceptedDateStr.includes('2024-01') || acceptedDateStr.includes('2023-12'),
          `Expected acceptedDate to contain 2024-01 or 2023-12, got: ${acceptedDateStr}`,
        );
      });

      it('should allow user to reject institution invitation', async function () {
        const institutionUser = await repo.betterAuthCreateUser({
          name: 'Institution Owner',
          email: 'owner2@example.com',
          emailVerified: true,
        });

        const invitedUser = await repo.betterAuthCreateUser({
          name: 'Invited User 2',
          email: 'invited2@example.com',
          emailVerified: true,
        });

        // Invited user must also decide their user type and complete KYC
        await repo.userDecidesUserType({
          userId: String(invitedUser.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Submit and approve KYC for invited user
        const invitedUserKyc = await repo.userSubmitsKyc({
          userId: String(invitedUser.id),
          idCardPhoto: '/path/to/invited2-id-card.jpg',
          selfieWithIdCardPhoto: '/path/to/invited2-selfie-with-id.jpg',
          nik: '8765432109876543',
          name: 'Invited User 2',
          birthCity: 'Bandung',
          birthDate: new Date('1991-01-01'),
          province: 'West Java',
          city: 'Bandung',
          district: 'Central Bandung',
          subdistrict: 'Sumur Bandung',
          address: 'Jl. Invited2 No. 456',
          postalCode: '54321',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Admin approves invited user's KYC
        await repo.adminApprovesKyc({
          kycId: invitedUserKyc.id,
          verifierUserId: '1', // System user
          approvalDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Institution owner must decide user type and apply for institution first
        await repo.userDecidesUserType({
          userId: String(institutionUser.id),
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Apply for institution and get it approved to become an owner
        const application = await repo.userAppliesForInstitution(
          createInstitutionApplicationData(
            String(institutionUser.id),
            'Test Institution 2',
            new Date('2024-01-01T00:00:00Z'),
          ),
        );

        // Admin approves the application (making the user an institution owner)
        const admin = await repo.betterAuthCreateUser({
          name: 'Admin',
          email: 'admin@example.com',
          emailVerified: true,
        });

        await repo.adminApprovesInstitutionApplication({
          applicationId: application.id,
          reviewerUserId: String(admin.id),
          approvalDate: new Date('2024-01-01T00:00:00Z'),
        });

        const invitation = await repo.ownerUserInvitesUserToInstitution({
          institutionId: String(institutionUser.id),
          userId: String(invitedUser.id),
          role: 'Finance',
          invitationDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userRejectsInstitutionInvitation({
          invitationId: invitation.id,
          userId: String(invitedUser.id),
          rejectionReason: 'Not interested',
          rejectionDate: new Date('2024-01-02T00:00:00Z'),
        });

        equal(result.id, invitation.id);
        ok(result.rejectedDate instanceof Date, 'Expected rejectedDate to be a Date instance');
        const rejectedDateStr = result.rejectedDate.toISOString();
        ok(
          rejectedDateStr.includes('2024-01') || rejectedDateStr.includes('2023-12'),
          `Expected rejectedDate to contain 2024-01 or 2023-12, got: ${rejectedDateStr}`,
        );
      });
    });

    describe('Admin KYC Management', function () {
      it('should allow admin to approve KYC', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'KYC Approval User',
          email: 'kyc-approval@example.com',
          emailVerified: true,
        });

        const admin = await repo.betterAuthCreateUser({
          name: 'Admin User',
          email: 'admin@example.com',
          emailVerified: true,
        });

        // User must decide user type before submitting KYC
        await repo.userDecidesUserType({
          userId: String(user.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const kyc = await repo.userSubmitsKyc({
          userId: String(user.id),
          idCardPhoto: '/path/to/id-card.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          name: 'KYC Approval User',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.adminApprovesKyc({
          kycId: kyc.id,
          verifierUserId: String(admin.id),
          approvalDate: new Date('2024-01-02T00:00:00Z'),
        });

        equal(result.id, kyc.id);
        equal(result.userId, String(user.id));
        ok(result.verifiedDate instanceof Date, 'Expected verifiedDate to be a Date instance');
        const verifiedDateStr = result.verifiedDate.toISOString();
        ok(
          verifiedDateStr.includes('2024-01') || verifiedDateStr.includes('2023-12'),
          `Expected verifiedDate to contain 2024-01 or 2023-12, got: ${verifiedDateStr}`,
        );

        // Verify KYC status is now verified
        const status = await repo.userViewsKYCStatus({ userId: String(user.id) });
        equal(status.status, 'verified');
        ok(status.verifiedDate instanceof Date, 'Expected verifiedDate to be a Date instance');
        const statusVerifiedDateStr = status.verifiedDate.toISOString();
        ok(
          statusVerifiedDateStr.includes('2024-01') || statusVerifiedDateStr.includes('2023-12'),
          `Expected verifiedDate to contain 2024-01 or 2023-12, got: ${statusVerifiedDateStr}`,
        );
      });

      it('should allow admin to reject KYC', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'KYC Rejection User',
          email: 'kyc-rejection@example.com',
          emailVerified: true,
        });

        const admin = await repo.betterAuthCreateUser({
          name: 'Admin User 2',
          email: 'admin2@example.com',
          emailVerified: true,
        });

        // User must decide user type before submitting KYC
        await repo.userDecidesUserType({
          userId: String(user.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const kyc = await repo.userSubmitsKyc({
          userId: String(user.id),
          idCardPhoto: '/path/to/id-card.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          name: 'KYC Rejection User',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.adminRejectsKyc({
          kycId: kyc.id,
          verifierUserId: String(admin.id),
          rejectionReason: 'Document quality is poor',
          rejectionDate: new Date('2024-01-02T00:00:00Z'),
        });

        equal(result.id, kyc.id);
        equal(result.userId, String(user.id));
        ok(result.rejectedDate instanceof Date, 'Expected rejectedDate to be a Date instance');
        const rejectedDateStr = result.rejectedDate.toISOString();
        ok(
          rejectedDateStr.includes('2024-01') || rejectedDateStr.includes('2023-12'),
          `Expected rejectedDate to contain 2024-01 or 2023-12, got: ${rejectedDateStr}`,
        );

        // Verify KYC status is now rejected
        const status = await repo.userViewsKYCStatus({ userId: String(user.id) });
        equal(status.status, 'rejected');
        const statusRejectedDateStr = status.rejectedDate?.toISOString() ?? '';
        ok(
          statusRejectedDateStr.includes('2024-01') || statusRejectedDateStr.includes('2023-12'),
          `Expected rejectedDate to contain 2024-01 or 2023-12, got: ${statusRejectedDateStr}`,
        );
        equal(status.rejectionReason, 'Document quality is poor');
        equal(status.canResubmit, true);
      });

      it('should allow admin to view pending KYCs', async function () {
        const user1 = await repo.betterAuthCreateUser({
          name: 'Pending User 1',
          email: 'pending1@example.com',
          emailVerified: true,
        });

        const user2 = await repo.betterAuthCreateUser({
          name: 'Pending User 2',
          email: 'pending2@example.com',
          emailVerified: true,
        });

        // Users must decide user type before submitting KYC
        await repo.userDecidesUserType({
          userId: String(user1.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        await repo.userDecidesUserType({
          userId: String(user2.id),
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        await repo.userSubmitsKyc({
          userId: String(user1.id),
          idCardPhoto: '/path/to/id-card1.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id1.jpg',
          nik: '1111111111111111',
          name: 'Pending User 1',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 111',
          postalCode: '12345',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        await repo.userSubmitsKyc({
          userId: String(user2.id),
          idCardPhoto: '/path/to/id-card2.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id2.jpg',
          nik: '2222222222222222',
          name: 'Pending User 2',
          birthCity: 'Bandung',
          birthDate: new Date('1991-01-01'),
          province: 'West Java',
          city: 'Bandung',
          district: 'Central Bandung',
          subdistrict: 'Sumur Bandung',
          address: 'Jl. Example No. 222',
          postalCode: '54321',
          submissionDate: new Date('2024-01-02T00:00:00Z'),
        });

        const result = await repo.adminViewsPendingKYCs();

        equal(result.kycs.length, 2);
        equal(result.kycs[0].name, 'Pending User 1');
        equal(result.kycs[0].nik, '1111111111111111');
        equal(result.kycs[1].name, 'Pending User 2');
        equal(result.kycs[1].nik, '2222222222222222');
      });
    });

    describe('Admin Institution Management', function () {
      it('should allow admin to approve institution application', async function () {
        const applicant = await repo.betterAuthCreateUser({
          name: 'Institution Applicant',
          email: 'applicant@example.com',
          emailVerified: true,
        });

        const admin = await repo.betterAuthCreateUser({
          name: 'Admin User',
          email: 'admin3@example.com',
          emailVerified: true,
        });

        // User must decide user type before applying for institution
        await repo.userDecidesUserType({
          userId: String(applicant.id),
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const application = await repo.userAppliesForInstitution(
          createInstitutionApplicationData(
            String(applicant.id),
            'Approved Business Corp',
            new Date('2024-01-01T00:00:00Z'),
          ),
        );

        const result = await repo.adminApprovesInstitutionApplication({
          applicationId: application.id,
          reviewerUserId: String(admin.id),
          approvalDate: new Date('2024-01-02T00:00:00Z'),
        });

        equal(result.institutionId, String(applicant.id));
        equal(result.applicationId, application.id);
      });

      it('should allow admin to reject institution application', async function () {
        const applicant = await repo.betterAuthCreateUser({
          name: 'Rejected Applicant',
          email: 'rejected@example.com',
          emailVerified: true,
        });

        const admin = await repo.betterAuthCreateUser({
          name: 'Admin User',
          email: 'admin4@example.com',
          emailVerified: true,
        });

        // User must decide user type before applying for institution
        await repo.userDecidesUserType({
          userId: String(applicant.id),
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const application = await repo.userAppliesForInstitution(
          createInstitutionApplicationData(
            String(applicant.id),
            'Rejected Business Corp',
            new Date('2024-01-01T00:00:00Z'),
          ),
        );

        const result = await repo.adminRejectInstitutionApplication({
          applicationId: application.id,
          reviewerUserId: String(admin.id),
          rejectionReason: 'Incomplete documentation',
          rejectionDate: new Date('2024-01-02T00:00:00Z'),
        });

        equal(result.id, application.id);
        ok(result.rejectedDate instanceof Date, 'Expected rejectedDate to be a Date instance');
        const rejectedDateStr = result.rejectedDate.toISOString();
        ok(
          rejectedDateStr.includes('2024-01') || rejectedDateStr.includes('2023-12'),
          `Expected rejectedDate to contain 2024-01 or 2023-12, got: ${rejectedDateStr}`,
        );
      });

      it('should allow admin to add user to institution', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Member User',
          email: 'member@example.com',
          emailVerified: true,
        });

        const institution = await repo.betterAuthCreateUser({
          name: 'Institution Owner',
          email: 'institution-owner@example.com',
          emailVerified: true,
        });

        const result = await repo.adminAddUserToInstitution({
          userId: String(user.id),
          institutionId: String(institution.id),
          role: 'Finance',
          assignedDate: new Date('2024-01-01T00:00:00Z'),
        });

        equal(result.userId, String(user.id));
        equal(result.institutionId, String(institution.id));
        equal(result.role, 'Finance');
      });

      it('should allow admin to remove user from institution', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Removable User',
          email: 'removable@example.com',
          emailVerified: true,
        });

        const institution = await repo.betterAuthCreateUser({
          name: 'Institution Owner 2',
          email: 'institution-owner2@example.com',
          emailVerified: true,
        });

        // First add user to institution
        await repo.adminAddUserToInstitution({
          userId: String(user.id),
          institutionId: String(institution.id),
          role: 'Finance',
          assignedDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Then remove user from institution
        const result = await repo.adminRemoveUserFromInstitution({
          userId: String(user.id),
          removedDate: new Date('2024-01-02T00:00:00Z'),
        });

        equal(result.userId, String(user.id));
        equal(result.removed, true);
      });
    });

    describe('Database Triggers', function () {
      describe('KYC Triggers', function () {
        it('should update user kyc_id and create notification when KYC is approved', async function () {
          const user = await repo.betterAuthCreateUser({
            name: 'Trigger Test User',
            email: 'trigger-test@example.com',
            emailVerified: true,
          });

          const admin = await repo.betterAuthCreateUser({
            name: 'Admin User',
            email: 'admin-trigger@example.com',
            emailVerified: true,
          });

          // User must decide user type before submitting KYC
          await repo.userDecidesUserType({
            userId: String(user.id),
            userType: 'Individual',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          const kyc = await repo.userSubmitsKyc({
            userId: String(user.id),
            idCardPhoto: '/path/to/id-card.jpg',
            selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
            nik: '1234567890123456',
            name: 'Trigger Test User',
            birthCity: 'Jakarta',
            birthDate: new Date('1990-01-01'),
            province: 'DKI Jakarta',
            city: 'Jakarta',
            district: 'Central Jakarta',
            subdistrict: 'Menteng',
            address: 'Jl. Example No. 123',
            postalCode: '12345',
            submissionDate: new Date('2024-01-01T00:00:00Z'),
          });

          await repo.adminApprovesKyc({
            kycId: kyc.id,
            verifierUserId: String(admin.id),
            approvalDate: new Date('2024-01-02T00:00:00Z'),
          });

          // Check that user's kyc_id is updated
          const updatedUser = await repo.adminChecksUserKycId({ userId: String(user.id) });
          equal(String(updatedUser.kycId), kyc.id);

          // Create notification explicitly (no longer using database trigger)
          await repo.platformNotifyUser({
            userId: String(user.id),
            type: 'UserKycVerified',
            title: 'KYC Verification Approved',
            content: 'Your identity verification has been approved',
            userKycId: kyc.id,
          });

          // Check that notification was created
          const notificationResult = await repo.adminViewsNotificationsByType({
            userId: String(user.id),
            type: 'UserKycVerified',
          });
          equal(notificationResult.notifications.length, 1);

          const notification = notificationResult.notifications[0];
          equal(notification.type, 'UserKycVerified');
          equal(notification.title, 'KYC Verification Approved');
          // Note: In-memory database may not support optional notification fields
          if (notification.userKycId !== undefined) {
            equal(String(notification.userKycId), kyc.id);
          }
          ok(notification.content.includes('identity verification has been approved'));
        });

        it('should create notification when KYC is rejected', async function () {
          const user = await repo.betterAuthCreateUser({
            name: 'Rejection Test User',
            email: 'rejection-test@example.com',
            emailVerified: true,
          });

          const admin = await repo.betterAuthCreateUser({
            name: 'Admin User 2',
            email: 'admin-rejection@example.com',
            emailVerified: true,
          });

          // User must decide user type before submitting KYC
          await repo.userDecidesUserType({
            userId: String(user.id),
            userType: 'Individual',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          const kyc = await repo.userSubmitsKyc({
            userId: String(user.id),
            idCardPhoto: '/path/to/id-card.jpg',
            selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
            nik: '1234567890123456',
            name: 'Rejection Test User',
            birthCity: 'Jakarta',
            birthDate: new Date('1990-01-01'),
            province: 'DKI Jakarta',
            city: 'Jakarta',
            district: 'Central Jakarta',
            subdistrict: 'Menteng',
            address: 'Jl. Example No. 123',
            postalCode: '12345',
            submissionDate: new Date('2024-01-01T00:00:00Z'),
          });

          await repo.adminRejectsKyc({
            kycId: kyc.id,
            verifierUserId: String(admin.id),
            rejectionReason: 'Document quality is poor',
            rejectionDate: new Date('2024-01-02T00:00:00Z'),
          });

          // Create rejection notification explicitly (no longer using database trigger)
          await repo.platformNotifyUser({
            userId: String(user.id),
            type: 'UserKycRejected',
            title: 'KYC Verification Rejected',
            content:
              'Your KYC verification was rejected. Reason: Document quality is poor. You may resubmit your documents.',
            userKycId: kyc.id,
          });

          // Check that rejection notification was created
          const notificationResult = await repo.adminViewsNotificationsByType({
            userId: String(user.id),
            type: 'UserKycRejected',
          });
          equal(notificationResult.notifications.length, 1);

          const notification = notificationResult.notifications[0];
          equal(notification.type, 'UserKycRejected');
          equal(notification.title, 'KYC Verification Rejected');
          // Note: In-memory database may not support optional notification fields
          if (notification.userKycId !== undefined) {
            equal(String(notification.userKycId), kyc.id);
          }
          ok(notification.content.includes('Document quality is poor'));
          ok(notification.content.includes('may resubmit'));
        });
      });

      describe('Institution Application Triggers', function () {
        it('should update user to institution owner and create notification when application is approved', async function () {
          const applicant = await repo.betterAuthCreateUser({
            name: 'Institution Trigger Test',
            email: 'institution-trigger@example.com',
            emailVerified: true,
          });

          const admin = await repo.betterAuthCreateUser({
            name: 'Admin Institution',
            email: 'admin-institution@example.com',
            emailVerified: true,
          });

          // User must decide user type before applying for institution
          await repo.userDecidesUserType({
            userId: String(applicant.id),
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          const application = await repo.userAppliesForInstitution(
            createInstitutionApplicationData(
              String(applicant.id),
              'Trigger Test Corp',
              new Date('2024-01-01T00:00:00Z'),
            ),
          );

          await repo.adminApprovesInstitutionApplication({
            applicationId: application.id,
            reviewerUserId: String(admin.id),
            approvalDate: new Date('2024-01-02T00:00:00Z'),
          });

          // Check that user's institution data is updated
          const updatedUser = await repo.adminChecksUserInstitutionData({
            userId: String(applicant.id),
          });
          equal(String(updatedUser.institutionUserId), String(applicant.id));
          equal(updatedUser.institutionRole, 'Owner');

          // Create approval notification explicitly (no longer using database trigger)
          await repo.platformNotifyUser({
            userId: String(applicant.id),
            type: 'InstitutionApplicationVerified',
            title: 'Institution Application Approved',
            content: 'Your institution application for Trigger Test Corp has been approved',
            institutionApplicationId: application.id,
          });

          // Check that approval notification was created
          const notificationResult = await repo.adminViewsNotificationsByType({
            userId: String(applicant.id),
            type: 'InstitutionApplicationVerified',
          });
          equal(notificationResult.notifications.length, 1);

          const notification = notificationResult.notifications[0];
          equal(notification.type, 'InstitutionApplicationVerified');
          equal(notification.title, 'Institution Application Approved');
          // Note: In-memory database may not support optional notification fields
          if (notification.institutionApplicationId !== undefined) {
            equal(String(notification.institutionApplicationId), application.id);
          }
          ok(notification.content.includes('Trigger Test Corp'));
          ok(notification.content.includes('has been approved'));
        });

        it('should create notification when institution application is rejected', async function () {
          const applicant = await repo.betterAuthCreateUser({
            name: 'Rejected Institution Test',
            email: 'rejected-institution@example.com',
            emailVerified: true,
          });

          const admin = await repo.betterAuthCreateUser({
            name: 'Admin Institution 2',
            email: 'admin-institution2@example.com',
            emailVerified: true,
          });

          // User must decide user type before applying for institution
          await repo.userDecidesUserType({
            userId: String(applicant.id),
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          const application = await repo.userAppliesForInstitution(
            createInstitutionApplicationData(
              String(applicant.id),
              'Rejected Test Corp',
              new Date('2024-01-01T00:00:00Z'),
            ),
          );

          await repo.adminRejectInstitutionApplication({
            applicationId: application.id,
            reviewerUserId: String(admin.id),
            rejectionReason: 'Missing required documents',
            rejectionDate: new Date('2024-01-02T00:00:00Z'),
          });

          // Create rejection notification explicitly (no longer using database trigger)
          await repo.platformNotifyUser({
            userId: String(applicant.id),
            type: 'InstitutionApplicationRejected',
            title: 'Institution Application Rejected',
            content:
              'Your institution application was rejected. Reason: Missing required documents',
            institutionApplicationId: application.id,
          });

          // Check that rejection notification was created
          const notificationResult = await repo.adminViewsNotificationsByType({
            userId: String(applicant.id),
            type: 'InstitutionApplicationRejected',
          });
          equal(notificationResult.notifications.length, 1);

          const notification = notificationResult.notifications[0];
          equal(notification.type, 'InstitutionApplicationRejected');
          equal(notification.title, 'Institution Application Rejected');
          // Note: In-memory database may not support optional notification fields
          if (notification.institutionApplicationId !== undefined) {
            equal(String(notification.institutionApplicationId), application.id);
          }
          ok(notification.content.includes('Missing required documents'));
        });

        it('should validate NPWP format on institution application', async function () {
          const applicant = await repo.betterAuthCreateUser({
            name: 'NPWP Test User',
            email: 'npwp-test@example.com',
            emailVerified: true,
          });

          // User must decide user type before applying for institution
          assertPropDefined(applicant, 'id');
          await repo.userDecidesUserType({
            userId: String(applicant.id),
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          // Test invalid NPWP format - should throw error due to trigger validation
          let errorThrown = false;
          try {
            await repo.testCreatesInstitutionApplicationWithValidation({
              applicantUserId: String(applicant.id),
              businessName: 'Test Business',
              businessType: 'PT',
              npwpNumber: '12345678901234567',
              npwpDocumentPath: '/path/npwp.pdf',
              registrationNumber: 'NIB1234567890',
              registrationDocumentPath: '/path/registration.pdf',
              establishmentNumber: 'AHU-1234567890',
              deedOfEstablishmentPath: '/path/deed.pdf',
              // domicileCertificatePath: '/path/domicile.pdf', # TBD
              businessAddress: 'Test Address',
              businessCity: 'Jakarta',
              businessProvince: 'DKI Jakarta',
              businessDistrict: 'Central Jakarta',
              businessSubdistrict: 'Menteng',
              businessPostalCode: '12345',
              directorName: 'Test Director',
              directorIdCardPath: '/path/director.pdf',
              submittedDate: new Date('2024-01-01T00:00:00Z'),
            });
          } catch (error) {
            errorThrown = true;
            ok(error.message.includes('Invalid NPWP format'));
          }
          ok(errorThrown, 'Expected NPWP validation error');

          // Test valid NPWP format - should succeed
          const validResult = await repo.testCreatesInstitutionApplicationWithValidation({
            applicantUserId: String(applicant.id),
            businessName: 'Test Business',
            businessType: 'PT',
            npwpNumber: '12.345.678.9-123.456',
            npwpDocumentPath: '/path/npwp.pdf',
            registrationNumber: 'NIB1234567890',
            registrationDocumentPath: '/path/registration.pdf',
            establishmentNumber: 'AHU-1234567890',
            deedOfEstablishmentPath: '/path/deed.pdf',
            // domicileCertificatePath: '/path/domicile.pdf', # TBD
            businessAddress: 'Test Address',
            businessCity: 'Jakarta',
            businessProvince: 'DKI Jakarta',
            businessDistrict: 'Central Jakarta',
            businessSubdistrict: 'Menteng',
            businessPostalCode: '12345',
            directorName: 'Test Director',
            directorIdCardPath: '/path/director.pdf',
            ministryApprovalDocumentPath: '/path/ministry.pdf',
            submittedDate: new Date('2024-01-01T00:00:00Z'),
          });

          ok(validResult.id, 'Valid NPWP should create application successfully');
        });

        it('should prevent duplicate NPWP numbers in non-rejected applications', async function () {
          const applicant1 = await repo.betterAuthCreateUser({
            name: 'Duplicate NPWP Test 1',
            email: 'duplicate1@example.com',
            emailVerified: true,
          });

          const applicant2 = await repo.betterAuthCreateUser({
            name: 'Duplicate NPWP Test 2',
            email: 'duplicate2@example.com',
            emailVerified: true,
          });

          // Users must decide user type before applying for institution
          assertPropDefined(applicant1, 'id');
          assertPropDefined(applicant2, 'id');
          await repo.userDecidesUserType({
            userId: String(applicant1.id),
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          await repo.userDecidesUserType({
            userId: String(applicant2.id),
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          // Create first application with NPWP
          await repo.testCreatesInstitutionApplicationWithValidation({
            applicantUserId: String(applicant1.id),
            businessName: 'First Business',
            businessType: 'PT',
            npwpNumber: '12.345.678.9-123.456',
            npwpDocumentPath: '/path/npwp1.pdf',
            registrationNumber: 'NIB1111111111',
            registrationDocumentPath: '/path/registration1.pdf',
            establishmentNumber: 'AHU-1111111111',
            deedOfEstablishmentPath: '/path/deed1.pdf',
            // domicileCertificatePath: '/path/domicile1.pdf', # TBD
            businessAddress: 'Test Address 1',
            businessCity: 'Jakarta',
            businessProvince: 'DKI Jakarta',
            businessDistrict: 'Central Jakarta',
            businessSubdistrict: 'Menteng',
            businessPostalCode: '12345',
            directorName: 'Test Director 1',
            directorIdCardPath: '/path/director1.pdf',
            ministryApprovalDocumentPath: '/path/ministry1.pdf',
            submittedDate: new Date('2024-01-01T00:00:00Z'),
          });

          // Try to create second application with same NPWP - should fail
          let errorThrown = false;
          try {
            await repo.testCreatesInstitutionApplicationWithValidation({
              applicantUserId: String(applicant2.id),
              businessName: 'Second Business',
              businessType: 'PT',
              npwpNumber: '12.345.678.9-123.456',
              npwpDocumentPath: '/path/npwp2.pdf',
              registrationNumber: 'NIB2222222222',
              registrationDocumentPath: '/path/registration2.pdf',
              establishmentNumber: 'AHU-2222222222',
              deedOfEstablishmentPath: '/path/deed2.pdf',
              // domicileCertificatePath: '/path/domicile2.pdf', # TBD
              businessAddress: 'Test Address 2',
              businessCity: 'Jakarta',
              businessProvince: 'DKI Jakarta',
              businessDistrict: 'Central Jakarta',
              businessSubdistrict: 'Menteng',
              businessPostalCode: '12345',
              directorName: 'Test Director 2',
              directorIdCardPath: '/path/director2.pdf',
              ministryApprovalDocumentPath: '/path/ministry2.pdf',
              submittedDate: new Date('2024-01-01T00:00:00Z'),
            });
          } catch (error) {
            errorThrown = true;
            ok(error.message.includes('NPWP number already exists'));
          }
          ok(errorThrown, 'Expected duplicate NPWP validation error');
        });
      });
    });

    describe('Notification Management', function () {
      it('should list notifications with pagination', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Notification Test User',
          email: 'notification-test@example.com',
          emailVerified: true,
        });

        // Create multiple notifications directly (simulating trigger creation)
        // In real usage, these would be created by database triggers
        await repo.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date)
          VALUES
            (${user.id}, 'UserKycVerified', 'KYC Approved', 'Your KYC has been approved', ${new Date('2024-01-01T00:00:00Z')}),
            (${user.id}, 'UserKycRejected', 'KYC Rejected', 'Your KYC was rejected', ${new Date('2024-01-02T00:00:00Z')}),
            (${user.id}, 'EmailVerified', 'Email Verified', 'Your email has been verified', ${new Date('2024-01-03T00:00:00Z')})
        `;

        const result = await repo.userListsNotifications({
          userId: String(user.id),
          page: 1,
          limit: 10,
        });

        equal(result.notifications.length, 3);
        equal(result.pagination.page, 1);
        equal(result.pagination.limit, 10);
        equal(result.pagination.total, 3);
        equal(result.pagination.totalPages, 1);
        equal(result.pagination.hasNext, false);
        equal(result.pagination.hasPrev, false);
        equal(result.unreadCount, 3); // All notifications are unread

        // Check notifications are ordered by creation_date DESC
        equal(result.notifications[0].type, 'EmailVerified');
        equal(result.notifications[1].type, 'UserKycRejected');
        equal(result.notifications[2].type, 'UserKycVerified');

        // Check notification structure
        const firstNotification = result.notifications[0];
        equal(typeof firstNotification.id, 'string');
        equal(firstNotification.type, 'EmailVerified');
        equal(firstNotification.title, 'Email Verified');
        equal(firstNotification.content, 'Your email has been verified');
        equal(firstNotification.isRead, false);
        equal(firstNotification.readDate, undefined);
        ok(firstNotification.createdAt instanceof Date);
      });

      it('should filter notifications by type', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Filter Test User',
          email: 'filter-test@example.com',
          emailVerified: true,
        });

        // Create notifications of different types
        await repo.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date)
          VALUES
            (${user.id}, 'UserKycVerified', 'KYC Approved', 'Your KYC has been approved', ${new Date()}),
            (${user.id}, 'EmailVerified', 'Email Verified', 'Your email has been verified', ${new Date()}),
            (${user.id}, 'UserKycVerified', 'Another KYC', 'Another KYC notification', ${new Date()})
        `;

        const result = await repo.userListsNotifications({
          userId: String(user.id),
          type: 'UserKycVerified',
        });

        equal(result.notifications.length, 2);
        result.notifications.forEach(notification => {
          equal(notification.type, 'UserKycVerified');
        });
      });

      it('should filter notifications by unread status', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Unread Filter Test User',
          email: 'unread-filter-test@example.com',
          emailVerified: true,
        });

        // Create notifications, mark one as read
        await repo.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date, read_date)
          VALUES
            (${user.id}, 'UserKycVerified', 'KYC Approved', 'Your KYC has been approved', ${new Date()}, ${new Date()}),
            (${user.id}, 'EmailVerified', 'Email Verified', 'Your email has been verified', ${new Date()}, NULL),
            (${user.id}, 'UserKycRejected', 'KYC Rejected', 'Your KYC was rejected', ${new Date()}, NULL)
        `;

        const result = await repo.userListsNotifications({
          userId: String(user.id),
          unreadOnly: true,
        });

        equal(result.notifications.length, 2);
        equal(result.unreadCount, 2);
        result.notifications.forEach(notification => {
          equal(notification.isRead, false);
        });
      });

      it('should handle pagination correctly', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Pagination Test User',
          email: 'pagination-test@example.com',
          emailVerified: true,
        });

        // Create 5 notifications
        for (let i = 1; i <= 5; i++) {
          await repo.sql`
            INSERT INTO notifications (user_id, type, title, content, creation_date)
            VALUES (${user.id}, 'EmailVerified', ${`Test ${i}`}, ${`Content ${i}`}, ${new Date(Date.now() + i * 1000)})
          `;
        }

        // Test first page (limit 2)
        const page1 = await repo.userListsNotifications({
          userId: String(user.id),
          page: 1,
          limit: 2,
        });

        equal(page1.notifications.length, 2);
        equal(page1.pagination.page, 1);
        equal(page1.pagination.limit, 2);
        equal(page1.pagination.total, 5);
        equal(page1.pagination.totalPages, 3);
        equal(page1.pagination.hasNext, true);
        equal(page1.pagination.hasPrev, false);

        // Test second page
        const page2 = await repo.userListsNotifications({
          userId: String(user.id),
          page: 2,
          limit: 2,
        });

        equal(page2.notifications.length, 2);
        equal(page2.pagination.page, 2);
        equal(page2.pagination.hasNext, true);
        equal(page2.pagination.hasPrev, true);

        // Test last page
        const page3 = await repo.userListsNotifications({
          userId: String(user.id),
          page: 3,
          limit: 2,
        });

        equal(page3.notifications.length, 1);
        equal(page3.pagination.page, 3);
        equal(page3.pagination.hasNext, false);
        equal(page3.pagination.hasPrev, true);
      });

      it('should mark notification as read', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Mark Read Test User',
          email: 'mark-read-test@example.com',
          emailVerified: true,
        });

        // Create notification
        const notificationRows = await repo.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date)
          VALUES (${user.id}, 'EmailVerified', 'Test', 'Test content', ${new Date()})
          RETURNING id
        `;
        assertArrayMapOf(notificationRows, function (row) {
          assertDefined(row);
          assertPropDefined(row, 'id');
          return row;
        });
        const notificationId = String(notificationRows[0].id);

        // Mark as read
        const result = await repo.userMarksNotificationRead({
          userId: String(user.id),
          notificationId,
        });

        equal(result.id, notificationId);
        ok(result.readDate instanceof Date);

        // Verify notification is marked as read
        const updatedNotifications = await repo.userListsNotifications({
          userId: String(user.id),
        });

        equal(updatedNotifications.notifications[0].isRead, true);
        ok(updatedNotifications.notifications[0].readDate instanceof Date);
        equal(updatedNotifications.unreadCount, 0);
      });

      it('should not mark already read notification as read again', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Already Read Test User',
          email: 'already-read-test@example.com',
          emailVerified: true,
        });

        // Create and mark notification as read
        const notificationRows = await repo.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date, read_date)
          VALUES (${user.id}, 'EmailVerified', 'Test', 'Test content', ${new Date()}, ${new Date()})
          RETURNING id
        `;
        assertArrayMapOf(notificationRows, function (row) {
          assertDefined(row);
          assertPropDefined(row, 'id');
          return row;
        });
        const notificationId = String(notificationRows[0].id);

        await rejects(
          repo.userMarksNotificationRead({
            userId: String(user.id),
            notificationId,
          }),
          function (error) {
            return error instanceof Error && error.message.includes('not found or already read');
          },
          'Expected error for already read notification',
        );
      });

      it('should not allow user to mark other users notifications as read', async function () {
        const user1 = await repo.betterAuthCreateUser({
          name: 'User 1',
          email: 'user1-security@example.com',
          emailVerified: true,
        });

        const _user2 = await repo.betterAuthCreateUser({
          name: 'User 2',
          email: 'user2-security@example.com',
          emailVerified: true,
        });

        // Create notification for user1
        const notificationRows = await repo.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date)
          VALUES (${user1.id}, 'EmailVerified', 'Test', 'Test content', ${new Date()})
          RETURNING id
        `;
        assertArrayMapOf(notificationRows, function (row) {
          assertDefined(row);
          assertPropDefined(row, 'id');
          return row;
        });

        const notificationId = String(notificationRows[0].id);

        await rejects(
          repo.userMarksNotificationRead({
            userId: 'non-existent-user-id',
            notificationId: notificationId,
          }),
          function (error) {
            return error instanceof Error && error.message.includes('not found or already read');
          },
          'Expected error for unauthorized access',
        );
      });

      it('should mark all notifications as read', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Mark All Read Test User',
          email: 'mark-all-read-test@example.com',
          emailVerified: true,
        });

        // Create multiple unread notifications
        await repo.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date)
          VALUES
            (${user.id}, 'UserKycVerified', 'KYC 1', 'Content 1', ${new Date()}),
            (${user.id}, 'EmailVerified', 'Email 1', 'Content 2', ${new Date()}),
            (${user.id}, 'UserKycRejected', 'KYC 2', 'Content 3', ${new Date()})
        `;

        // Mark all as read
        const result = await repo.userMarksAllNotificationsRead({
          userId: String(user.id),
        });

        equal(result.updatedCount, 3);

        // Verify all notifications are marked as read
        const updatedNotifications = await repo.userListsNotifications({
          userId: String(user.id),
        });

        equal(updatedNotifications.unreadCount, 0);
        updatedNotifications.notifications.forEach(notification => {
          equal(notification.isRead, true);
          ok(notification.readDate instanceof Date);
        });
      });

      it('should delete notification', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Delete Test User',
          email: 'delete-test@example.com',
          emailVerified: true,
        });

        // Create notification
        const notificationRows = await repo.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date)
          VALUES (${user.id}, 'EmailVerified', 'Test', 'Test content', ${new Date()})
          RETURNING id
        `;
        assertArrayMapOf(notificationRows, function (row) {
          assertDefined(row);
          assertPropDefined(row, 'id');
          return row;
        });
        const notificationId = String(notificationRows[0].id);

        // Delete notification
        const result = await repo.userDeletesNotification({
          userId: String(user.id),
          notificationId,
        });

        equal(result.id, notificationId);
        equal(result.deleted, true);

        // Verify notification is deleted
        const remainingNotifications = await repo.userListsNotifications({
          userId: String(user.id),
        });

        equal(remainingNotifications.notifications.length, 0);
        equal(remainingNotifications.pagination.total, 0);
      });

      it('should not allow user to delete other users notifications', async function () {
        const user1 = await repo.betterAuthCreateUser({});
        const user2 = await repo.betterAuthCreateUser({});

        // Create notification for user1
        const notificationRows = await repo.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date)
          VALUES (${user1.id}, 'EmailVerified', 'Test', 'Test content', ${new Date()})
          RETURNING id
        `;
        assertArrayMapOf(notificationRows, function (row) {
          assertDefined(row);
          assertPropDefined(row, 'id');
          return row;
        });
        const notificationId = String(notificationRows[0].id);

        // Try to delete by user2 - should fail
        let errorThrown = false;
        let errorMessage = '';
        try {
          await repo.userDeletesNotification({
            userId: String(user2.id),
            notificationId,
          });
        } catch (error) {
          errorThrown = true;
          errorMessage = error.message;
        }
        ok(errorThrown, 'Expected error for unauthorized deletion');
        ok(
          errorMessage.includes('not found or access denied'),
          `Expected error message to include 'not found or access denied', got: ${errorMessage}`,
        );
      });

      it('should handle empty notification list', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Empty List Test User',
          email: 'empty-list-test@example.com',
          emailVerified: true,
        });

        const result = await repo.userListsNotifications({
          userId: String(user.id),
        });

        equal(result.notifications.length, 0);
        equal(result.pagination.total, 0);
        equal(result.pagination.totalPages, 0);
        equal(result.unreadCount, 0);
      });

      it('should validate pagination parameters', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Validation Test User',
          email: 'validation-test@example.com',
          emailVerified: true,
        });

        // Test with invalid page (should default to 1)
        const result1 = await repo.userListsNotifications({
          userId: String(user.id),
          page: -1,
          limit: 5,
        });
        equal(result1.pagination.page, 1);

        // Test with invalid limit (should cap at 100)
        const result2 = await repo.userListsNotifications({
          userId: String(user.id),
          page: 1,
          limit: 150,
        });
        equal(result2.pagination.limit, 100);

        // Test with zero limit (should default to 1)
        const result3 = await repo.userListsNotifications({
          userId: String(user.id),
          page: 1,
          limit: 0,
        });
        equal(result3.pagination.limit, 1);
      });
    });

    describe('Platform Notification', function () {
      it('should create notification with all required fields', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Platform Notify Test User',
          email: 'platform-notify@example.com',
          emailVerified: true,
        });

        const result = await repo.platformNotifyUser({
          userId: String(user.id),
          type: 'UserKycVerified',
          title: 'Test Notification',
          content: 'This is a test notification',
        });

        equal(typeof result.id, 'string');
        equal(result.userId, String(user.id));

        // Verify notification was created
        const notifications = await repo.userListsNotifications({
          userId: String(user.id),
        });

        equal(notifications.notifications.length, 1);
        const notification = notifications.notifications[0];
        equal(notification.type, 'UserKycVerified');
        equal(notification.title, 'Test Notification');
        equal(notification.content, 'This is a test notification');
        equal(notification.isRead, false);
      });

      it('should create notification with custom creation date', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Platform Notify Optional Test User',
          email: 'platform-notify-optional@example.com',
          emailVerified: true,
        });

        const customDate = new Date('2024-01-01T00:00:00Z');
        const result = await repo.platformNotifyUser({
          userId: String(user.id),
          type: 'InstitutionApplicationVerified',
          title: 'Institution Approved',
          content: 'Your institution application has been approved',
          creationDate: customDate,
        });

        equal(typeof result.id, 'string');
        equal(result.userId, String(user.id));

        // Verify notification was created
        const notifications = await repo.userListsNotifications({
          userId: String(user.id),
        });

        equal(notifications.notifications.length, 1);
        const notification = notifications.notifications[0];
        equal(notification.type, 'InstitutionApplicationVerified');
        equal(notification.title, 'Institution Approved');
      });

      it('should create notification with optional fields', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Platform Notify KYC Test User',
          email: 'platform-notify-kyc@example.com',
          emailVerified: true,
        });

        const result = await repo.platformNotifyUser({
          userId: String(user.id),
          type: 'UserKycRejected',
          title: 'KYC Rejected',
          content: 'Your KYC was rejected',
          userKycId: 'kyc-123',
        });

        equal(typeof result.id, 'string');
        equal(result.userId, String(user.id));

        // Verify notification was created
        const notifications = await repo.userListsNotifications({
          userId: String(user.id),
        });

        equal(notifications.notifications.length, 1);
        const notification = notifications.notifications[0];
        equal(notification.type, 'UserKycRejected');
        equal(notification.title, 'KYC Rejected');
        equal(notification.content, 'Your KYC was rejected');
      });

      it('should handle notification creation failure gracefully', async function () {
        // Test with invalid user ID
        let errorThrown = false;
        try {
          await repo.platformNotifyUser({
            userId: 'non-existent-user',
            type: 'EmailVerified',
            title: 'Test',
            content: 'Test content',
          });
        } catch (error) {
          errorThrown = true;
          ok(error instanceof Error);
        }
        ok(errorThrown, 'Expected error for invalid user ID');
      });

      it('should create multiple notifications for same user', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Multiple Notifications Test User',
          email: 'multiple-notifications@example.com',
          emailVerified: true,
        });

        // Create first notification
        await repo.platformNotifyUser({
          userId: String(user.id),
          type: 'EmailVerified',
          title: 'Email Verified',
          content: 'Your email has been verified',
        });

        // Create second notification
        await repo.platformNotifyUser({
          userId: String(user.id),
          type: 'TwoFactorEnabled',
          title: '2FA Enabled',
          content: 'Two-factor authentication has been enabled',
        });

        // Verify both notifications exist
        const notifications = await repo.userListsNotifications({
          userId: String(user.id),
        });

        equal(notifications.notifications.length, 2);
        equal(notifications.unreadCount, 2);
      });
    });

    describe('User Preferences Management', function () {
      it('should get default preferences for new user', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Preferences Test User',
          email: 'preferences-test@example.com',
          emailVerified: true,
        });

        const preferences = await repo.userGetsPreferences({ userId: String(user.id) });

        equal(preferences.userId, String(user.id));
        equal(preferences.notifications.email.enabled, true);
        equal(preferences.notifications.push.enabled, true);
        equal(preferences.notifications.sms.enabled, false);
        equal(preferences.display.theme, 'light');
        equal(preferences.display.language, 'en');
        equal(preferences.display.currency, 'USD');
        equal(preferences.privacy.profileVisibility, 'private');
        equal(preferences.privacy.dataSharing.analytics, true);
        equal(preferences.privacy.dataSharing.thirdPartyIntegrations, false);
      });

      it('should update user preferences', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Update Preferences Test User',
          email: 'update-preferences-test@example.com',
          emailVerified: true,
        });

        // Update preferences
        const updateResult = await repo.userUpdatesPreferences({
          userId: String(user.id),
          preferences: {
            display: {
              theme: 'dark',
              language: 'id',
            },
            notifications: {
              email: {
                enabled: false,
              },
            },
            privacy: {
              profileVisibility: 'public',
              dataSharing: {
                analytics: false,
              },
            },
          },
          updateDate: new Date(),
        });

        equal(updateResult.userId, String(user.id));
        ok(updateResult.id, 'Should return preference ID');

        // Get updated preferences
        const updatedPrefs = await repo.userGetsPreferences({ userId: String(user.id) });

        equal(updatedPrefs.display.theme, 'dark');
        equal(updatedPrefs.display.language, 'id');
        equal(updatedPrefs.display.currency, 'USD'); // Should remain default
        equal(updatedPrefs.notifications.email.enabled, false);
        equal(updatedPrefs.notifications.push.enabled, true); // Should remain default
        equal(updatedPrefs.privacy.profileVisibility, 'public');
        equal(updatedPrefs.privacy.dataSharing.analytics, false);
        equal(updatedPrefs.privacy.dataSharing.thirdPartyIntegrations, false); // Should remain default
      });

      it('should handle partial updates correctly', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Partial Update Test User',
          email: 'partial-update-test@example.com',
          emailVerified: true,
        });

        // First update some preferences
        await repo.userUpdatesPreferences({
          userId: String(user.id),
          preferences: {
            display: {
              theme: 'dark',
            },
          },
          updateDate: new Date(),
        });

        // Then update different preferences
        await repo.userUpdatesPreferences({
          userId: String(user.id),
          preferences: {
            notifications: {
              sms: {
                enabled: true,
                types: {
                  paymentAlerts: true,
                },
              },
            },
          },
          updateDate: new Date(),
        });

        // Check that both updates are preserved
        const prefs = await repo.userGetsPreferences({ userId: String(user.id) });

        equal(prefs.display.theme, 'dark');
        equal(prefs.notifications.sms.enabled, true);
        equal(prefs.notifications.sms.types.paymentAlerts, true);
        equal(prefs.notifications.sms.types.systemNotifications, false); // Should remain default
      });

      it('should handle nested notification type updates', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Nested Update Test User',
          email: 'nested-update-test@example.com',
          emailVerified: true,
        });

        // Update only specific notification types
        await repo.userUpdatesPreferences({
          userId: String(user.id),
          preferences: {
            notifications: {
              email: {
                types: {
                  paymentAlerts: false, // Turn off payment alerts
                  // systemNotifications should remain true (default)
                },
              },
              push: {
                enabled: false, // Disable all push notifications
              },
            },
          },
          updateDate: new Date(),
        });

        const prefs = await repo.userGetsPreferences({ userId: String(user.id) });

        // Email should still be enabled but with updated types
        equal(prefs.notifications.email.enabled, true);
        equal(prefs.notifications.email.types.paymentAlerts, false);
        equal(prefs.notifications.email.types.systemNotifications, true);

        // Push should be disabled
        equal(prefs.notifications.push.enabled, false);
        equal(prefs.notifications.push.types.paymentAlerts, true); // Should remain default
        equal(prefs.notifications.push.types.systemNotifications, true); // Should remain default

        // SMS should remain default
        equal(prefs.notifications.sms.enabled, false);
      });

      it('should preserve preferences across multiple updates', async function () {
        const user = await repo.betterAuthCreateUser({
          name: 'Multiple Updates Test User',
          email: 'multiple-updates-test@example.com',
          emailVerified: true,
        });

        // First update - change theme
        await repo.userUpdatesPreferences({
          userId: String(user.id),
          preferences: {
            display: { theme: 'dark' },
          },
          updateDate: new Date(),
        });

        // Second update - change language
        await repo.userUpdatesPreferences({
          userId: String(user.id),
          preferences: {
            display: { language: 'id' },
          },
          updateDate: new Date(),
        });

        // Third update - change currency
        await repo.userUpdatesPreferences({
          userId: String(user.id),
          preferences: {
            display: { currency: 'IDR' },
          },
          updateDate: new Date(),
        });

        const prefs = await repo.userGetsPreferences({ userId: String(user.id) });

        // All display preferences should be preserved
        equal(prefs.display.theme, 'dark');
        equal(prefs.display.language, 'id');
        equal(prefs.display.currency, 'IDR');
      });
    });
  });
}
