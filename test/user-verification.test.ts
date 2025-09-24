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
  assertPropDate,
  assertPropDefined,
  assertPropNullableDate,
  assertPropNullableString,
  assertPropNumber,
  assertPropOneOf,
  assertPropString,
} from './setup/assertions';
import { setupBetterAuthClient } from './setup/better-auth';
import { waitForEmailVerification } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';

suite('User Verification API E2E Tests', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let authClient: ReturnType<typeof setupBetterAuthClient>;
  let authenticatedUserId: string;
  let authTokens: { token: string; sessionToken: string };

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();
    authClient = setupBetterAuthClient(testSetup.backendUrl);

    // Create and authenticate a test user for all tests
    const email = `verification_test_${testId}@test.com`;
    const password = 'ValidPassword123!';

    const signUpResult = await authClient.authClient.signUp.email({
      email,
      password,
      name: `Test User ${testId}`,
      callbackURL: 'http://localhost/test-callback',
    });

    ok(signUpResult.data?.user.id, 'User ID should exist after sign up');
    authenticatedUserId = signUpResult.data.user.id;

    await waitForEmailVerification(testSetup.mailpitUrl, email);

    const signInResult = await authClient.authClient.signIn.email({
      email,
      password,
    });

    assertDefined(signInResult.data, 'Sign in result data should exist');
    assertPropString(signInResult.data, 'token');
    authTokens = {
      token: signInResult.data.token,
      sessionToken: signInResult.data.token,
    };
  });

  after(async function () {
    await testSetup?.teardown();
  });

  // Helper function to create form data for KYC submission
  function createKYCFormData(overrides: Partial<Record<string, string>> = {}) {
    const formData = new FormData();

    const defaultData = {
      nik: '3171012345678901',
      name: 'John Doe Prasetyo',
      birthCity: 'Jakarta',
      birthDate: '1990-05-15',
      province: 'DKI Jakarta',
      city: 'Jakarta Pusat',
      district: 'Menteng',
      subdistrict: 'Menteng',
      address: 'Jl. MH Thamrin No. 123, RT 001 RW 002',
      postalCode: '10350',
      ...overrides,
    };

    Object.entries(defaultData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Create dummy image files
    const dummyImageData = 'dummy-image-data';
    const idCardFile = new Blob([dummyImageData], { type: 'image/jpeg' });
    const selfieFile = new Blob([dummyImageData], { type: 'image/jpeg' });

    formData.append('idCardPhoto', idCardFile, 'id-card.jpg');
    formData.append('selfieWithIdCardPhoto', selfieFile, 'selfie.jpg');

    return formData;
  }

  // Helper function to create form data for Institution submission
  function createInstitutionFormData(overrides: Partial<Record<string, string>> = {}) {
    const formData = new FormData();

    const defaultData = {
      businessName: 'PT Teknologi Nusantara Test',
      registrationNumber: '8120202123456',
      npwpNumber: '01.234.567.8-901.000',
      businessType: 'PT',
      businessDescription: 'Technology consulting and software development services',
      province: 'DKI Jakarta',
      city: 'Jakarta Selatan',
      district: 'Kebayoran Baru',
      subdistrict: 'Senayan',
      address: 'Jl. Asia Afrika No. 8, Komplex Gelora Bung Karno',
      postalCode: '10270',
      directorName: 'Budi Santoso',
      directorPosition: 'CEO',
      ...overrides,
    };

    Object.entries(defaultData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Create dummy document files
    const dummyPdfData = 'dummy-pdf-data';
    const npwpDoc = new Blob([dummyPdfData], { type: 'application/pdf' });
    const registrationDoc = new Blob([dummyPdfData], { type: 'application/pdf' });
    const deedDoc = new Blob([dummyPdfData], { type: 'application/pdf' });
    const directorIdCard = new Blob([dummyPdfData], { type: 'image/jpeg' });
    const ministryDoc = new Blob([dummyPdfData], { type: 'application/pdf' });

    formData.append('npwpDocument', npwpDoc, 'npwp.pdf');
    formData.append('registrationDocument', registrationDoc, 'registration.pdf');
    formData.append('deedOfEstablishment', deedDoc, 'deed.pdf');
    formData.append('directorIdCard', directorIdCard, 'director-id.jpg');
    formData.append('ministryApprovalDocument', ministryDoc, 'ministry.pdf');

    return formData;
  }

  // Helper function to make authenticated requests
  async function authenticatedFetch(path: string, options: RequestInit = {}) {
    const response = await fetch(`${testSetup.backendUrl}/api${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${authTokens.token}`,
      },
    });

    return response;
  }

  describe('KYC Verification', function () {
    describe('POST /users/kyc/submit', function () {
      it('should successfully submit KYC with valid data', async function () {
        const formData = createKYCFormData();

        const response = await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 201, `Expected 201, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropString(responseData, 'message');
        assertPropDefined(responseData, 'kycSubmission');

        // Verify KYC submission object
        const kycSubmission = responseData.kycSubmission;
        assertDefined(kycSubmission);
        assertPropNumber(kycSubmission, 'id');
        assertPropOneOf(kycSubmission, 'status', ['pending', 'verified', 'rejected']);
        assertPropDate(kycSubmission, 'submittedDate');
        assertPropNullableDate(kycSubmission, 'verifiedDate');
        assertPropNullableDate(kycSubmission, 'rejectedDate');
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

        const response = await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);

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

        const response = await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);

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

        const response = await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);

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
        const formData = new FormData();
        formData.append('name', 'John Doe'); // Only partial data

        const response = await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);

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
        // First submission
        const formData1 = createKYCFormData({
          nik: '3171987654321098', // Unique NIK for this test
        });

        await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData1,
        });

        // Second submission with same NIK (different user would be needed in real scenario)
        const formData2 = createKYCFormData({
          nik: '3171987654321098', // Same NIK
        });

        const response = await authenticatedFetch('/users/kyc/submit', {
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
        strictEqual(error.code, 'DUPLICATE_NIK');
        assertPropDefined(error, 'details');

        const details = error.details;
        assertDefined(details);
        assertPropString(details, 'nik');
        assertPropString(details, 'message');
        strictEqual(details.nik, '3171987654321098');
      });
    });

    describe('GET /users/kyc/status', function () {
      it('should return KYC status for user with pending submission', async function () {
        // First submit KYC
        const formData = createKYCFormData({
          nik: '3171555666777888', // Unique NIK for status test
        });

        await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        // Then check status
        const response = await authenticatedFetch('/users/kyc/status');

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropOneOf(responseData, 'kycStatus', ['pending', 'verified', 'rejected', 'none']);

        // Should have pending status and submission details
        strictEqual(responseData.kycStatus, 'pending');
        assertPropDefined(responseData, 'submission');

        const submission = responseData.submission;
        assertDefined(submission);
        assertPropNumber(submission, 'id');
        assertPropOneOf(submission, 'status', ['pending', 'verified', 'rejected']);
        assertPropDate(submission, 'submittedDate');
        assertPropDefined(responseData, 'canResubmit');

        // Should not be able to resubmit while pending
        strictEqual(responseData.canResubmit, false);
      });

      it('should return no submission status for user without KYC', async function () {
        // Create a new user without KYC submission
        const email = `no_kyc_${testId}@test.com`;
        const password = 'ValidPassword123!';

        const signUpResult = await authClient.authClient.signUp.email({
          email,
          password,
          name: `No KYC User ${testId}`,
          callbackURL: 'http://localhost/test-callback',
        });

        await waitForEmailVerification(testSetup.mailpitUrl, email);

        const signInResult = await authClient.authClient.signIn.email({
          email,
          password,
        });

        assertDefined(signInResult.data, 'Sign in result data should exist');
        assertPropString(signInResult.data, 'token');
        const noKycToken = signInResult.data.token;

        const response = await fetch(`${testSetup.backendUrl}/api/users/kyc/status`, {
          headers: {
            Authorization: `Bearer ${noKycToken}`,
          },
        });

        strictEqual(response.status, 200, `Expected 200, got ${response.status}`);

        const responseData = await response.json();
        assertDefined(responseData);
        assertPropOneOf(responseData, 'kycStatus', ['pending', 'verified', 'rejected', 'none']);
        assertPropDefined(responseData, 'submission');
        assertPropDefined(responseData, 'canResubmit');
        strictEqual(responseData.kycStatus, 'none');
        strictEqual(responseData.submission, null);
        strictEqual(responseData.canResubmit, true);
      });
    });
  });

  describe('Institution Verification', function () {
    describe('POST /institution-applications', function () {
      it('should successfully submit institution application with valid data', async function () {
        const formData = createInstitutionFormData();

        const response = await authenticatedFetch('/institution-applications', {
          method: 'POST',
          body: formData,
        });

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
        assertPropDate(application, 'submittedDate');
        assertPropOneOf(application, 'status', [
          'Submitted',
          'UnderReview',
          'Verified',
          'Rejected',
        ]);

        // Initial application should be submitted
        strictEqual(application.status, 'Submitted');
        strictEqual(application.businessName, 'PT Teknologi Nusantara Test');
      });

      it('should reject institution application with invalid NPWP format', async function () {
        const formData = createInstitutionFormData({
          npwpNumber: '123456789', // Invalid NPWP format
        });

        const response = await authenticatedFetch('/institution-applications', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);

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
        });

        await authenticatedFetch('/institutions', {
          method: 'POST',
          body: formData1,
        });

        // Second application with same business name
        const formData2 = createInstitutionFormData({
          businessName,
          npwpNumber: '02.222.222.2-222.222',
        });

        const response = await authenticatedFetch('/institutions', {
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

        // Add only basic info without required documents
        formData.append('businessName', 'PT Test Without Docs');
        formData.append('registrationNumber', '1234567890123');
        formData.append('npwpNumber', '01.234.567.8-901.000');
        formData.append('businessType', 'PT');

        const response = await authenticatedFetch('/institution-applications', {
          method: 'POST',
          body: formData,
        });

        strictEqual(response.status, 400, `Expected 400, got ${response.status}`);

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
          registrationNumber: '1234567890123',
          npwpNumber: '02.345.678.9-012.000',
          businessType: 'CV',
          businessDescription: 'Import and export trading company specializing in electronics',
          province: 'Jawa Timur',
          city: 'Surabaya',
          district: 'Wonokromo',
          subdistrict: 'Wonokromo',
          address: 'Jl. Raya Darmo No. 123',
          postalCode: '60241',
          directorName: 'Siti Rahayu',
          directorPosition: 'Director',
        });

        const response = await authenticatedFetch('/institution-applications', {
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

        const submitResponse = await authenticatedFetch('/institution-applications', {
          method: 'POST',
          body: formData,
        });

        const submitData = await submitResponse.json();

        // Then check status (no longer needs application ID)
        const response = await authenticatedFetch('/institution-applications/status');

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
        assertPropDate(application, 'submittedDate');
        assertPropOneOf(application, 'status', [
          'Submitted',
          'UnderReview',
          'Verified',
          'Rejected',
        ]);

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
        assertPropOneOf(documents, 'status', ['incomplete', 'complete', 'under_review']);

        // Initial application should have complete documents
        ok(documents.uploaded >= 5, 'Should have uploaded at least 5 required documents');
        ok(
          documents.uploaded === documents.required,
          'Uploaded documents should equal required documents',
        );
      });

      it('should return 404 for user without institution application', async function () {
        // Create a new user without institution application
        const email = `no_institution_${testId}@test.com`;
        const password = 'ValidPassword123!';

        const signUpResult = await authClient.authClient.signUp.email({
          email,
          password,
          name: `No Institution User ${testId}`,
          callbackURL: 'http://localhost/test-callback',
        });

        await waitForEmailVerification(testSetup.mailpitUrl, email);

        const signInResult = await authClient.authClient.signIn.email({
          email,
          password,
        });

        assertDefined(signInResult.data, 'Sign in result data should exist');
        assertPropString(signInResult.data, 'token');
        const noInstitutionToken = signInResult.data.token;

        const response = await fetch(
          `${testSetup.backendUrl}/api/institution-applications/status`,
          {
            headers: {
              Authorization: `Bearer ${noInstitutionToken}`,
            },
          },
        );

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

  describe('Authentication and Authorization', function () {
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

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 400, `Expected 400, got ${response.status}`);

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

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 400, `Expected 400, got ${response.status}`);

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

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 400, `Expected 400, got ${response.status}`);

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
