import { ok, strictEqual } from 'node:assert/strict';

import {
  assertArray,
  assertDefined,
  assertProp,
  assertPropArrayMapOf,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it } from './setup/test';
import { createKycTestUser, createTestUser, TestUser } from './setup/user';
import {
  createInstitutionFormData,
  createKYCFormData,
  generateUniqueNIK,
  generateUniqueNPWP,
  generateUniqueRegistrationNumber,
} from './user-verification-test-data';

describe('Admin Configuration API', function () {
  const testId = Date.now().toString(36).toLowerCase();
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let adminUser: TestUser;
  let user1: TestUser;
  let user2: TestUser;
  let user3: TestUser;

  before(async function () {
    testSetup = await setup();
    [adminUser, user1, user2, user3] = await Promise.all([
      createTestUser({ testId, testSetup, email: 'admin@test.com', role: 'admin' }),
      createKycTestUser({ testId, testSetup, email: 'user1@test.com' }),
      createKycTestUser({ testId, testSetup, email: 'user2@test.com' }),
      createKycTestUser({ testId, testSetup, email: 'user3@test.com' }),
    ]);

    // Sign out and sign back in to refresh the session with the updated admin role
    await adminUser.authClient.signOut();
    await adminUser.authClient.signIn.email({
      email: 'admin@test.com',
      password: 'ValidPassword123!',
    });
  });

  after(async function () {
    await testSetup.teardown();
  });

  it('GET /api/admin/kyc/queue', async function () {
    // user1, user2, user3 shall submit KYC
    const kycSubmissions: Array<{ user: TestUser; formData: FormData }> = [
      { user: user1, formData: createKYCFormData({ nik: generateUniqueNIK() }) },
      { user: user2, formData: createKYCFormData({ nik: generateUniqueNIK() }) },
      { user: user3, formData: createKYCFormData({ nik: generateUniqueNIK() }) },
    ];

    const submissionPromises = kycSubmissions.map(async ({ user, formData }) => {
      const response = await user.fetch('/api/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      if (response.status !== 201) {
        const errorText = await response.text();
        console.error(
          `KYC submission failed for ${user.email} with status ${response.status}: ${errorText}`,
        );
      }

      strictEqual(response.status, 201, `KYC submission should be successful for ${user.email}`);

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'kycSubmission');
      assertPropNumber((responseData as any).kycSubmission, 'id');
      assertPropString((responseData as any).kycSubmission, 'submittedDate');

      return {
        user,
        kycId: (responseData as any).kycSubmission.id,
        submittedDate: (responseData as any).kycSubmission.submittedDate,
      };
    });

    const submittedKycs = await Promise.all(submissionPromises);

    // adminUser shall fetch KYC queue and verify the submissions are present
    const queueResponse = await adminUser.fetch('/api/admin/kyc/queue');

    strictEqual(queueResponse.status, 200, 'Admin should be able to fetch KYC queue');

    const queueData = await queueResponse.json();
    assertDefined(queueData);
    assertPropDefined(queueData, 'submissions');
    assertArray(queueData.submissions);

    // test shall validate KYC queue response data
    assertPropArrayMapOf(queueData, 'submissions', function (submission) {
      assertDefined(submission);
      assertPropNumber(submission, 'id');
      assertPropNumber(submission, 'userId');
      assertPropString(submission, 'userName');
      assertPropString(submission, 'userEmail');
      assertPropString(submission, 'submittedDate');
      assertPropString(submission, 'timeInQueue');
      assertProp(
        v => v === ('normal' as const) || v === ('high' as const) || v === 'urgent',
        submission,
        'priority',
      );
      return submission;
    });

    // Verify that all submitted KYC applications are present in the queue
    const queueSubmissionIds = queueData.submissions.map((s: any) => s.id);
    for (const submittedKyc of submittedKycs) {
      ok(
        queueSubmissionIds.includes(submittedKyc.kycId),
        `KYC submission ${submittedKyc.kycId} for user ${submittedKyc.user.email} should be in the queue`,
      );

      // Find the submission in the queue and verify its details
      const queueSubmission = queueData.submissions.find((s: any) => s.id === submittedKyc.kycId);
      assertDefined(queueSubmission, `Should find KYC submission ${submittedKyc.kycId} in queue`);

      // Verify the submission belongs to the correct user
      strictEqual(
        (queueSubmission as any).userId,
        Number(submittedKyc.user.id),
        'User ID should match',
      );
      strictEqual(
        (queueSubmission as any).userEmail,
        submittedKyc.user.email,
        'User email should match',
      );
      strictEqual(
        (queueSubmission as any).submittedDate,
        submittedKyc.submittedDate,
        'Submitted date should match',
      );
    }

    // Verify pagination metadata if present
    if ('pagination' in queueData && queueData.pagination) {
      const pagination = queueData.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      assertPropNumber(pagination, 'total');
      ok(
        pagination.total >= submittedKycs.length,
        'Total should be at least the number of submitted KYC applications',
      );
    }
  });

  it('GET /api/admin/kyc/{id}', async function () {
    // Get the first KYC submission ID from the queue
    const queueResponse = await adminUser.fetch('/api/admin/kyc/queue');
    strictEqual(queueResponse.status, 200, 'Should be able to fetch KYC queue');

    const queueData = await queueResponse.json();
    assertDefined(queueData);
    assertPropDefined(queueData, 'submissions');
    assertArray(queueData.submissions);
    ok(queueData.submissions.length > 0, 'Should have at least one KYC submission');

    const firstSubmission = queueData.submissions[0] as any;
    const kycId = firstSubmission.id;

    // Get detailed KYC information
    const detailResponse = await adminUser.fetch(`/api/admin/kyc/${kycId}`);
    strictEqual(detailResponse.status, 200, 'Should be able to fetch KYC details');

    const detailData = await detailResponse.json();
    assertDefined(detailData);

    // Verify response structure according to OpenAPI spec
    assertPropNumber(detailData, 'id');
    assertPropNumber(detailData, 'userId');
    strictEqual(detailData.id, kycId, 'KYC ID should match');

    // Verify user info
    assertPropDefined(detailData, 'userInfo');
    const userInfo = detailData.userInfo;
    assertPropString(userInfo, 'email');
    assertPropString(userInfo, 'name');
    assertPropString(userInfo, 'createdDate');

    // Verify submission data
    assertPropDefined(detailData, 'submissionData');
    const submissionData = detailData.submissionData;
    assertPropString(submissionData, 'nik');
    assertPropString(submissionData, 'name');
    assertPropString(submissionData, 'birthDate');
    assertPropString(submissionData, 'address');

    // Verify documents
    assertPropDefined(detailData, 'documents');
    const documents = detailData.documents;
    assertPropString(documents, 'idCardPhotoUrl');
    assertPropString(documents, 'selfieWithIdCardPhotoUrl');

    // URLs should be signed and accessible
    ok(documents.idCardPhotoUrl.length > 0, 'ID card photo URL should not be empty');
    ok(documents.selfieWithIdCardPhotoUrl.length > 0, 'Selfie photo URL should not be empty');
  });

  it('GET /api/admin/kyc/{id} - Not Found', async function () {
    const response = await adminUser.fetch('/api/admin/kyc/99999');
    strictEqual(response.status, 404, 'Should return 404 for non-existent KYC');

    const errorData = await response.json();
    assertDefined(errorData);
    assertPropDefined(errorData, 'error');
    const error = errorData.error;
    assertPropString(error, 'code');
    assertPropString(error, 'message');
  });

  it('PUT /api/admin/kyc/{id}/approve', async function () {
    // Create a new KYC submission for approval testing
    const newUser = await createKycTestUser({
      testId,
      testSetup,
      email: `approve_test_${testId}@test.com`,
    });

    const formData = createKYCFormData({ nik: generateUniqueNIK() });
    const submitResponse = await newUser.fetch('/api/users/kyc/submit', {
      method: 'POST',
      body: formData,
    });
    strictEqual(submitResponse.status, 201, 'KYC submission should be successful');

    const submitData = await submitResponse.json();
    assertDefined(submitData);
    assertPropDefined(submitData, 'kycSubmission');
    const kycId = (submitData as any).kycSubmission.id;

    // Approve the KYC
    const approveResponse = await adminUser.fetch(`/api/admin/kyc/${kycId}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'All documents verified successfully' }),
    });
    strictEqual(approveResponse.status, 200, 'KYC approval should be successful');

    const approveData = await approveResponse.json();
    assertDefined(approveData);
    assertPropDefined(approveData, 'success');
    assertPropString(approveData, 'message');
    assertPropNumber(approveData, 'kycId');
    assertPropString(approveData, 'processedDate');
    assertPropString(approveData, 'processingAdmin');

    strictEqual(approveData.success, true);
    strictEqual(approveData.kycId, kycId);
    ok(approveData.message.includes('approved'), 'Message should indicate approval');

    // Verify that the same KYC cannot be approved again
    const duplicateApproveResponse = await adminUser.fetch(`/api/admin/kyc/${kycId}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Trying to approve again' }),
    });
    strictEqual(duplicateApproveResponse.status, 409, 'Should not allow duplicate approval');
  });

  it('PUT /api/admin/kyc/{id}/reject', async function () {
    // Create a new KYC submission for rejection testing
    const newUser = await createKycTestUser({
      testId,
      testSetup,
      email: `reject_test_${testId}@test.com`,
    });

    const formData = createKYCFormData({ nik: generateUniqueNIK() });
    const submitResponse = await newUser.fetch('/api/users/kyc/submit', {
      method: 'POST',
      body: formData,
    });
    strictEqual(submitResponse.status, 201, 'KYC submission should be successful');

    const submitData = await submitResponse.json();
    assertDefined(submitData);
    assertPropDefined(submitData, 'kycSubmission');
    const kycId = (submitData as any).kycSubmission.id;

    // Reject the KYC
    const rejectionReason =
      'Document quality is insufficient for verification. Please resubmit with clearer photos.';
    const rejectResponse = await adminUser.fetch(`/api/admin/kyc/${kycId}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectionReason }),
    });
    strictEqual(rejectResponse.status, 200, 'KYC rejection should be successful');

    const rejectData = await rejectResponse.json();
    assertDefined(rejectData);
    assertPropDefined(rejectData, 'success');
    assertPropString(rejectData, 'message');
    assertPropNumber(rejectData, 'kycId');
    assertPropString(rejectData, 'processedDate');
    assertPropString(rejectData, 'processingAdmin');

    strictEqual(rejectData.success, true);
    strictEqual(rejectData.kycId, kycId);
    ok(rejectData.message.includes('rejected'), 'Message should indicate rejection');

    // Test rejection validation
    const invalidRejectResponse = await adminUser.fetch(`/api/admin/kyc/${kycId}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Short' }), // Too short
    });
    strictEqual(invalidRejectResponse.status, 400, 'Should validate rejection reason length');
  });

  it('GET /api/admin/institutions/applications', async function () {
    // Create an institution application for testing
    const institutionUser = await createKycTestUser({
      testId,
      testSetup,
      email: `institution_admin_test_${testId}@test.com`,
    });

    const formData = createInstitutionFormData({
      businessName: `PT Admin Test ${testId}`,
      registrationNumber: generateUniqueRegistrationNumber(),
    });
    const submitResponse = await institutionUser.fetch('/api/institution-applications', {
      method: 'POST',
      body: formData,
    });
    strictEqual(submitResponse.status, 201, 'Institution application should be successful');

    // Get institution applications queue
    const queueResponse = await adminUser.fetch('/api/admin/institutions/applications');
    strictEqual(queueResponse.status, 200, 'Should be able to fetch institution applications');

    const queueData = await queueResponse.json();
    assertDefined(queueData);
    assertPropDefined(queueData, 'applications');
    assertArray(queueData.applications);

    // Should find our submitted application
    const ourApplication = queueData.applications.find(
      (app: any) => app.businessName === `PT Admin Test ${testId}`,
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
  });

  it('GET /api/admin/institutions/applications/{id}', async function () {
    // Get an application ID from the queue
    const queueResponse = await adminUser.fetch('/api/admin/institutions/applications');
    strictEqual(queueResponse.status, 200, 'Should be able to fetch institution applications');

    const queueData = await queueResponse.json();
    assertDefined(queueData);
    assertPropDefined(queueData, 'applications');
    assertArray(queueData.applications);
    ok(queueData.applications.length > 0, 'Should have at least one institution application');

    const firstApplication = queueData.applications[0] as any;
    const applicationId = firstApplication.id;

    // Get detailed application information
    const detailResponse = await adminUser.fetch(
      `/api/admin/institutions/applications/${applicationId}`,
    );
    strictEqual(detailResponse.status, 200, 'Should be able to fetch application details');

    const detailData = await detailResponse.json();
    assertDefined(detailData);

    // Verify response structure
    assertPropNumber(detailData, 'id');
    assertPropString(detailData, 'businessName');
    assertPropString(detailData, 'submittedDate');
    strictEqual(detailData.id, applicationId, 'Application ID should match');

    // Verify applicant user details
    assertPropDefined(detailData, 'applicantUser');
    const applicantUser = detailData.applicantUser;
    assertPropNumber(applicantUser, 'id');
    assertPropString(applicantUser, 'email');
    assertPropString(applicantUser, 'name');

    // Verify business documents
    assertPropDefined(detailData, 'businessDocuments');
    const businessDocuments = detailData.businessDocuments;

    // Verify due diligence checklist
    assertPropDefined(detailData, 'dueDiligenceChecklist');
    const checklist = detailData.dueDiligenceChecklist;
    assertPropDefined(checklist, 'kycVerified');
    assertPropDefined(checklist, 'businessDocumentsValid');
    assertPropDefined(checklist, 'regulatoryCompliance');
    assertPropDefined(checklist, 'riskAssessmentComplete');
  });

  it('PUT /api/admin/institutions/applications/{id}/approve', async function () {
    // Create a new institution application for approval testing
    const newUser = await createKycTestUser({
      testId,
      testSetup,
      email: `institution_approve_test_${testId}@test.com`,
    });

    const formData = createInstitutionFormData({
      businessName: `PT Approval Test ${testId}`,
      registrationNumber: generateUniqueRegistrationNumber(),
      npwpNumber: generateUniqueNPWP(),
    });
    const submitResponse = await newUser.fetch('/api/institution-applications', {
      method: 'POST',
      body: formData,
    });
    strictEqual(submitResponse.status, 201, 'Institution application should be successful');

    const submitData = await submitResponse.json();
    assertDefined(submitData);
    assertPropDefined(submitData, 'application');
    const applicationId = (submitData as any).application.id;

    // Approve the application
    const approveResponse = await adminUser.fetch(
      `/api/admin/institutions/applications/${applicationId}/approve`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: 'All business documentation verified and compliance checks passed',
        }),
      },
    );
    strictEqual(approveResponse.status, 200, 'Application approval should be successful');

    const approveData = await approveResponse.json();
    assertDefined(approveData);
    assertPropDefined(approveData, 'success');
    assertPropString(approveData, 'message');
    assertPropNumber(approveData, 'applicationId');
    assertPropString(approveData, 'processedDate');
    assertPropString(approveData, 'processingAdmin');

    strictEqual(approveData.success, true);
    strictEqual(approveData.applicationId, applicationId);
    ok(approveData.message.includes('approved'), 'Message should indicate approval');
  });

  it('PUT /api/admin/institutions/applications/{id}/reject', async function () {
    // Create a new institution application for rejection testing
    const newUser = await createKycTestUser({
      testId,
      testSetup,
      email: `institution_reject_test_${testId}@test.com`,
    });

    const formData = createInstitutionFormData({
      businessName: `PT Rejection Test ${testId}`,
      registrationNumber: generateUniqueRegistrationNumber(),
      npwpNumber: generateUniqueNPWP(),
    });
    const submitResponse = await newUser.fetch('/api/institution-applications', {
      method: 'POST',
      body: formData,
    });
    strictEqual(submitResponse.status, 201, 'Institution application should be successful');

    const submitData = await submitResponse.json();
    assertDefined(submitData);
    assertPropDefined(submitData, 'application');
    const applicationId = (submitData as any).application.id;

    // Reject the application
    const rejectionReason =
      'Business registration documents are incomplete. Please provide updated incorporation certificate and tax registration documents.';
    const rejectResponse = await adminUser.fetch(
      `/api/admin/institutions/applications/${applicationId}/reject`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      },
    );
    strictEqual(rejectResponse.status, 200, 'Application rejection should be successful');

    const rejectData = await rejectResponse.json();
    assertDefined(rejectData);
    assertPropDefined(rejectData, 'success');
    assertPropString(rejectData, 'message');
    assertPropNumber(rejectData, 'applicationId');
    assertPropString(rejectData, 'processedDate');
    assertPropString(rejectData, 'processingAdmin');

    strictEqual(rejectData.success, true);
    strictEqual(rejectData.applicationId, applicationId);
    ok(rejectData.message.includes('rejected'), 'Message should indicate rejection');
  });
});
