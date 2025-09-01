import { equal, ok } from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, suite } from 'node:test';

import { UserRepository } from './user.repository';

export async function runUserRepositoryTestSuite(
  createRepo: () => Promise<UserRepository>,
  teardownRepo: (repo: UserRepository) => Promise<void>,
): Promise<void> {
  await suite('UserRepository', function () {
    let repo: UserRepository;

    beforeEach(async function () {
      repo = await createRepo();
    });

    afterEach(async function () {
      await teardownRepo(repo);
    });

    describe('User Profile Management', function () {
      it('should update user profile with full name and profile picture', async function () {
        // First create a user via Better Auth
        const user = await repo.betterAuthCreateUser({
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
        });

        const updateDate = new Date('2024-01-01T00:00:00Z');
        const result = await repo.userUpdatesProfile({
          id: user.id,
          fullName: 'John Updated Doe',
          profilePictureUrl: 'https://example.com/profile.jpg',
          updateDate: updateDate,
        });

        equal(result.id, String(user.id));
        equal(result.fullName, 'John Updated Doe');
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
          id: user.id,
          fullName: 'Jane Updated Doe',
          updateDate: updateDate,
        });

        equal(result.id, String(user.id));
        equal(result.fullName, 'Jane Updated Doe');
        equal(result.profilePictureUrl, null);
        equal(result.updatedDate, updateDate);
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
          userId: user.id,
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const kycData = {
          userId: user.id,
          idCardPhoto: '/path/to/id-card.jpg',
          selfiePhoto: '/path/to/selfie.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          fullName: 'KYC User Full Name',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          phoneNumber: '+6281234567890',
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

        const result = await repo.userViewsKYCStatus({ userId: user.id });

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
          userId: user.id,
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        await repo.userSubmitsKyc({
          userId: user.id,
          idCardPhoto: '/path/to/id-card.jpg',
          selfiePhoto: '/path/to/selfie.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          fullName: 'Pending KYC User',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          phoneNumber: '+6281234567890',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userViewsKYCStatus({ userId: user.id });

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
          userId: user.id,
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userAppliesForInstitution({
          applicantUserId: user.id,
          businessName: 'Test Business Corp',
          applicationDate: new Date('2024-01-01T00:00:00Z'),
        });

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
          userId: invitedUser.id,
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Submit and approve KYC for invited user
        const invitedUserKyc = await repo.userSubmitsKyc({
          userId: invitedUser.id,
          idCardPhoto: '/path/to/invited-id-card.jpg',
          selfiePhoto: '/path/to/invited-selfie.jpg',
          selfieWithIdCardPhoto: '/path/to/invited-selfie-with-id.jpg',
          nik: '9876543210987654',
          fullName: 'Invited User',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Invited No. 123',
          postalCode: '12345',
          phoneNumber: '+6281234567890',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Admin approves invited user's KYC
        await repo.adminApprovesKYCParam({
          kycId: invitedUserKyc.id,
          verifierUserId: '1', // System user
          approvalDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Institution owner must decide user type and apply for institution first
        await repo.userDecidesUserType({
          userId: institutionUser.id,
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Apply for institution and get it approved to become an owner
        const application = await repo.userAppliesForInstitution({
          applicantUserId: institutionUser.id,
          businessName: 'Test Institution',
          applicationDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Admin approves the application (making the user an institution owner)
        const admin = await repo.betterAuthCreateUser({
          name: 'Admin',
          email: 'admin@example.com',
          emailVerified: true,
        });

        await repo.adminApprovesInstitutionApplication({
          applicationId: application.id,
          reviewerUserId: admin.id,
          approvalDate: new Date('2024-01-01T00:00:00Z'),
        });

        const invitation = await repo.ownerUserInvitesUserToInstitution({
          institutionId: institutionUser.id,
          userId: invitedUser.id,
          role: 'Finance',
          invitationDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userAcceptsInstitutionInvitation({
          invitationId: invitation.id,
          userId: invitedUser.id,
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
          userId: invitedUser.id,
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Submit and approve KYC for invited user
        const invitedUserKyc = await repo.userSubmitsKyc({
          userId: invitedUser.id,
          idCardPhoto: '/path/to/invited2-id-card.jpg',
          selfiePhoto: '/path/to/invited2-selfie.jpg',
          selfieWithIdCardPhoto: '/path/to/invited2-selfie-with-id.jpg',
          nik: '8765432109876543',
          fullName: 'Invited User 2',
          birthCity: 'Bandung',
          birthDate: new Date('1991-01-01'),
          province: 'West Java',
          city: 'Bandung',
          district: 'Central Bandung',
          subdistrict: 'Sumur Bandung',
          address: 'Jl. Invited2 No. 456',
          postalCode: '54321',
          phoneNumber: '+6281234567891',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Admin approves invited user's KYC
        await repo.adminApprovesKYCParam({
          kycId: invitedUserKyc.id,
          verifierUserId: '1', // System user
          approvalDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Institution owner must decide user type and apply for institution first
        await repo.userDecidesUserType({
          userId: institutionUser.id,
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Apply for institution and get it approved to become an owner
        const application = await repo.userAppliesForInstitution({
          applicantUserId: institutionUser.id,
          businessName: 'Test Institution 2',
          applicationDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Admin approves the application (making the user an institution owner)
        const admin = await repo.betterAuthCreateUser({
          name: 'Admin',
          email: 'admin@example.com',
          emailVerified: true,
        });

        await repo.adminApprovesInstitutionApplication({
          applicationId: application.id,
          reviewerUserId: admin.id,
          approvalDate: new Date('2024-01-01T00:00:00Z'),
        });

        const invitation = await repo.ownerUserInvitesUserToInstitution({
          institutionId: institutionUser.id,
          userId: invitedUser.id,
          role: 'Finance',
          invitationDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.userRejectsInstitutionInvitation({
          invitationId: invitation.id,
          userId: invitedUser.id,
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
          userId: user.id,
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const kyc = await repo.userSubmitsKyc({
          userId: user.id,
          idCardPhoto: '/path/to/id-card.jpg',
          selfiePhoto: '/path/to/selfie.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          fullName: 'KYC Approval User',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          phoneNumber: '+6281234567890',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.adminApprovesKYCParam({
          kycId: kyc.id,
          verifierUserId: admin.id,
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
        const status = await repo.userViewsKYCStatus({ userId: user.id });
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
          userId: user.id,
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const kyc = await repo.userSubmitsKyc({
          userId: user.id,
          idCardPhoto: '/path/to/id-card.jpg',
          selfiePhoto: '/path/to/selfie.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
          nik: '1234567890123456',
          fullName: 'KYC Rejection User',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 123',
          postalCode: '12345',
          phoneNumber: '+6281234567890',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.adminRejectsKyc({
          kycId: kyc.id,
          verifierUserId: admin.id,
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
        const status = await repo.userViewsKYCStatus({ userId: user.id });
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
          userId: user1.id,
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        await repo.userDecidesUserType({
          userId: user2.id,
          userType: 'Individual',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        await repo.userSubmitsKyc({
          userId: user1.id,
          idCardPhoto: '/path/to/id-card1.jpg',
          selfiePhoto: '/path/to/selfie1.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id1.jpg',
          nik: '1111111111111111',
          fullName: 'Pending User 1',
          birthCity: 'Jakarta',
          birthDate: new Date('1990-01-01'),
          province: 'DKI Jakarta',
          city: 'Jakarta',
          district: 'Central Jakarta',
          subdistrict: 'Menteng',
          address: 'Jl. Example No. 111',
          postalCode: '12345',
          phoneNumber: '+6281111111111',
          submissionDate: new Date('2024-01-01T00:00:00Z'),
        });

        await repo.userSubmitsKyc({
          userId: user2.id,
          idCardPhoto: '/path/to/id-card2.jpg',
          selfiePhoto: '/path/to/selfie2.jpg',
          selfieWithIdCardPhoto: '/path/to/selfie-with-id2.jpg',
          nik: '2222222222222222',
          fullName: 'Pending User 2',
          birthCity: 'Bandung',
          birthDate: new Date('1991-01-01'),
          province: 'West Java',
          city: 'Bandung',
          district: 'Central Bandung',
          subdistrict: 'Sumur Bandung',
          address: 'Jl. Example No. 222',
          postalCode: '54321',
          phoneNumber: '+6282222222222',
          submissionDate: new Date('2024-01-02T00:00:00Z'),
        });

        const result = await repo.adminViewsPendingKYCs();

        equal(result.kycs.length, 2);
        equal(result.kycs[0].fullName, 'Pending User 1');
        equal(result.kycs[0].nik, '1111111111111111');
        equal(result.kycs[1].fullName, 'Pending User 2');
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
          userId: applicant.id,
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const application = await repo.userAppliesForInstitution({
          applicantUserId: applicant.id,
          businessName: 'Approved Business Corp',
          applicationDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.adminApprovesInstitutionApplication({
          applicationId: application.id,
          reviewerUserId: admin.id,
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
          userId: applicant.id,
          userType: 'Institution',
          decisionDate: new Date('2024-01-01T00:00:00Z'),
        });

        const application = await repo.userAppliesForInstitution({
          applicantUserId: applicant.id,
          businessName: 'Rejected Business Corp',
          applicationDate: new Date('2024-01-01T00:00:00Z'),
        });

        const result = await repo.rejectInstitutionApplication({
          applicationId: application.id,
          reviewerUserId: admin.id,
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
          userId: user.id,
          institutionId: institution.id,
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
          userId: user.id,
          institutionId: institution.id,
          role: 'Finance',
          assignedDate: new Date('2024-01-01T00:00:00Z'),
        });

        // Then remove user from institution
        const result = await repo.adminRemoveUserFromInstitution({
          userId: user.id,
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
            userId: user.id,
            userType: 'Individual',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          const kyc = await repo.userSubmitsKyc({
            userId: user.id,
            idCardPhoto: '/path/to/id-card.jpg',
            selfiePhoto: '/path/to/selfie.jpg',
            selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
            nik: '1234567890123456',
            fullName: 'Trigger Test User',
            birthCity: 'Jakarta',
            birthDate: new Date('1990-01-01'),
            province: 'DKI Jakarta',
            city: 'Jakarta',
            district: 'Central Jakarta',
            subdistrict: 'Menteng',
            address: 'Jl. Example No. 123',
            postalCode: '12345',
            phoneNumber: '+6281234567890',
            submissionDate: new Date('2024-01-01T00:00:00Z'),
          });

          await repo.adminApprovesKYCParam({
            kycId: kyc.id,
            verifierUserId: admin.id,
            approvalDate: new Date('2024-01-02T00:00:00Z'),
          });

          // Check that trigger updated user's kyc_id
          const updatedUser = await repo.adminChecksUserKycId({ userId: user.id });
          equal(String(updatedUser.kycId), kyc.id);

          // Check that trigger created notification
          const notificationResult = await repo.adminViewsNotificationsByType({
            userId: user.id,
            type: 'UserKycVerified',
          });
          equal(notificationResult.notifications.length, 1);

          const notification = notificationResult.notifications[0];
          equal(notification.type, 'UserKycVerified');
          equal(notification.title, 'KYC Verification Approved');
          equal(String(notification.userKycId), kyc.id);
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
            userId: user.id,
            userType: 'Individual',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          const kyc = await repo.userSubmitsKyc({
            userId: user.id,
            idCardPhoto: '/path/to/id-card.jpg',
            selfiePhoto: '/path/to/selfie.jpg',
            selfieWithIdCardPhoto: '/path/to/selfie-with-id.jpg',
            nik: '1234567890123456',
            fullName: 'Rejection Test User',
            birthCity: 'Jakarta',
            birthDate: new Date('1990-01-01'),
            province: 'DKI Jakarta',
            city: 'Jakarta',
            district: 'Central Jakarta',
            subdistrict: 'Menteng',
            address: 'Jl. Example No. 123',
            postalCode: '12345',
            phoneNumber: '+6281234567890',
            submissionDate: new Date('2024-01-01T00:00:00Z'),
          });

          await repo.adminRejectsKyc({
            kycId: kyc.id,
            verifierUserId: admin.id,
            rejectionReason: 'Document quality is poor',
            rejectionDate: new Date('2024-01-02T00:00:00Z'),
          });

          // Check that trigger created rejection notification
          const notificationResult = await repo.adminViewsNotificationsByType({
            userId: user.id,
            type: 'UserKycRejected',
          });
          equal(notificationResult.notifications.length, 1);

          const notification = notificationResult.notifications[0];
          equal(notification.type, 'UserKycRejected');
          equal(notification.title, 'KYC Verification Rejected');
          equal(String(notification.userKycId), kyc.id);
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
            userId: applicant.id,
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          const application = await repo.userAppliesForInstitution({
            applicantUserId: applicant.id,
            businessName: 'Trigger Test Corp',
            applicationDate: new Date('2024-01-01T00:00:00Z'),
          });

          await repo.adminApprovesInstitutionApplication({
            applicationId: application.id,
            reviewerUserId: admin.id,
            approvalDate: new Date('2024-01-02T00:00:00Z'),
          });

          // Check that trigger updated user's institution data
          const updatedUser = await repo.adminChecksUserInstitutionData({ userId: applicant.id });
          equal(String(updatedUser.institutionUserId), String(applicant.id));
          equal(updatedUser.institutionRole, 'Owner');

          // Check that trigger created approval notification
          const notificationResult = await repo.adminViewsNotificationsByType({
            userId: applicant.id,
            type: 'InstitutionApplicationVerified',
          });
          equal(notificationResult.notifications.length, 1);

          const notification = notificationResult.notifications[0];
          equal(notification.type, 'InstitutionApplicationVerified');
          equal(notification.title, 'Institution Application Approved');
          equal(String(notification.institutionApplicationId), application.id);
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
            userId: applicant.id,
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          const application = await repo.userAppliesForInstitution({
            applicantUserId: applicant.id,
            businessName: 'Rejected Test Corp',
            applicationDate: new Date('2024-01-01T00:00:00Z'),
          });

          await repo.rejectInstitutionApplication({
            applicationId: application.id,
            reviewerUserId: admin.id,
            rejectionReason: 'Missing required documents',
            rejectionDate: new Date('2024-01-02T00:00:00Z'),
          });

          // Check that trigger created rejection notification
          const notificationResult = await repo.adminViewsNotificationsByType({
            userId: applicant.id,
            type: 'InstitutionApplicationRejected',
          });
          equal(notificationResult.notifications.length, 1);

          const notification = notificationResult.notifications[0];
          equal(notification.type, 'InstitutionApplicationRejected');
          equal(notification.title, 'Institution Application Rejected');
          equal(String(notification.institutionApplicationId), application.id);
          ok(notification.content.includes('Missing required documents'));
        });

        it('should validate NPWP format on institution application', async function () {
          const applicant = await repo.betterAuthCreateUser({
            name: 'NPWP Test User',
            email: 'npwp-test@example.com',
            emailVerified: true,
          });

          // User must decide user type before applying for institution
          await repo.userDecidesUserType({
            userId: applicant.id,
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          // Test invalid NPWP format - should throw error due to trigger validation
          let errorThrown = false;
          try {
            await repo.systemCreatesInstitutionApplicationWithValidation({
              applicantUserId: applicant.id,
              businessName: 'Test Business',
              npwpNumber: '12345678901234567',
              npwpDocumentPath: '/path/npwp.pdf',
              registrationNumber: 'NIB1234567890',
              registrationDocumentPath: '/path/registration.pdf',
              deedOfEstablishmentPath: '/path/deed.pdf',
              // domicileCertificatePath: '/path/domicile.pdf', # TBD
              businessAddress: 'Test Address',
              businessCity: 'Jakarta',
              businessProvince: 'DKI Jakarta',
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
          const validResult = await repo.systemCreatesInstitutionApplicationWithValidation({
            applicantUserId: applicant.id,
            businessName: 'Test Business',
            npwpNumber: '01.234.567.8-901.234',
            npwpDocumentPath: '/path/npwp.pdf',
            registrationNumber: 'NIB1234567890',
            registrationDocumentPath: '/path/registration.pdf',
            deedOfEstablishmentPath: '/path/deed.pdf',
            // domicileCertificatePath: '/path/domicile.pdf', # TBD
            businessAddress: 'Test Address',
            businessCity: 'Jakarta',
            businessProvince: 'DKI Jakarta',
            businessPostalCode: '12345',
            directorName: 'Test Director',
            directorIdCardPath: '/path/director.pdf',
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
          await repo.userDecidesUserType({
            userId: applicant1.id,
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          await repo.userDecidesUserType({
            userId: applicant2.id,
            userType: 'Institution',
            decisionDate: new Date('2024-01-01T00:00:00Z'),
          });

          // Create first application with NPWP
          await repo.systemCreatesInstitutionApplicationWithValidation({
            applicantUserId: applicant1.id,
            businessName: 'First Business',
            npwpNumber: '01.234.567.8-901.234',
            npwpDocumentPath: '/path/npwp1.pdf',
            registrationNumber: 'NIB1111111111',
            registrationDocumentPath: '/path/registration1.pdf',
            deedOfEstablishmentPath: '/path/deed1.pdf',
            // domicileCertificatePath: '/path/domicile1.pdf', # TBD
            businessAddress: 'Test Address 1',
            businessCity: 'Jakarta',
            businessProvince: 'DKI Jakarta',
            businessPostalCode: '12345',
            directorName: 'Test Director 1',
            directorIdCardPath: '/path/director1.pdf',
            submittedDate: new Date('2024-01-01T00:00:00Z'),
          });

          // Try to create second application with same NPWP - should fail
          let errorThrown = false;
          try {
            await repo.systemCreatesInstitutionApplicationWithValidation({
              applicantUserId: applicant2.id,
              businessName: 'Second Business',
              npwpNumber: '01.234.567.8-901.234',
              npwpDocumentPath: '/path/npwp2.pdf',
              registrationNumber: 'NIB2222222222',
              registrationDocumentPath: '/path/registration2.pdf',
              deedOfEstablishmentPath: '/path/deed2.pdf',
              // domicileCertificatePath: '/path/domicile2.pdf', # TBD
              businessAddress: 'Test Address 2',
              businessCity: 'Jakarta',
              businessProvince: 'DKI Jakarta',
              businessPostalCode: '12345',
              directorName: 'Test Director 2',
              directorIdCardPath: '/path/director2.pdf',
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
  });
}
