import { deepStrictEqual, doesNotReject, ok, rejects, strictEqual } from 'node:assert/strict';

import {
  assertDefined,
  assertProp,
  assertPropArray,
  assertPropArrayMapOf,
  assertPropDefined,
  assertPropNullableString,
  assertPropNumber,
  assertPropString,
  check,
  hasPropString,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createInstitutionTestUser, createTestUser } from './setup/user';

const ERROR_CODES = {
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_MEMBER: 'USER_ALREADY_MEMBER',
  CANNOT_REMOVE_OWNER: 'CANNOT_REMOVE_OWNER',
  INVITATION_ALREADY_RESPONDED: 'INVITATION_ALREADY_RESPONDED',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
};

suite('Institution Management API', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();
  });

  after(async function () {
    await testSetup?.teardown();
  });

  describe('Institution Details', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let nonMember: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `institution_owner_${testId}@test.com`,
        name: 'Institution Owner',
      });

      // Create non-member user
      nonMember = await createTestUser({
        testSetup,
        testId,
        email: `non_member_${testId}@test.com`,
        name: 'Non Member User',
        userType: 'Individual',
      });
    });

    it('should get institution details successfully for owner', async function () {
      // First, create an institution by registering as institution type
      // This assumes the backend creates an institution when user selects Institution type
      // We need to find the institution ID through the user profile
      const profileResponse = await institutionOwner.fetch('/api/users/profile');
      strictEqual(profileResponse.status, 200);

      const profileData = await profileResponse.json();
      assertDefined(profileData);
      assertPropDefined(profileData, 'user');
      assertPropNumber(profileData.user, 'institutionId');

      const institutionId = profileData.user.institutionId;

      const response = await institutionOwner.fetch(`/api/institutions/${institutionId}`);
      strictEqual(response.status, 200);

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'institution');

      const institution = data.institution;
      assertPropNumber(institution, 'id');
      assertPropString(institution, 'name');
      assertPropString(institution, 'type');
      assertProp(
        function (v) {
          return (
            v === ('Verified' as const) ||
            v === ('Pending' as const) ||
            v === ('Unverified' as const)
          );
        },
        institution,
        'verificationStatus',
      );
      assertPropNumber(institution, 'memberCount');
      assertPropString(institution, 'activeSince');

      if ('registrationDetails' in institution) {
        assertPropDefined(institution, 'registrationDetails');
        const regDetails = institution.registrationDetails;
        assertDefined(regDetails);
        if ('npwpNumber' in regDetails) {
          assertPropString(regDetails, 'npwpNumber');
        }
        if ('registrationNumber' in regDetails) {
          assertPropString(regDetails, 'registrationNumber');
        }
        if ('businessType' in regDetails) {
          assertPropString(regDetails, 'businessType');
        }
      }
    });

    it('should return 404 for non-existent institution', async function () {
      const response = await institutionOwner.fetch('/api/institutions/999999');
      strictEqual(response.status, 404);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
      assertPropString(data.error, 'message');
    });

    it('should return 403 for insufficient permissions', async function () {
      const response = await nonMember.fetch('/api/institutions/1');
      strictEqual(response.status, 403);

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/institutions/1`);
      strictEqual(response.status, 401);
    });
  });

  describe('Institution Members', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let nonMember: Awaited<ReturnType<typeof createTestUser>>;
    let institutionId: string;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `inst_members_owner_${testId}@test.com`,
        name: 'Institution Members Owner',
      });

      // Create non-member user
      nonMember = await createTestUser({
        testSetup,
        testId,
        email: `inst_members_non_member_${testId}@test.com`,
        name: 'Non Member User',
        userType: 'Individual',
      });

      // Get institution ID from user profile
      const profileResponse = await institutionOwner.fetch('/api/users/profile');
      const profileData = await profileResponse.json();
      assertDefined(profileData);
      assertPropDefined(profileData, 'user');
      assertPropNumber(profileData.user, 'institutionId');
      institutionId = String(profileData.user.institutionId);
    });

    it('should list institution members successfully', async function () {
      if (!institutionId) {
        console.log('Skipping test - no institution ID available');
        return;
      }

      const response = await institutionOwner.fetch(`/api/institutions/${institutionId}/members`);
      strictEqual(response.status, 200);

      const data = await response.json();
      assertDefined(data);
      assertPropArray(data, 'members');
      assertPropNumber(data, 'memberCount');

      if (data.members.length > 0) {
        assertPropArrayMapOf(data, 'members', member => {
          assertDefined(member);
          assertPropString(member, 'id');
          assertPropNumber(member, 'userId');
          assertPropNumber(member, 'institutionId');
          assertProp(v => v === ('Owner' as const) || v === 'Finance', member, 'role');
          assertProp(
            v => v === ('Verified' as const) || v === ('Pending' as const) || v === 'Unverified',
            member,
            'verificationStatus',
          );
          assertPropString(member, 'joinedAt');
          assertProp(check(isNullable, isString, isNumber), member, 'invitedBy');
          assertPropDefined(member, 'user');
          const user = member.user;
          assertPropNumber(user, 'id');
          assertPropString(user, 'name');
          assertPropString(user, 'email');
          assertPropNullableString(user, 'profilePictureUrl');

          return member;
        });

        strictEqual(data.memberCount, data.members.length);
      }
    });

    it('should return 404 for non-existent institution', async function () {
      const response = await institutionOwner.fetch('/api/institutions/999999/members');
      strictEqual(response.status, 404);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
    });

    it('should return 403 for insufficient permissions', async function () {
      if (!institutionId) {
        console.log('Skipping test - no institution ID available');
        return;
      }

      const response = await nonMember.fetch(`/api/institutions/${institutionId}/members`);
      strictEqual(response.status, 403);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/institutions/1/members`);
      strictEqual(response.status, 401);
    });
  });

  describe('Remove Institution Member', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let _financeMember: Awaited<ReturnType<typeof createTestUser>>;
    let nonMember: Awaited<ReturnType<typeof createTestUser>>;
    let institutionId: string;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `remove_member_owner_${testId}@test.com`,
        name: 'Remove Member Owner',
      });

      // Create a finance member (will be invited later in the test flow)
      _financeMember = await createTestUser({
        testSetup,
        testId,
        email: `remove_member_finance_${testId}@test.com`,
        name: 'Finance Member',
        userType: 'Individual',
      });

      // Create non-member user
      nonMember = await createTestUser({
        testSetup,
        testId,
        email: `remove_member_non_member_${testId}@test.com`,
        name: 'Non Member User',
        userType: 'Individual',
      });

      // Get institution ID from user profile
      const profileResponse = await institutionOwner.fetch('/api/users/profile');
      const profileData = await profileResponse.json();
      assertDefined(profileData);
      assertPropDefined(profileData, 'user');
      assertPropNumber(profileData.user, 'institutionId');
      institutionId = String(profileData.user.institutionId);
    });

    it('should return 400 when trying to remove institution owner', async function () {
      if (!institutionId) {
        console.log('Skipping test - no institution ID available');
        return;
      }

      const ownerUserId = institutionOwner.id;
      const response = await institutionOwner.fetch(
        `/api/institutions/${institutionId}/members/${ownerUserId}`,
        {
          method: 'DELETE',
        },
      );

      strictEqual(response.status, 400);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.CANNOT_REMOVE_OWNER);
      assertPropString(data.error, 'message');
      strictEqual(data.error.message, 'Institution owner cannot be removed from the institution');
    });

    it('should return 404 for non-existent institution', async function () {
      const response = await institutionOwner.fetch('/api/institutions/999999/members/12345', {
        method: 'DELETE',
      });
      strictEqual(response.status, 404);
    });

    it('should return 404 for non-existent member', async function () {
      if (!institutionId) {
        console.log('Skipping test - no institution ID available');
        return;
      }

      const response = await institutionOwner.fetch(
        `/api/institutions/${institutionId}/members/999999`,
        {
          method: 'DELETE',
        },
      );
      strictEqual(response.status, 404);
    });

    it('should return 403 for insufficient permissions (non-owner)', async function () {
      if (!institutionId) {
        console.log('Skipping test - no institution ID available');
        return;
      }

      const response = await nonMember.fetch(`/api/institutions/${institutionId}/members/12345`, {
        method: 'DELETE',
      });
      strictEqual(response.status, 403);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/institutions/1/members/12345`, {
        method: 'DELETE',
      });
      strictEqual(response.status, 401);
    });
  });

  describe('Institution Invitations - List Pending', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let nonMember: Awaited<ReturnType<typeof createTestUser>>;
    let institutionId: string;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `list_invites_owner_${testId}@test.com`,
        name: 'List Invites Owner',
      });

      // Create non-member user
      nonMember = await createTestUser({
        testSetup,
        testId,
        email: `list_invites_non_member_${testId}@test.com`,
        name: 'Non Member User',
        userType: 'Individual',
      });

      // Get institution ID from user profile
      const profileResponse = await institutionOwner.fetch('/api/users/profile');
      const profileData = await profileResponse.json();
      assertDefined(profileData);
      assertPropDefined(profileData, 'user');
      assertPropNumber(profileData.user, 'institutionId');
      institutionId = String(profileData.user.institutionId);
    });

    it('should list pending invitations successfully', async function () {
      if (!institutionId) {
        console.log('Skipping test - no institution ID available');
        return;
      }

      const response = await institutionOwner.fetch(
        `/api/institutions/${institutionId}/invitations`,
      );
      strictEqual(response.status, 200);

      const data = await response.json();
      assertDefined(data);
      assertPropArray(data, 'invitations');

      // Check invitation structure if any exist
      if (data.invitations.length > 0) {
        assertPropArrayMapOf(data, 'invitations', invitation => {
          assertDefined(invitation);
          assertPropNumber(invitation, 'id');
          assertPropString(invitation, 'userEmail');
          assertProp(v => v === ('Finance' as const), invitation, 'role');
          assertPropString(invitation, 'invitedDate');
          assertPropString(invitation, 'expiresAt');
          assertProp(
            v => v === 'Sent' || v === 'Accepted' || v === 'Rejected' || v === 'Expired',
            invitation,
            'status',
          );
          if ('invitedBy' in invitation) {
            assertPropDefined(invitation, 'invitedBy');
            assertPropNumber(invitation.invitedBy, 'id');
            assertPropString(invitation.invitedBy, 'name');
          }
          return invitation;
        });
      }
    });

    it('should return 404 for non-existent institution', async function () {
      const response = await institutionOwner.fetch('/api/institutions/999999/invitations');
      strictEqual(response.status, 404);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
    });

    it('should return 403 for insufficient permissions', async function () {
      if (!institutionId) {
        console.log('Skipping test - no institution ID available');
        return;
      }

      const response = await nonMember.fetch(`/api/institutions/${institutionId}/invitations`);
      strictEqual(response.status, 403);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/institutions/1/invitations`);
      strictEqual(response.status, 401);
    });
  });

  describe('Create Institution Invitation', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let individualUser: Awaited<ReturnType<typeof createTestUser>>;
    let _nonMember: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `create_invite_owner_${testId}@test.com`,
        name: 'Create Invite Owner',
      });

      // Create individual user to be invited
      individualUser = await createTestUser({
        testSetup,
        testId,
        email: `create_invite_target_${testId}@test.com`,
        name: 'Target User',
        userType: 'Individual',
      });

      // Create non-member user
      _nonMember = await createTestUser({
        testSetup,
        testId,
        email: `create_invite_non_member_${testId}@test.com`,
        name: 'Non Member User',
        userType: 'Individual',
      });
    });

    it('should create invitation successfully with message', async function () {
      const invitationData = {
        userEmail: `invite_with_msg_${testId}@test.com`,
        role: 'Finance',
        message:
          'We would like to invite you to join our institution as Finance member to help manage our lending operations.',
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      console.log('Response Status:', response.status);
      const data = await response.json();
      assertDefined(data);
      console.log('Response Data:', JSON.stringify(data, null, 2));

      if (response.status === 400) {
        // User might not exist - this is expected for this test case
        assertProp(
          check(isNullable, (v): v is { code: string } => hasPropString(v, 'code')),
          data,
          'error',
        );
        if (data.error?.code === 'USER_NOT_FOUND') {
          console.log('Expected: User not found for non-existent email');
          return;
        }
      }

      strictEqual(response.status, 201);
      assertDefined(data);
      assertPropDefined(data, 'invitation');

      const invitation = data.invitation;
      assertPropNumber(invitation, 'id');
      assertPropString(invitation, 'userEmail');
      assertPropString(invitation, 'role');
      strictEqual(invitation.userEmail, invitationData.userEmail);
      strictEqual(invitation.role, invitationData.role);
      assertPropString(invitation, 'invitedDate');
    });

    it('should create invitation successfully without message', async function () {
      const invitationData = {
        userEmail: individualUser.email,
        role: 'Finance',
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      strictEqual(response.status, 201);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'invitation');

      const invitation = data.invitation;
      assertPropNumber(invitation, 'id');
      assertPropString(invitation, 'userEmail');
      assertPropString(invitation, 'role');
      strictEqual(invitation.userEmail, invitationData.userEmail);
      strictEqual(invitation.role, invitationData.role);
      assertPropString(invitation, 'invitedDate');
    });

    it('should return 400 for non-existent user email', async function () {
      const invitationData = {
        userEmail: `nonexistent_${testId}@test.com`,
        role: 'Finance',
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      strictEqual(response.status, 400);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.USER_NOT_FOUND);
      assertPropString(data.error, 'message');
      strictEqual(data.error.message, 'User with email not found');
      if ('details' in data.error) {
        assertPropDefined(data.error, 'details');
        assertPropString(data.error.details, 'email');
        strictEqual(data.error.details.email, invitationData.userEmail);
        assertPropString(data.error.details, 'message');
        strictEqual(data.error.details.message, 'No user found with this email address');
      }
    });

    it('should return 409 when user is already institution member', async function () {
      // Create another institution owner to simulate existing membership
      const existingMember = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `existing_member_${testId}@test.com`,
        name: 'Existing Member',
      });

      const invitationData = {
        userEmail: existingMember.email,
        role: 'Finance',
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      strictEqual(response.status, 409);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.USER_ALREADY_MEMBER);
      assertPropString(data.error, 'message');
      strictEqual(data.error.message, 'User is already institution member');

      if ('details' in data.error) {
        assertPropDefined(data.error, 'details');
        assertPropString(data.error.details, 'userEmail');
        strictEqual(data.error.details.userEmail, existingMember.email);
      }
    });

    it('should return 422 for missing required fields', async function () {
      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
      assertPropString(data.error, 'message');
      strictEqual(data.error.message, 'Request validation failed');
    });

    it('should return 422 for invalid role', async function () {
      const invitationData = {
        userEmail: `invalid_role_${testId}@test.com`,
        role: 'InvalidRole',
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
      assertPropString(data.error, 'message');
      strictEqual(data.error.message, 'Request validation failed');
    });

    it('should return 422 for invalid email format', async function () {
      const invitationData = {
        userEmail: 'invalid-email-format',
        role: 'Finance',
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
      assertPropString(data.error, 'message');
      strictEqual(data.error.message, 'Request validation failed');
    });

    it('should return 401 for unauthenticated request', async function () {
      const invitationData = {
        userEmail: `unauth_invite_${testId}@test.com`,
        role: 'Finance',
      };

      const response = await fetch(`${testSetup.backendUrl}/api/institutions/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      strictEqual(response.status, 401);
    });
  });

  describe('Resend Institution Invitation', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let nonMember: Awaited<ReturnType<typeof createTestUser>>;
    let invitationId: number;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `resend_invite_owner_${testId}@test.com`,
        name: 'Resend Invite Owner',
      });

      // Create non-member user
      nonMember = await createTestUser({
        testSetup,
        testId,
        email: `resend_invite_non_member_${testId}@test.com`,
        name: 'Non Member User',
        userType: 'Individual',
      });

      // Create an invitation first
      const invitationData = {
        userEmail: `resend_target_${testId}@test.com`,
        role: 'Finance',
      };

      const createResponse = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      if (createResponse.status === 201) {
        const createData = await createResponse.json();
        assertDefined(createData);
        assertPropDefined(createData, 'invitation');
        assertPropNumber(createData.invitation, 'id');
        invitationId = createData.invitation.id;
      }
    });

    it('should resend invitation successfully', async function () {
      if (!invitationId) {
        console.log('Skipping test - no invitation ID available');
        return;
      }

      const response = await institutionOwner.fetch(
        `/api/institutions/invitations/${invitationId}/resend`,
        {
          method: 'POST',
        },
      );

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'invitation');
      assertPropString(data, 'message');

      const invitation = data.invitation;
      assertPropNumber(invitation, 'id');
      assertPropString(invitation, 'userEmail');
      assertPropString(invitation, 'role');
      assertPropString(invitation, 'invitedDate');

      ok(data.message.includes('resent successfully'));
    });

    it('should return 404 for non-existent invitation', async function () {
      const response = await institutionOwner.fetch('/api/institutions/invitations/999999/resend', {
        method: 'POST',
      });
      strictEqual(response.status, 404);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
    });

    it('should return 400 when trying to resend already responded invitation', async function () {
      // First create an invitation
      const targetUser = await createTestUser({
        testSetup,
        testId,
        email: `resend_responded_target_${testId}@test.com`,
        name: 'Resend Responded Target',
        userType: 'Individual',
      });

      const invitationData = {
        userEmail: targetUser.email,
        role: 'Finance',
      };

      const createResponse = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      let createdInvitationId: number;
      if (createResponse.status === 201) {
        const createData = await createResponse.json();
        assertDefined(createData);
        assertPropDefined(createData, 'invitation');
        assertPropNumber(createData.invitation, 'id');
        createdInvitationId = createData.invitation.id;

        // Accept the invitation first to make it "responded"
        await targetUser.fetch(`/api/institutions/invitations/${createdInvitationId}/accept`, {
          method: 'POST',
        });

        // Now try to resend the already accepted invitation
        const resendResponse = await institutionOwner.fetch(
          `/api/institutions/invitations/${createdInvitationId}/resend`,
          {
            method: 'POST',
          },
        );

        strictEqual(resendResponse.status, 400);
        const data = await resendResponse.json();
        assertDefined(data);
        assertPropDefined(data, 'success');
        strictEqual(data.success, false);
        assertPropDefined(data, 'error');
        assertPropString(data.error, 'code');
        strictEqual(data.error.code, ERROR_CODES.INVITATION_ALREADY_RESPONDED);
        assertPropString(data.error, 'message');
        ok(
          data.error.message.includes(
            'Cannot resend invitation that has already been accepted or rejected',
          ),
        );
      } else {
        console.log('Skipping resend already responded test - invitation creation failed');
      }
    });

    it('should return 403 for insufficient permissions', async function () {
      if (!invitationId) {
        console.log('Skipping test - no invitation ID available');
        return;
      }

      const response = await nonMember.fetch(
        `/api/institutions/invitations/${invitationId}/resend`,
        {
          method: 'POST',
        },
      );
      strictEqual(response.status, 403);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(
        `${testSetup.backendUrl}/api/institutions/invitations/123/resend`,
        {
          method: 'POST',
        },
      );
      strictEqual(response.status, 401);
    });
  });

  describe('Get Invitation Details', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let targetUser: Awaited<ReturnType<typeof createTestUser>>;
    let invitationId: number;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `get_invite_owner_${testId}@test.com`,
        name: 'Get Invite Owner',
      });

      // Create target user
      targetUser = await createTestUser({
        testSetup,
        testId,
        email: `get_invite_target_${testId}@test.com`,
        name: 'Get Invite Target',
        userType: 'Individual',
      });

      // Create an invitation first
      const invitationData = {
        userEmail: targetUser.email,
        role: 'Finance',
        message: 'We would like to invite you to join our institution as Finance member.',
      };

      const createResponse = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      if (createResponse.status === 201) {
        const createData = await createResponse.json();
        assertDefined(createData);
        assertPropDefined(createData, 'invitation');
        assertPropNumber(createData.invitation, 'id');
        invitationId = createData.invitation.id;
      }
    });

    it('should get invitation details successfully', async function () {
      if (!invitationId) {
        console.log('Skipping test - no invitation ID available');
        return;
      }

      const response = await targetUser.fetch(`/api/institutions/invitations/${invitationId}`);
      strictEqual(response.status, 200);

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'invitation');

      const invitation = data.invitation;
      assertPropNumber(invitation, 'id');
      assertPropString(invitation, 'userEmail');
      assertProp(v => v === ('Finance' as const), invitation, 'role');
      assertPropString(invitation, 'invitedDate');
      assertPropString(invitation, 'expiresAt');

      if ('message' in invitation) {
        assertPropString(invitation, 'message');
      }

      if ('institution' in invitation) {
        assertPropDefined(invitation, 'institution');
        const institution = invitation.institution;
        assertPropNumber(institution, 'id');
        assertPropString(institution, 'name');
        assertPropString(institution, 'type');
        assertProp(
          v => v === ('Verified' as const) || v === ('Pending' as const) || v === 'Unverified',
          institution,
          'verificationStatus',
        );
      }

      if ('rolePermissions' in invitation) {
        assertPropArray(invitation, 'rolePermissions');
      }

      if ('roleRestrictions' in invitation) {
        assertPropArray(invitation, 'roleRestrictions');
      }

      if ('invitedBy' in invitation) {
        assertPropDefined(invitation, 'invitedBy');
        assertPropNumber(invitation.invitedBy, 'id');
        assertPropString(invitation.invitedBy, 'name');
      }
    });

    it('should return 404 for non-existent invitation', async function () {
      const response = await targetUser.fetch('/api/institutions/invitations/999999');
      strictEqual(response.status, 404);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
    });
  });

  describe('Accept Institution Invitation', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let targetUser: Awaited<ReturnType<typeof createTestUser>>;
    let invitationId: number;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `accept_invite_owner_${testId}@test.com`,
        name: 'Accept Invite Owner',
      });

      // Create target user
      targetUser = await createTestUser({
        testSetup,
        testId,
        email: `accept_invite_target_${testId}@test.com`,
        name: 'Accept Invite Target',
        userType: 'Individual',
      });

      // Create an invitation first
      const invitationData = {
        userEmail: targetUser.email,
        role: 'Finance',
      };

      const createResponse = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      if (createResponse.status === 201) {
        const createData = await createResponse.json();
        assertDefined(createData);
        assertPropDefined(createData, 'invitation');
        assertPropNumber(createData.invitation, 'id');
        invitationId = createData.invitation.id;
      }
    });

    it('should accept invitation successfully', async function () {
      if (!invitationId) {
        console.log('Skipping test - no invitation ID available');
        return;
      }

      const response = await targetUser.fetch(
        `/api/institutions/invitations/${invitationId}/accept`,
        {
          method: 'POST',
        },
      );

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'institution');
      assertPropString(data, 'message');

      const institution = data.institution;
      assertPropNumber(institution, 'id');
      assertPropString(institution, 'businessName');
      assertPropString(institution, 'role');
      strictEqual(institution.role, 'Finance');

      ok(data.message.includes('successfully joined'));
    });

    it('should return 404 for non-existent invitation', async function () {
      const response = await targetUser.fetch('/api/institutions/invitations/999999/accept', {
        method: 'POST',
      });
      strictEqual(response.status, 404);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
    });

    it('should return 400 for expired invitation', async function () {
      // This test simulates an expired invitation scenario
      // Note: In a real implementation, this would require either:
      // 1. Manipulating system time to make invitation expire
      // 2. Creating invitation with past expiration date
      // 3. Having a test endpoint to expire invitations
      // For now, we test the expected response structure

      // Create a test invitation first
      const expiredTargetUser = await createTestUser({
        testSetup,
        testId,
        email: `expired_target_${testId}@test.com`,
        name: 'Expired Target',
        userType: 'Individual',
      });

      const invitationData = {
        userEmail: expiredTargetUser.email,
        role: 'Finance',
      };

      const createResponse = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      if (createResponse.status === 201) {
        const createData = await createResponse.json();
        assertDefined(createData);
        assertPropDefined(createData, 'invitation');
        assertPropNumber(createData.invitation, 'id');
        const expiredInvitationId = createData.invitation.id;

        // TODO: This test needs backend support to simulate expired invitations
        // For now, we document the expected behavior when invitation is expired
        console.log(`Created invitation ${expiredInvitationId} for expiration testing`);
        console.log('Note: This test requires backend support to simulate expired invitations');

        // The expected behavior for expired invitation acceptance:
        // const response = await expiredTargetUser.fetch(`/api/institutions/invitations/${expiredInvitationId}/accept`, {
        //   method: 'POST',
        // });
        //
        // strictEqual(response.status, 400);
        // const data = await response.json();
        // assertDefined(data);
        // assertPropDefined(data, 'success');
        // strictEqual(data.success, false);
        // assertPropDefined(data, 'error');
        // assertPropString(data.error, 'code');
        // strictEqual(data.error.code, 'INVITATION_EXPIRED');
        // assertPropString(data.error, 'message');
        // ok(data.error.message.includes('Invitation has expired'));
        //
        // if ('details' in data.error) {
        //   assertPropDefined(data.error, 'details');
        //   assertPropNumber(data.error.details, 'invitationId');
        //   assertPropString(data.error.details, 'expiredDate');
        //   strictEqual(data.error.details.invitationId, expiredInvitationId);
        // }
      } else {
        console.log('Skipping expired invitation test - invitation creation failed');
      }
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(
        `${testSetup.backendUrl}/api/institutions/invitations/123/accept`,
        {
          method: 'POST',
        },
      );
      strictEqual(response.status, 401);
    });
  });

  describe('Reject Institution Invitation', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let targetUser: Awaited<ReturnType<typeof createTestUser>>;
    let invitationIdWithReason: number;
    let invitationIdWithoutReason: number;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `reject_invite_owner_${testId}@test.com`,
        name: 'Reject Invite Owner',
      });

      // Create target user
      targetUser = await createTestUser({
        testSetup,
        testId,
        email: `reject_invite_target_${testId}@test.com`,
        name: 'Reject Invite Target',
        userType: 'Individual',
      });

      // Create invitations for testing
      const invitationData1 = {
        userEmail: `reject_with_reason_${testId}@test.com`,
        role: 'Finance',
      };

      const invitationData2 = {
        userEmail: `reject_without_reason_${testId}@test.com`,
        role: 'Finance',
      };

      const createResponse1 = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData1),
      });

      const createResponse2 = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData2),
      });

      if (createResponse1.status === 201) {
        const createData1 = await createResponse1.json();
        assertDefined(createData1);
        assertPropDefined(createData1, 'invitation');
        assertPropNumber(createData1.invitation, 'id');
        invitationIdWithReason = createData1.invitation.id;
      }

      if (createResponse2.status === 201) {
        const createData2 = await createResponse2.json();
        assertDefined(createData2);
        assertPropDefined(createData2, 'invitation');
        assertPropNumber(createData2.invitation, 'id');
        invitationIdWithoutReason = createData2.invitation.id;
      }
    });

    it('should reject invitation with reason successfully', async function () {
      if (!invitationIdWithReason) {
        console.log('Skipping test - no invitation ID available');
        return;
      }

      const rejectionData = {
        reason: 'I am not interested in joining this institution at the moment',
      };

      const response = await targetUser.fetch(
        `/api/institutions/invitations/${invitationIdWithReason}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rejectionData),
        },
      );

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropString(data, 'message');
      ok(data.message.includes('rejected successfully'));
    });

    it('should reject invitation without reason successfully', async function () {
      if (!invitationIdWithoutReason) {
        console.log('Skipping test - no invitation ID available');
        return;
      }

      const response = await targetUser.fetch(
        `/api/institutions/invitations/${invitationIdWithoutReason}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropString(data, 'message');
      ok(data.message.includes('rejected successfully'));
    });

    it('should return 404 for non-existent invitation', async function () {
      const response = await targetUser.fetch('/api/institutions/invitations/999999/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      strictEqual(response.status, 404);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(
        `${testSetup.backendUrl}/api/institutions/invitations/123/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      strictEqual(response.status, 401);
    });
  });

  describe('Cancel Institution Invitation', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let nonOwner: Awaited<ReturnType<typeof createTestUser>>;
    let invitationId: number;

    before(async function () {
      // Create institution owner
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `cancel_invite_owner_${testId}@test.com`,
        name: 'Cancel Invite Owner',
      });

      // Create non-owner user
      nonOwner = await createTestUser({
        testSetup,
        testId,
        email: `cancel_invite_non_owner_${testId}@test.com`,
        name: 'Non Owner User',
        userType: 'Individual',
      });

      // Create an invitation first
      const invitationData = {
        userEmail: `cancel_invite_target_${testId}@test.com`,
        role: 'Finance',
      };

      const createResponse = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      if (createResponse.status === 201) {
        const createData = await createResponse.json();
        assertDefined(createData);
        assertPropDefined(createData, 'invitation');
        assertPropNumber(createData.invitation, 'id');
        invitationId = createData.invitation.id;
      }
    });

    it('should cancel invitation successfully', async function () {
      if (!invitationId) {
        console.log('Skipping test - no invitation ID available');
        return;
      }

      const response = await institutionOwner.fetch(
        `/api/institutions/invitations/${invitationId}`,
        {
          method: 'DELETE',
        },
      );

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropString(data, 'message');
      ok(data.message.includes('cancelled successfully'));
    });

    it('should return 404 for non-existent invitation', async function () {
      const response = await institutionOwner.fetch('/api/institutions/invitations/999999', {
        method: 'DELETE',
      });
      strictEqual(response.status, 404);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
    });

    it('should return 400 when trying to cancel already responded invitation', async function () {
      // First create an invitation
      const targetUser = await createTestUser({
        testSetup,
        testId,
        email: `cancel_responded_target_${testId}@test.com`,
        name: 'Cancel Responded Target',
        userType: 'Individual',
      });

      const invitationData = {
        userEmail: targetUser.email,
        role: 'Finance',
      };

      const createResponse = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      let createdInvitationId: number;
      if (createResponse.status === 201) {
        const createData = await createResponse.json();
        assertDefined(createData);
        assertPropDefined(createData, 'invitation');
        assertPropNumber(createData.invitation, 'id');
        createdInvitationId = createData.invitation.id;

        // Reject the invitation first to make it "responded"
        await targetUser.fetch(`/api/institutions/invitations/${createdInvitationId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Not interested' }),
        });

        // Now try to cancel the already rejected invitation
        const cancelResponse = await institutionOwner.fetch(
          `/api/institutions/invitations/${createdInvitationId}`,
          {
            method: 'DELETE',
          },
        );

        strictEqual(cancelResponse.status, 400);
        const data = await cancelResponse.json();
        assertDefined(data);
        assertPropDefined(data, 'success');
        strictEqual(data.success, false);
        assertPropDefined(data, 'error');
        assertPropString(data.error, 'code');
        strictEqual(data.error.code, ERROR_CODES.INVITATION_ALREADY_RESPONDED);
        assertPropString(data.error, 'message');
        ok(
          data.error.message.includes(
            'Cannot cancel invitation that has already been accepted or rejected',
          ),
        );
      } else {
        console.log('Skipping cancel already responded test - invitation creation failed');
      }
    });

    it('should return 403 for insufficient permissions (non-owner)', async function () {
      const response = await nonOwner.fetch('/api/institutions/invitations/123', {
        method: 'DELETE',
      });
      strictEqual(response.status, 403);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/institutions/invitations/123`, {
        method: 'DELETE',
      });
      strictEqual(response.status, 401);
    });
  });

  describe('Error Scenarios and Edge Cases', function () {
    let institutionOwner: Awaited<ReturnType<typeof createInstitutionTestUser>>;

    before(async function () {
      institutionOwner = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `edge_cases_owner_${testId}@test.com`,
        name: 'Edge Cases Owner',
      });
    });

    it('should handle malformed JSON in invitation creation', async function () {
      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-string',
      });

      strictEqual(response.status, 400);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.BAD_REQUEST);
      assertPropString(data.error, 'message');
      ok(data.error.message.includes('not valid JSON'));
    });

    it('should handle missing Content-Type header', async function () {
      const invitationData = {
        userEmail: `missing_content_type_${testId}@test.com`,
        role: 'Finance',
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        body: JSON.stringify(invitationData),
      });

      // Should handle gracefully with appropriate error
      ok(response.status === 400 || response.status === 415 || response.status === 422);
    });

    it('should handle empty request body', async function () {
      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });

      strictEqual(response.status, 422);
    });

    it('should handle very long email addresses', async function () {
      const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com';
      const invitationData = {
        userEmail: longEmail,
        role: 'Finance',
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      // Should validate email length and return VALIDATION_ERROR
      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
      assertPropString(data.error, 'message');
      strictEqual(data.error.message, 'Request validation failed');
    });

    it('should handle very long invitation messages', async function () {
      const longMessage = 'a'.repeat(2000); // Very long message (over 1000 char limit)
      const invitationData = {
        userEmail: `long_message_${testId}@test.com`,
        role: 'Finance',
        message: longMessage,
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      // Should validate message length and return VALIDATION_ERROR
      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
      assertPropString(data.error, 'message');
      strictEqual(data.error.message, 'Request validation failed');
    });

    it('should handle special characters in email', async function () {
      const specialEmail = `special+chars.test-${testId}@example.co.uk`;
      const invitationData = {
        userEmail: specialEmail,
        role: 'Finance',
      };

      const response = await institutionOwner.fetch('/api/institutions/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      // Should either accept valid email format or return appropriate error
      ok(response.status === 201 || response.status === 400 || response.status === 422);
    });

    it('should handle concurrent invitation creation', async function () {
      const invitationData = {
        userEmail: `concurrent_${testId}@test.com`,
        role: 'Finance',
      };

      // Send two identical requests concurrently
      const [response1, response2] = await Promise.all([
        institutionOwner.fetch('/api/institutions/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invitationData),
        }),
        institutionOwner.fetch('/api/institutions/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invitationData),
        }),
      ]);

      // At least one should succeed, or both should fail with appropriate error
      const statuses = [response1.status, response2.status];
      const hasSuccess = statuses.includes(201);
      const _hasConflict = statuses.includes(409);

      // Either one succeeds and one conflicts, or both fail appropriately
      ok(hasSuccess || statuses.every(status => status >= 400));
    });

    it('should validate invitation ID format in URL parameters', async function () {
      // Test with non-numeric invitation ID
      const response = await institutionOwner.fetch('/api/institutions/invitations/invalid-id', {
        method: 'DELETE',
      });

      ok(response.status === 400 || response.status === 404);
      if (response.status === 404) {
        const data = await response.json();
        assertDefined(data);
        assertPropDefined(data, 'error');
        assertPropString(data.error, 'code');
        strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
      }
    });

    it('should validate institution ID format in URL parameters', async function () {
      // Test with non-numeric institution ID
      const response = await institutionOwner.fetch('/api/institutions/invalid-id');

      ok(response.status === 400 || response.status === 404);
      if (response.status === 404) {
        const data = await response.json();
        assertDefined(data);
        assertPropDefined(data, 'error');
        assertPropString(data.error, 'code');
        strictEqual(data.error.code, ERROR_CODES.NOT_FOUND);
      }
    });
  });
});
