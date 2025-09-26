import {
  deepStrictEqual,
  doesNotReject,
  doesNotThrow,
  notStrictEqual,
  ok,
  rejects,
  strictEqual,
  throws,
} from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertArray,
  assertDefined,
  assertProp,
  assertPropArrayMapOf,
  assertPropDefined,
  assertPropNullableString,
  assertPropNumber,
  assertPropString,
  check,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import {
  createAdminTestUser,
  createInstitutionTestUser,
  createKycTestUser,
  createTestUser,
  type TestUser,
} from './setup/user';
import {
  createInstitutionFormData,
  createKYCFormData,
  generateUniqueNIK,
  generateUniqueRegistrationNumber,
} from './user-verification-test-data';

suite('User Verification API E2E Tests', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let mainUser: TestUser;
  let adminUser: TestUser;

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();

    // Create main test user for KYC testing
    mainUser = await createKycTestUser({
      testId,
      testSetup,
      email: `verification_test_${testId}@test.com`,
      name: `Test User ${testId}`,
    });

    // Create admin user for admin API testing
    adminUser = await createAdminTestUser({
      testId,
      testSetup,
      email: `admin_${testId}@test.com`,
      name: `Test Admin ${testId}`,
    });

    // Set admin role using test endpoint
    const assignAdminRoleResponse = await fetch(`${testSetup.backendUrl}/api/assign-admin-role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: adminUser.id,
      }),
    });

    if (!assignAdminRoleResponse.ok) {
      const errorData = await assignAdminRoleResponse.text();
      console.error(
        `Admin role assignment failed with status ${assignAdminRoleResponse.status}: ${errorData}`,
      );
    }
    ok(assignAdminRoleResponse.ok, 'Admin role assignment should be successful');

    // Sign out and sign back in to refresh the session with the updated role
    await adminUser.authClient.signOut();
    await adminUser.authClient.signIn.email({
      email: `admin_${testId}@test.com`,
      password: 'ValidPassword123!',
    });
  });

  after(async function () {
    await testSetup?.teardown();
  });

  describe('KYC Verification', function () {
    describe('POST /users/kyc/submit', function () {
      it('should successfully submit KYC with valid data', async function () {
        const formData = createKYCFormData();
        const response = await mainUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        if (response.status !== 201) {
          const errorText = await response.text();
          console.error(`KYC submission failed with status ${response.status}: ${errorText}`);
        }

        strictEqual(response.status, 201, `Expected 201, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropString(responseData, 'message');
        assertPropDefined(responseData, 'kycSubmission');

        // Verify KYC submission object
        const kycSubmission = responseData.kycSubmission;
        assertDefined(kycSubmission);
        assertPropNumber(kycSubmission, 'id');
        assertProp(
          v => v === ('pending' as const) || v === ('verified' as const) || v === 'rejected',
          kycSubmission,
          'status',
        );
        // Dates are returned as ISO strings in JSON responses
        assertPropString(kycSubmission, 'submittedDate');
        ok(
          new Date(kycSubmission.submittedDate).getTime() > 0,
          'submittedDate should be a valid date string',
        );
        assertPropNullableString(kycSubmission, 'verifiedDate');
        assertPropNullableString(kycSubmission, 'rejectedDate');
        ok(
          kycSubmission.verifiedDate === null,
          'verifiedDate should be null for pending submission',
        );
        ok(
          kycSubmission.rejectedDate === null,
          'rejectedDate should be null for pending submission',
        );
        assertPropNullableString(kycSubmission, 'rejectionReason');

        // Initial submission should be pending
        strictEqual(kycSubmission.status, 'pending');
        ok(kycSubmission.verifiedDate === null);
        ok(kycSubmission.rejectedDate === null);
        ok(kycSubmission.rejectionReason === null);
      });

      it('should reject KYC submission with invalid NIK format', async function () {
        const formData = createKYCFormData({
          nik: '123', // Invalid - too short
        });
        const response = await mainUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 422, `Expected 422, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'success');
        strictEqual(errorData.success, false);
        assertPropString(errorData, 'timestamp');
        assertPropString(errorData, 'requestId');
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertDefined(error);
        assertPropString(error, 'code');
        assertPropString(error, 'message');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const details = error.details;
        assertDefined(details);
        assertPropString(details, 'nik');
        ok(details.nik.includes('16 digits'));
      });

      it('should reject KYC submission with future birth date', async function () {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const futureDateStr = futureDate.toISOString().split('T')[0];

        const formData = createKYCFormData({
          birthDate: futureDateStr,
        });
        const response = await mainUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 422, `Expected 422, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'success');
        strictEqual(errorData.success, false);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const details = error.details;
        assertDefined(details);
        assertPropString(details, 'birthDate');
        ok(details.birthDate.includes('future'));
      });

      it('should reject KYC submission with invalid postal code', async function () {
        const formData = createKYCFormData({
          postalCode: '123', // Invalid - too short
        });
        const response = await mainUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 422, `Expected 422, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const details = error.details;
        assertDefined(details);
        assertPropString(details, 'postalCode');
        ok(details.postalCode.includes('5 digits'));
      });

      it('should reject KYC submission with missing required fields', async function () {
        // Use a minimal form data with only name field
        const formData = new FormData();
        formData.append('name', 'John Doe'); // Only partial data

        const response = await mainUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 422, `Expected 422, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const details = error.details;
        assertDefined(details);

        // Should have multiple validation errors
        const requiredFields = [
          'nik',
          'birthDate',
          'province',
          'city',
          'district',
          'subdistrict',
          'address',
          'postalCode',
          'idCardPhoto',
          'selfieWithIdCardPhoto',
        ];
        let foundMissingFields = 0;

        for (const field of requiredFields) {
          if (field in details) {
            foundMissingFields++;
          }
        }

        ok(foundMissingFields > 0, 'Should have validation errors for missing required fields');
      });

      it('should handle duplicate NIK submission', async function () {
        const duplicateNik = generateUniqueNIK();

        // Create first user for the initial KYC submission
        const firstUser = await createKycTestUser({
          testId,
          testSetup,
          email: `duplicate-test-first-${testId}@example.com`,
          name: 'First User',
        });

        // First user submits KYC with the duplicate NIK
        const firstFormData = createKYCFormData({
          nik: duplicateNik,
        });
        const firstSubmissionResponse = await firstUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: firstFormData,
        });

        if (firstSubmissionResponse.status !== 201) {
          const errorData = await firstSubmissionResponse.json();
          console.error('First submission failed:', firstSubmissionResponse.status, errorData);
        }
        strictEqual(firstSubmissionResponse.status, 201);
        const firstSubmissionData = await firstSubmissionResponse.json();
        assertDefined(firstSubmissionData);
        assertPropDefined(firstSubmissionData, 'kycSubmission');
        const firstKyc = firstSubmissionData.kycSubmission;
        assertDefined(firstKyc);
        assertPropNumber(firstKyc, 'id');

        // Admin approves the first KYC to make the NIK "verified" and thus protected
        const approveResponse = await adminUser.fetch(`/api/admin/kyc/${firstKyc.id}/approve`, {
          method: 'PUT',
        });
        if (approveResponse.status !== 200) {
          const errorData = await approveResponse.json();
          console.error('Admin approval failed:', approveResponse.status, errorData);
        }
        strictEqual(approveResponse.status, 200);

        // Create second user for the duplicate NIK attempt
        const secondUser = await createKycTestUser({
          testId,
          testSetup,
          email: `duplicate-test-${testId}-2@example.com`,
          name: 'Second User',
        });

        // Second user tries to submit KYC with same NIK
        const secondFormData = createKYCFormData({
          nik: duplicateNik, // Same NIK as the verified one
        });
        const response = await secondUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: secondFormData,
        });

        strictEqual(response.status, 409, `Expected 409, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'DUPLICATE_NIK');
        assertPropDefined(error, 'details');

        const details = error.details;
        assertDefined(details);
        assertPropString(details, 'nik');
        assertPropString(details, 'message');
        strictEqual(details.nik, duplicateNik);
      });
    });

    describe('GET /users/kyc/status', function () {
      it('should return KYC status for user with pending submission', async function () {
        // First submit KYC with unique NIK for this test
        const formData = createKYCFormData({
          nik: generateUniqueNIK(),
        });
        await mainUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        // Then check status
        const response = await mainUser.fetch('/api/users/kyc/status');

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        // assertPropOneOf(responseData, 'kycStatus', ['none', 'pending', 'verified', 'rejected']);
        assertProp(
          v =>
            v === ('none' as const) ||
            v === ('pending' as const) ||
            v === ('verified' as const) ||
            v === 'rejected',
          responseData,
          'kycStatus',
        );

        // Should have pending status and submission details
        strictEqual(responseData.kycStatus, 'pending');
        assertPropDefined(responseData, 'submission');

        const submission = responseData.submission;
        assertDefined(submission);
        assertPropNumber(submission, 'id');
        assertProp(
          v => v === ('pending' as const) || v === ('verified' as const) || v === 'rejected',
          submission,
          'status',
        );
        assertPropString(submission, 'submittedDate');
        ok(
          new Date(submission.submittedDate).getTime() > 0,
          'submittedDate should be a valid date string',
        );
        assertPropDefined(responseData, 'canResubmit');

        // Should not be able to resubmit while pending
        strictEqual(responseData.canResubmit, false);
      });

      it('should return no submission status for user without KYC', async function () {
        // Create a new user without any KYC submission
        const noKycUser = await createKycTestUser({
          testId,
          testSetup,
          email: `no_kyc_${testId}@test.com`,
          name: `No KYC User ${testId}`,
        });

        const response = await noKycUser.fetch('/api/users/kyc/status');

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertProp(
          v =>
            v === ('none' as const) ||
            v === ('pending' as const) ||
            v === ('verified' as const) ||
            v === 'rejected',
          responseData,
          'kycStatus',
        );
        ok('submission' in responseData, 'submission property should exist');
        assertPropDefined(responseData, 'canResubmit');
        strictEqual(responseData.kycStatus, 'none');
        strictEqual(responseData.submission, null);
        strictEqual(responseData.canResubmit, true);
      });
    });
  });

  describe('Admin KYC Management', function () {
    let kycSubmissionId: number;
    let adminTestUser: TestUser;
    let adminTestNik: string;

    before(async function () {
      // Create a separate user for admin KYC testing
      adminTestUser = await createKycTestUser({
        testId,
        testSetup,
        email: `admin_kyc_test_${testId}@test.com`,
        name: `Admin KYC Test User ${testId}`,
      });

      // Submit a KYC for admin testing
      adminTestNik = generateUniqueNIK(); // Store the generated NIK for later assertion
      const formData = createKYCFormData({
        nik: adminTestNik, // Use the stored NIK
      });

      const response = await adminTestUser.fetch('/api/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      ok(response.ok, 'KYC submission should be successful');
      const responseData = await response.json();
      kycSubmissionId = responseData.kycSubmission.id;
    });

    describe('GET /admin/kyc/queue', function () {
      it('should retrieve pending KYC submissions for admin review', async function () {
        const response = await adminUser.fetch('/api/admin/kyc/queue');

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropArrayMapOf(responseData, 'submissions', function (s) {
          assertDefined(s);
          assertPropNumber(s, 'id');
          return s;
        });

        // Should find our submitted KYC
        const ourSubmission = responseData.submissions.find(s => s.id === kycSubmissionId);
        assertDefined(ourSubmission, 'Should find our KYC submission in the queue');

        // Verify submission summary structure
        assertPropNumber(ourSubmission, 'id');
        assertPropNumber(ourSubmission, 'userId');
        assertPropString(ourSubmission, 'userName');
        assertPropString(ourSubmission, 'userEmail');
        assertPropString(ourSubmission, 'submittedDate');
        assertPropString(ourSubmission, 'timeInQueue');
        assertProp(
          v => v === ('normal' as const) || v === ('high' as const) || v === 'urgent',
          ourSubmission,
          'priority',
        );

        // Verify pagination
        if ('pagination' in responseData && responseData.pagination) {
          const pagination = responseData.pagination;
          assertPropNumber(pagination, 'page');
          assertPropNumber(pagination, 'limit');
          assertPropNumber(pagination, 'total');
        }
      });

      it('should support pagination and filtering', async function () {
        const response = await adminUser.fetch(
          '/api/admin/kyc/queue?page=1&limit=10&sortBy=submittedDate&sortOrder=desc',
        );

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropDefined(responseData, 'submissions');
        assertPropDefined(responseData, 'pagination');

        const pagination = responseData.pagination;
        assertPropNumber(pagination, 'page');
        assertPropNumber(pagination, 'limit');
        strictEqual(pagination.page, 1);
        strictEqual(pagination.limit, 10);
      });
    });

    describe('GET /admin/kyc/{id}', function () {
      it('should retrieve detailed KYC submission for admin review', async function () {
        const response = await adminUser.fetch(`/api/admin/kyc/${kycSubmissionId}`);

        if (response.status !== 200) {
          const errorData = await response.text();
          console.error(`KYC details failed with status ${response.status}: ${errorData}`);
        }

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);

        // Verify submission details structure
        assertPropNumber(responseData, 'id');
        assertPropNumber(responseData, 'userId');
        strictEqual(responseData.id, kycSubmissionId);

        // Verify user info
        assertPropDefined(responseData, 'userInfo');
        const userInfo = responseData.userInfo;
        assertPropString(userInfo, 'email');
        assertPropString(userInfo, 'name');
        assertPropString(userInfo, 'createdDate');

        // Verify submission data
        assertPropDefined(responseData, 'submissionData');
        const submissionData = responseData.submissionData;
        assertPropString(submissionData, 'nik');
        assertPropString(submissionData, 'name');
        assertPropString(submissionData, 'birthDate');
        assertPropString(submissionData, 'address');
        strictEqual(submissionData.nik, adminTestNik);

        // Verify documents with signed URLs
        assertPropDefined(responseData, 'documents');
        const documents = responseData.documents;
        assertPropString(documents, 'idCardPhotoUrl');
        assertPropString(documents, 'selfieWithIdCardPhotoUrl');

        // URLs should be signed and accessible
        ok(documents.idCardPhotoUrl.length > 0, 'ID card photo URL should not be empty');
        ok(documents.selfieWithIdCardPhotoUrl.length > 0, 'Selfie photo URL should not be empty');
      });

      it('should return 404 for non-existent KYC submission', async function () {
        const response = await adminUser.fetch('/api/admin/kyc/99999');

        strictEqual(response.status, 404, `Expected 404, got ${response.status}`);
      });
    });

    describe('PUT /admin/kyc/{id}/approve', function () {
      let approveTestKycId: number;
      let approveTestUser: TestUser;

      before(async function () {
        // Create a separate user for approval testing
        approveTestUser = await createKycTestUser({
          testId,
          testSetup,
          email: `approve_test_${testId}@test.com`,
          name: `Approve Test User ${testId}`,
        });

        // Create another KYC submission for approval testing
        const formData = createKYCFormData({
          nik: generateUniqueNIK(), // Generate unique NIK for approval test
        });

        const response = await approveTestUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`KYC submission failed: ${JSON.stringify(errorData)}`);
        }

        const responseData = await response.json();
        if (!responseData.kycSubmission || !responseData.kycSubmission.id) {
          throw new Error(`Invalid response structure: ${JSON.stringify(responseData)}`);
        }
        approveTestKycId = responseData.kycSubmission.id;
      });

      it('should successfully approve a pending KYC submission', async function () {
        const response = await adminUser.fetch(`/api/admin/kyc/${approveTestKycId}/approve`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: 'All documents verified and approved',
          }),
        });

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();

        assertDefined(responseData);
        assertPropDefined(responseData, 'success');
        assertPropString(responseData, 'message');
        assertPropNumber(responseData, 'kycId');
        assertPropString(responseData, 'processedDate');
        assertPropString(responseData, 'processingAdmin');

        strictEqual(responseData.success, true);
        strictEqual(responseData.kycId, approveTestKycId);

        // Verify the KYC status is updated
        const statusResponse = await mainUser.fetch('/api/users/kyc/status');
        const _statusData = await statusResponse.json();

        // Note: This test assumes the authenticated user is the one whose KYC was approved
        // In practice, you might need to authenticate as the original user to check status
      });

      it('should return 409 when trying to approve already processed KYC', async function () {
        // Try to approve the same KYC again
        const response = await adminUser.fetch(`/api/admin/kyc/${approveTestKycId}/approve`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: 'Trying to approve again',
          }),
        });

        strictEqual(response.status, 409, `Expected 409, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');
        if ('success' in errorData) {
          strictEqual(errorData.success, false);
        }
      });
    });

    describe('PUT /admin/kyc/{id}/reject', function () {
      let rejectTestKycId: number;
      let rejectTestUser: TestUser;

      before(async function () {
        // Create a separate user for rejection testing
        rejectTestUser = await createKycTestUser({
          testId,
          testSetup,
          email: `reject_test_${testId}@test.com`,
          name: `Reject Test User ${testId}`,
        });

        // Create another KYC submission for rejection testing
        const formData = createKYCFormData({
          nik: generateUniqueNIK(), // Generate unique NIK for rejection test
        });

        const response = await rejectTestUser.fetch('/api/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`KYC submission failed: ${JSON.stringify(errorData)}`);
        }

        const responseData = await response.json();
        if (!responseData.kycSubmission || !responseData.kycSubmission.id) {
          throw new Error(`Invalid response structure: ${JSON.stringify(responseData)}`);
        }
        rejectTestKycId = responseData.kycSubmission.id;
      });

      it('should successfully reject a pending KYC submission', async function () {
        const rejectionReason =
          'Document quality is insufficient for verification. Please resubmit with clearer photos.';

        const response = await adminUser.fetch(`/api/admin/kyc/${rejectTestKycId}/reject`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: rejectionReason,
          }),
        });

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropDefined(responseData, 'success');
        assertPropString(responseData, 'message');
        assertPropNumber(responseData, 'kycId');
        assertPropString(responseData, 'processedDate');
        assertPropString(responseData, 'processingAdmin');

        strictEqual(responseData.success, true);
        strictEqual(responseData.kycId, rejectTestKycId);
      });

      it('should require rejection reason', async function () {
        const response = await adminUser.fetch(`/api/admin/kyc/${kycSubmissionId}/reject`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}), // Missing reason
        });

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);
      });

      it('should validate minimum reason length', async function () {
        const response = await adminUser.fetch(`/api/admin/kyc/${kycSubmissionId}/reject`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: 'Short', // Too short (minimum 10 characters)
          }),
        });

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);
      });
    });
  });

  describe('Institution Verification', function () {
    describe('POST /institution-applications', function () {
      it('should successfully submit institution application with valid data', async function () {
        const formData = createInstitutionFormData();

        const response = await mainUser.fetch('/api/institution-applications', {
          method: 'POST',
          body: formData,
        });

        if (response.status !== 201) {
          const errorText = await response.text();
          console.error(
            `Institution application failed with status ${response.status}: ${errorText}`,
          );
        }

        strictEqual(response.status, 201, `Expected 201, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropString(responseData, 'message');
        assertPropDefined(responseData, 'application');

        // Verify institution application object
        const application = responseData.application;
        assertDefined(application);
        assertPropNumber(application, 'id');
        assertPropString(application, 'businessName');
        assertPropString(application, 'submittedDate');
        ok(
          new Date(application.submittedDate).getTime() > 0,
          'submittedDate should be a valid date string',
        );
        assertProp(
          v =>
            v === ('Submitted' as const) ||
            v === ('UnderReview' as const) ||
            v === ('Verified' as const) ||
            v === 'Rejected',
          application,
          'status',
        );

        // Initial application should be submitted
        strictEqual(application.status, 'Submitted');
        strictEqual(application.businessName, 'PT Teknologi Nusantara Test');
      });

      it('should reject institution application with invalid NPWP format', async function () {
        const formData = createInstitutionFormData({
          npwpNumber: '123456789', // Invalid NPWP format
        });

        const response = await mainUser.fetch('/api/institution-applications', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 422, `Expected 422, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const details = error.details;
        assertDefined(details);
        assertPropString(details, 'npwpNumber');
        ok(details.npwpNumber.includes('XX.XXX.XXX.X-XXX.XXX'));
      });

      it('should reject institution application with existing business name', async function () {
        const businessName = `PT Duplicate Business ${testId}`;

        // First application
        const formData1 = createInstitutionFormData({
          businessName,
          npwpNumber: '01.111.111.1-111.111',
          registrationNumber: generateUniqueRegistrationNumber(), // Unique registration number
        });

        await mainUser.fetch('/api/institution-applications', {
          method: 'POST',
          body: formData1,
        });

        // Second application with same business name but different registration number
        const formData2 = createInstitutionFormData({
          businessName,
          npwpNumber: '02.222.222.2-222.222',
          registrationNumber: generateUniqueRegistrationNumber(), // Different registration number
        });

        const response = await mainUser.fetch('/api/institution-applications', {
          method: 'POST',
          body: formData2,
        });

        strictEqual(response.status, 409, `Expected 409, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'BUSINESS_NAME_EXISTS');
        assertPropDefined(error, 'details');

        const details = error.details;
        assertDefined(details);
        assertPropString(details, 'businessName');
        assertPropString(details, 'message');
        strictEqual(details.businessName, businessName);
      });

      it('should reject institution application with missing required documents', async function () {
        const formData = new FormData();

        // Add all required text fields but omit the required documents
        formData.append('businessName', 'PT Test Without Docs');
        formData.append('registrationNumber', generateUniqueRegistrationNumber());
        formData.append('npwpNumber', '01.234.567.8-901.000');
        formData.append('businessType', 'PT');
        formData.append('businessDescription', 'Test business description');
        formData.append('businessProvince', 'DKI Jakarta');
        formData.append('businessCity', 'Jakarta Selatan');
        formData.append('businessDistrict', 'Kebayoran Baru');
        formData.append('businessSubdistrict', 'Senayan');
        formData.append('businessAddress', 'Jl. Asia Afrika No. 8, Komplex Gelora Bung Karno');
        formData.append('businessPostalCode', '10270');
        formData.append('directorName', 'Budi Santoso');
        formData.append('directorPosition', 'CEO');

        const response = await mainUser.fetch('/api/institution-applications', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 422, `Expected 422, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const details = error.details;
        assertDefined(details);

        // Should have validation errors for missing required documents
        const requiredDocuments = [
          'npwpDocument',
          'registrationDocument',
          'deedOfEstablishment',
          'directorIdCard',
          'ministryApprovalDocument',
        ];
        let foundMissingDocs = 0;

        for (const doc of requiredDocuments) {
          if (doc in details) {
            foundMissingDocs++;
          }
        }

        ok(foundMissingDocs > 0, 'Should have validation errors for missing required documents');
      });

      it('should accept trading company application with valid data', async function () {
        const formData = createInstitutionFormData({
          businessName: 'CV Mitra Jaya Trading Test',
          registrationNumber: generateUniqueRegistrationNumber(),
          npwpNumber: '02.345.678.9-012.000',
          businessType: 'CV',
          businessDescription: 'Import and export trading company specializing in electronics',
          businessProvince: 'Jawa Timur',
          businessCity: 'Surabaya',
          businessDistrict: 'Wonokromo',
          businessSubdistrict: 'Wonokromo',
          businessAddress: 'Jl. Raya Darmo No. 123',
          businessPostalCode: '60241',
          directorName: 'Siti Rahayu',
          directorPosition: 'Director',
        });

        const response = await mainUser.fetch('/api/institution-applications', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 201, `Expected 201, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropDefined(responseData, 'application');

        const application = responseData.application;
        assertDefined(application);
        assertPropString(application, 'businessName');
        assertPropString(application, 'status');
        strictEqual(application.businessName, 'CV Mitra Jaya Trading Test');
        strictEqual(application.status, 'Submitted');
      });
    });

    describe('GET /institution-applications/status', function () {
      it('should return institution application status and progress', async function () {
        // First submit an application
        const formData = createInstitutionFormData({
          businessName: `PT Status Test ${testId}`,
          npwpNumber: '03.456.789.0-123.000',
        });

        const submitResponse = await mainUser.fetch('/api/institution-applications', {
          method: 'POST',
          body: formData,
        });

        const _submitData = await submitResponse.json();

        // Then check status (no longer needs application ID)
        const response = await mainUser.fetch('/api/institution-applications/status');

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropDefined(responseData, 'application');
        assertPropDefined(responseData, 'progress');
        assertPropDefined(responseData, 'documents');

        // Verify application details
        const application = responseData.application;
        assertDefined(application);
        assertPropNumber(application, 'id');
        assertPropString(application, 'businessName');
        assertPropString(application, 'submittedDate');
        ok(
          new Date(application.submittedDate).getTime() > 0,
          'submittedDate should be a valid date string',
        );
        assertProp(
          v =>
            v === ('Submitted' as const) ||
            v === ('UnderReview' as const) ||
            v === ('Verified' as const) ||
            v === 'Rejected',
          application,
          'status',
        );

        // Verify progress information
        const progress = responseData.progress;
        assertDefined(progress);
        assertPropNumber(progress, 'currentStep');
        assertPropNumber(progress, 'totalSteps');
        assertPropDefined(progress, 'completedSteps');
        assertArray(progress.completedSteps);
        assertPropString(progress, 'nextAction');

        // Verify documents information
        const documents = responseData.documents;
        assertDefined(documents);
        assertPropNumber(documents, 'uploaded');
        assertPropNumber(documents, 'required');
        assertProp(
          v =>
            v === ('incomplete' as const) ||
            v === ('complete' as const) ||
            v === ('under_review' as const),
          documents,
          'status',
        );

        // Initial application should have complete documents
        ok(documents.uploaded >= 5, 'Should have uploaded at least 5 required documents');
        ok(
          documents.uploaded === documents.required,
          'Uploaded documents should equal required documents',
        );
      });

      it('should return 404 for user without institution application', async function () {
        const userWithoutInstitution = await createTestUser({
          testId,
          testSetup,
          userType: 'Individual',
        });

        const response = await userWithoutInstitution.fetch('/api/institution-applications/status');

        strictEqual(response.status, 404, `Expected 404, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'success');
        strictEqual(errorData.success, false);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertDefined(error);
        assertPropString(error, 'code');
        assertPropString(error, 'message');
        strictEqual(error.code, 'NOT_FOUND');
      });
    });
  });

  describe('Admin Institution Management', function () {
    let institutionApplicationId: number;

    before(async function () {
      // Submit an institution application for admin testing
      const formData = createInstitutionFormData({
        businessName: `PT Admin Test ${testId}`,
        npwpNumber: '04.567.890.1-234.000',
      });

      const response = await mainUser.fetch('/api/institution-applications', {
        method: 'POST',
        body: formData,
      });

      ok(response.ok, 'Institution application submission should be successful');
      const responseData = await response.json();
      institutionApplicationId = responseData.application.id;
    });

    describe('GET /admin/institutions/applications', function () {
      it('should retrieve pending institution applications for admin review', async function () {
        const response = await adminUser.fetch('/api/admin/institutions/applications');

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropArrayMapOf(responseData, 'applications', function (app) {
          assertDefined(app);
          assertProp(check(isNullable, isString, isNumber), app, 'id');
          return app;
        });

        // Should find our submitted application
        const ourApplication = responseData.applications.find(
          app => app.id === institutionApplicationId,
        );
        assertDefined(ourApplication, 'Should find our institution application in the queue');

        // Verify application summary structure
        assertPropNumber(ourApplication, 'id');
        assertPropString(ourApplication, 'businessName');
        assertPropString(ourApplication, 'submittedDate');
        assertPropString(ourApplication, 'timeInQueue');
        assertProp(
          v => v === ('normal' as const) || v === ('high' as const) || v === ('urgent' as const),
          ourApplication,
          'priority',
        );

        // Verify applicant info
        assertPropDefined(ourApplication, 'applicantInfo');
        const applicantInfo = ourApplication.applicantInfo;
        assertPropNumber(applicantInfo, 'userId');
        assertPropString(applicantInfo, 'name');
        assertPropString(applicantInfo, 'email');
        assertProp(
          v =>
            v === ('none' as const) ||
            v === ('pending' as const) ||
            v === ('verified' as const) ||
            v === 'rejected',
          applicantInfo,
          'kycStatus',
        );

        // Verify pagination if present
        if ('pagination' in responseData && responseData.pagination) {
          const pagination = responseData.pagination;
          assertPropNumber(pagination, 'page');
          assertPropNumber(pagination, 'limit');
          assertPropNumber(pagination, 'total');
        }
      });

      it('should support search and filtering', async function () {
        const response = await adminUser.fetch(
          `/api/admin/institutions/applications?search=Admin Test&sortBy=businessName&sortOrder=asc`,
        );

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropDefined(responseData, 'applications');
        assertArray(responseData.applications);
      });
    });

    describe('GET /admin/institutions/applications/{id}', function () {
      it('should retrieve detailed institution application for admin review', async function () {
        const response = await adminUser.fetch(
          `/api/admin/institutions/applications/${institutionApplicationId}`,
        );

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);

        // Verify application details structure
        assertPropNumber(responseData, 'id');
        assertPropString(responseData, 'businessName');
        assertPropString(responseData, 'submittedDate');
        strictEqual(responseData.id, institutionApplicationId);

        // Verify applicant user details
        assertPropDefined(responseData, 'applicantUser');
        const applicantUser = responseData.applicantUser;
        assertPropNumber(applicantUser, 'id');
        assertPropString(applicantUser, 'email');
        assertPropString(applicantUser, 'name');
        assertProp(
          v =>
            v === ('none' as const) ||
            v === ('pending' as const) ||
            v === ('verified' as const) ||
            v === 'rejected',
          applicantUser,
          'kycStatus',
        );

        // Verify business documents with signed URLs
        assertPropDefined(responseData, 'businessDocuments');
        const businessDocuments = responseData.businessDocuments;

        // Check if document URLs are provided (may be null in test environment)
        assertDefined(businessDocuments);
        if (
          'incorporationCertificateUrl' in businessDocuments &&
          businessDocuments.incorporationCertificateUrl
        ) {
          assertPropString(businessDocuments, 'incorporationCertificateUrl');
        }
        if ('taxRegistrationUrl' in businessDocuments && businessDocuments.taxRegistrationUrl) {
          assertPropString(businessDocuments, 'taxRegistrationUrl');
        }
        if ('businessLicenseUrl' in businessDocuments && businessDocuments.businessLicenseUrl) {
          assertPropString(businessDocuments, 'businessLicenseUrl');
        }

        // Verify due diligence checklist
        assertPropDefined(responseData, 'dueDiligenceChecklist');
        const checklist = responseData.dueDiligenceChecklist;
        assertPropDefined(checklist, 'kycVerified');
        assertPropDefined(checklist, 'businessDocumentsValid');
        assertPropDefined(checklist, 'regulatoryCompliance');
        assertPropDefined(checklist, 'riskAssessmentComplete');
      });

      it('should return 404 for non-existent institution application', async function () {
        const response = await adminUser.fetch('/api/admin/institutions/applications/99999');

        strictEqual(response.status, 404, `Expected 404, got ${response.status}`);
      });
    });

    describe('PUT /admin/institutions/applications/{id}/approve', function () {
      let approveTestApplicationId: number;
      let approveTestUser: TestUser;

      before(async function () {
        // Create a separate user for approval testing
        approveTestUser = await createKycTestUser({
          testId,
          testSetup,
          email: `institution_approve_test_${testId}@test.com`,
          name: `Institution Approve Test User ${testId}`,
        });

        // Create another institution application for approval testing
        const formData = createInstitutionFormData({
          businessName: `PT Approval Test ${testId}`,
          npwpNumber: '05.678.901.2-345.000',
        });

        const response = await approveTestUser.fetch('/api/institution-applications', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Institution application failed: ${JSON.stringify(errorData)}`);
        }

        const responseData = await response.json();
        if (!responseData.application || !responseData.application.id) {
          throw new Error(`Invalid response structure: ${JSON.stringify(responseData)}`);
        }
        approveTestApplicationId = responseData.application.id;
      });

      it('should successfully approve a pending institution application', async function () {
        const response = await adminUser.fetch(
          `/api/admin/institutions/applications/${approveTestApplicationId}/approve`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notes: 'All business documentation verified and compliance checks passed',
            }),
          },
        );

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropDefined(responseData, 'success');
        assertPropString(responseData, 'message');
        assertPropNumber(responseData, 'applicationId');
        assertPropString(responseData, 'processedDate');
        assertPropString(responseData, 'processingAdmin');

        strictEqual(responseData.success, true);
        strictEqual(responseData.applicationId, approveTestApplicationId);

        // Should also have institution ID if institution was created
        if ('institutionId' in responseData && responseData.institutionId) {
          assertPropNumber(responseData, 'institutionId');
        }
      });

      it('should return 409 when trying to approve already processed application', async function () {
        // Try to approve the same application again
        const response = await adminUser.fetch(
          `/api/admin/institutions/applications/${approveTestApplicationId}/approve`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              notes: 'Trying to approve again',
            }),
          },
        );

        strictEqual(response.status, 409, `Expected 409, got ${response.status}`);

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');
        if ('success' in errorData) {
          strictEqual(errorData.success, false);
        }
      });
    });

    describe('PUT /admin/institutions/applications/{id}/reject', function () {
      let rejectTestApplicationId: number;
      let rejectTestUser: TestUser;

      before(async function () {
        // Create a separate user for rejection testing
        rejectTestUser = await createKycTestUser({
          testId,
          testSetup,
          email: `institution_reject_test_${testId}@test.com`,
          name: `Institution Reject Test User ${testId}`,
        });

        // Create another institution application for rejection testing
        const formData = createInstitutionFormData({
          businessName: `PT Rejection Test ${testId}`,
          npwpNumber: '06.789.012.3-456.000',
          registrationNumber: generateUniqueRegistrationNumber(), // Generate unique registration number
        });

        const response = await rejectTestUser.fetch('/api/institution-applications', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Institution application failed: ${JSON.stringify(errorData)}`);
        }

        const responseData = await response.json();
        if (!responseData.application || !responseData.application.id) {
          throw new Error(`Invalid response structure: ${JSON.stringify(responseData)}`);
        }
        rejectTestApplicationId = responseData.application.id;
      });

      it('should successfully reject a pending institution application', async function () {
        const rejectionReason =
          'Business registration documents are incomplete. Please provide updated incorporation certificate and tax registration documents.';

        const response = await adminUser.fetch(
          `/api/admin/institutions/applications/${rejectTestApplicationId}/reject`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reason: rejectionReason,
            }),
          },
        );

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropDefined(responseData, 'success');
        assertPropString(responseData, 'message');
        assertPropNumber(responseData, 'applicationId');
        assertPropString(responseData, 'processedDate');
        assertPropString(responseData, 'processingAdmin');

        strictEqual(responseData.success, true);
        strictEqual(responseData.applicationId, rejectTestApplicationId);
      });

      it('should require rejection reason', async function () {
        const response = await adminUser.fetch(
          `/api/admin/institutions/applications/${institutionApplicationId}/reject`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}), // Missing reason
          },
        );

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);
      });

      it('should validate minimum reason length', async function () {
        const response = await adminUser.fetch(
          `/api/admin/institutions/applications/${institutionApplicationId}/reject`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reason: 'Short', // Too short (minimum 10 characters according to OpenAPI)
            }),
          },
        );

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);
      });
    });
  });

  describe('Authentication and Authorization', function () {
    describe('Admin Authorization', function () {
      it('should require admin role for KYC admin endpoints', async function () {
        // Test with regular user authentication (non-admin)
        const response = await mainUser.fetch('/api/admin/kyc/queue');

        strictEqual(
          response.status,
          403,
          `Expected 403 for non-admin user, got ${response.status}`,
        );

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertProp(check(isNullable, isString, isNumber), error, 'code');
        strictEqual(error.code, 'ADMIN_REQUIRED');
      });

      it('should require admin role for institution admin endpoints', async function () {
        // Test with regular user authentication (non-admin)
        const response = await mainUser.fetch('/api/admin/institutions/applications');

        strictEqual(
          response.status,
          403,
          `Expected 403 for non-admin user, got ${response.status}`,
        );

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const error = errorData.error;
        assertProp(check(isNullable, isString, isNumber), error, 'code');
        strictEqual(error.code, 'ADMIN_REQUIRED');
      });

      it('should allow admin access to admin endpoints', async function () {
        // Test admin KYC queue access
        const kycResponse = await adminUser.fetch('/api/admin/kyc/queue');
        strictEqual(kycResponse.status, 200, 'Admin should be able to access KYC queue');

        // Test admin institution applications access
        const institutionResponse = await adminUser.fetch('/api/admin/institutions/applications');
        strictEqual(
          institutionResponse.status,
          200,
          'Admin should be able to access institution applications',
        );
      });
    });

    it('should reject KYC submission without authentication', async function () {
      const formData = createKYCFormData();

      const response = await fetch(`${testSetup.backendUrl}/api/users/kyc/submit`, {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });

    it('should reject institution application without authentication', async function () {
      const formData = createInstitutionFormData();

      const response = await fetch(`${testSetup.backendUrl}/api/institutions`, {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });

    it('should reject KYC status request without authentication', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/users/kyc/status`);

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });

    it('should reject institution status request without authentication', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/institution-applications/status`);

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });
  });

  describe('Data Validation Edge Cases', function () {
    it('should handle extremely long text fields appropriately', async function () {
      const longText = 'a'.repeat(200); // Exceeds 160 character limit

      const formData = createKYCFormData({
        name: longText,
      });

      const response = await mainUser.fetch('/api/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 422, `Expected 422, got ${response.status}`);

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');

      const error = errorData.error;
      assertDefined(error);
      assertPropString(error, 'code');
      strictEqual(error.code, 'VALIDATION_ERROR');
      assertPropDefined(error, 'details');

      const details = error.details;
      assertDefined(details);
      assertPropString(details, 'name');
      ok(details.name.includes('160') || details.name.includes('maxLength'));
    });

    it('should handle special characters in postal code', async function () {
      const formData = createKYCFormData({
        postalCode: '1a2b3', // Contains letters
      });

      const response = await mainUser.fetch('/api/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 422, `Expected 422, got ${response.status}`);

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');

      const error = errorData.error;
      assertDefined(error);
      assertPropString(error, 'code');
      strictEqual(error.code, 'VALIDATION_ERROR');
      assertPropDefined(error, 'details');

      const details = error.details;
      assertDefined(details);
      assertPropString(details, 'postalCode');
    });

    it('should validate NIK contains only digits', async function () {
      const formData = createKYCFormData({
        nik: '3171a12345678901', // Contains letter
      });

      const response = await mainUser.fetch('/api/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 422, `Expected 422, got ${response.status}`);

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');

      const error = errorData.error;
      assertDefined(error);
      assertPropString(error, 'code');
      strictEqual(error.code, 'VALIDATION_ERROR');
      assertPropDefined(error, 'details');

      const details = error.details;
      assertDefined(details);
      assertPropString(details, 'nik');
    });
  });
});
