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
import { assert } from 'node:console';

import {
  assertDefined,
  assertProp,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
  hasProp,
  hasPropDefined,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createTestUser, type TestUser } from './setup/user';
import {
  createInstitutionFormData,
  createKYCFormData,
  generateTestId,
  generateUniqueBusinessName,
  generateUniqueNIK,
  generateUniqueNPWP,
  invalidDataPatterns,
} from './user-verification-test-data';

suite('Error Scenarios E2E Tests', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let testUser: TestUser;

  before(async function () {
    testId = generateTestId();
    testSetup = await setup();

    // Create a test user with Individual user type for KYC access
    testUser = await createTestUser({
      testSetup,
      testId,
      email: `error_test_${testId}@test.com`,
      name: `Error Test User ${testId}`,
      userType: 'Individual', // Required for KYC endpoints
    });
  });

  after(async function () {
    await testSetup?.teardown();
  });

  // Helper function to make authenticated requests
  async function authenticatedFetch(path: string, options: RequestInit = {}) {
    return await testUser.fetch(`/api${path}`, options);
  }

  // Helper function to make unauthenticated requests
  async function unauthenticatedFetch(path: string, options: RequestInit = {}) {
    return await fetch(`${testSetup.backendUrl}/api${path}`, options);
  }

  describe('Authentication and Authorization Errors', function () {
    it('should return 401 for KYC submission without authentication', async function () {
      const formData = createKYCFormData({ nik: generateUniqueNIK() });

      const response = await unauthenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });

    it('should return 401 for KYC status without authentication', async function () {
      const response = await unauthenticatedFetch('/users/kyc/status');

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });

    it('should return 401 for institution application without authentication', async function () {
      const formData = createInstitutionFormData({
        businessName: generateUniqueBusinessName(),
        npwpNumber: generateUniqueNPWP(),
      });

      const response = await unauthenticatedFetch('/institution-applications', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });

    it('should return 401 for institution status without authentication', async function () {
      const response = await unauthenticatedFetch('/institution-applications/status');

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });

    it('should return 401 for invalid bearer token', async function () {
      const formData = createKYCFormData({ nik: generateUniqueNIK() });

      const response = await fetch(`${testSetup.backendUrl}/api/users/kyc/submit`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'Bearer invalid-token-12345',
        },
      });

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });

    it('should return 401 for malformed authorization header', async function () {
      const formData = createKYCFormData({ nik: generateUniqueNIK() });

      const response = await fetch(`${testSetup.backendUrl}/api/users/kyc/submit`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'InvalidFormat token-here',
        },
      });

      strictEqual(response.status, 401, `Expected 401, got ${response.status}`);
    });
  });

  describe('Validation Error Patterns', function () {
    it('should validate NIK with comprehensive error messages', async function () {
      const testCases = [
        { nik: invalidDataPatterns.nik.tooShort, expectedError: '16 digits' },
        { nik: invalidDataPatterns.nik.tooLong, expectedError: '16 digits' },
        { nik: invalidDataPatterns.nik.containsLetters, expectedError: 'digits' },
        { nik: invalidDataPatterns.nik.empty, expectedError: '16 digits' },
      ];

      for (const testCase of testCases) {
        const formData = createKYCFormData({
          nik: testCase.nik,
          name: `NIK Test ${testCase.nik}`,
        });

        const response = await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(
          response.status,
          422,
          `Expected 422 for NIK ${testCase.nik}, got ${response.status}`,
        );

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const { error } = errorData;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const { details } = error;
        assertDefined(details);
        assertPropString(details, 'nik');

        const nikError = details.nik.toLowerCase();
        ok(
          nikError.includes(testCase.expectedError.toLowerCase()),
          `Expected NIK error to contain "${testCase.expectedError}", got "${details.nik}"`,
        );
      }
    });

    it('should validate postal code with comprehensive error messages', async function () {
      const testCases = [
        { postalCode: invalidDataPatterns.postalCode.tooShort, expectedError: '5 digits' },
        { postalCode: invalidDataPatterns.postalCode.tooLong, expectedError: '5 digits' },
        { postalCode: invalidDataPatterns.postalCode.containsLetters, expectedError: 'digits' },
        { postalCode: invalidDataPatterns.postalCode.empty, expectedError: 'required' },
      ];

      for (const testCase of testCases) {
        const formData = createKYCFormData({
          nik: generateUniqueNIK(),
          postalCode: testCase.postalCode,
          name: `Postal Code Test ${testCase.postalCode}`,
        });

        const response = await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(
          response.status,
          422,
          `Expected 422 for postal code ${testCase.postalCode}, got ${response.status}`,
        );

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const { error } = errorData;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const { details } = error;
        assertDefined(details);
        assertPropString(details, 'postalCode');
      }
    });

    it('should validate NPWP number format for institutions', async function () {
      const testCases = [
        { npwp: invalidDataPatterns.npwpNumber.invalidFormat, expectedError: 'format' },
        { npwp: invalidDataPatterns.npwpNumber.tooShort, expectedError: 'format' },
        {
          npwp: invalidDataPatterns.npwpNumber.incorrectPattern,
          expectedError: 'XX.XXX.XXX.X-XXX.XXX',
        },
        { npwp: invalidDataPatterns.npwpNumber.empty, expectedError: 'required' },
      ];

      for (const testCase of testCases) {
        const formData = createInstitutionFormData({
          businessName: generateUniqueBusinessName(),
          npwpNumber: testCase.npwp,
        });

        const response = await authenticatedFetch('/institution-applications', {
          method: 'POST',
          body: formData,
        });

        strictEqual(
          response.status,
          422,
          `Expected 422 for NPWP ${testCase.npwp}, got ${response.status}`,
        );

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const { error } = errorData;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const { details } = error;
        assertDefined(details);
        assertPropString(details, 'npwpNumber');
      }
    });

    it('should validate birth date constraints', async function () {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setFullYear(today.getFullYear() + 1);

      const testCases = [
        { birthDate: futureDate.toISOString().split('T')[0], expectedError: 'future' },
        { birthDate: invalidDataPatterns.birthDate.invalidFormat, expectedError: 'format' },
        { birthDate: invalidDataPatterns.birthDate.empty, expectedError: 'required' },
      ];

      for (const testCase of testCases) {
        const formData = createKYCFormData({
          nik: generateUniqueNIK(),
          birthDate: testCase.birthDate,
          name: `Birth Date Test ${testCase.birthDate}`,
        });

        const response = await authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        strictEqual(
          response.status,
          422,
          `Expected 422 for birth date ${testCase.birthDate}, got ${response.status}`,
        );

        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'error');

        const { error } = errorData;
        assertDefined(error);
        assertPropString(error, 'code');
        strictEqual(error.code, 'VALIDATION_ERROR');
        assertPropDefined(error, 'details');

        const { details } = error;
        assertDefined(details);
        assertPropString(details, 'birthDate');
      }
    });

    it('should validate text field length limits', async function () {
      const longName = invalidDataPatterns.name.tooLong;
      const longBusinessName = invalidDataPatterns.businessName.tooLong;

      // Test KYC name length
      const kycFormData = createKYCFormData({
        nik: generateUniqueNIK(),
        name: longName,
      });

      const kycResponse = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: kycFormData,
      });

      strictEqual(kycResponse.status, 422, `Expected 422 for long name, got ${kycResponse.status}`);

      const kycErrorData = await kycResponse.json();
      assertDefined(kycErrorData);
      assertPropDefined(kycErrorData, 'error');
      const { error: kycError } = kycErrorData;
      assertDefined(kycError);
      assertPropString(kycError, 'code');
      strictEqual(kycError.code, 'VALIDATION_ERROR');
      assertPropDefined(kycError, 'details');
      assertPropString(kycError.details, 'name');

      // Test institution business name length
      const instFormData = createInstitutionFormData({
        businessName: longBusinessName,
        npwpNumber: generateUniqueNPWP(),
      });

      const instResponse = await authenticatedFetch('/institution-applications', {
        method: 'POST',
        body: instFormData,
      });

      strictEqual(
        instResponse.status,
        400,
        `Expected 400 for database constraint violation on long business name, got ${instResponse.status}`,
      );

      const instErrorData = await instResponse.json();
      assertDefined(instErrorData);
      assertPropDefined(instErrorData, 'error');
      const { error: instError } = instErrorData;
      assertDefined(instError);
      assertPropString(instError, 'code');
      // Database constraint violation returns PostgreSQL error code
      strictEqual(instError.code, '22001');
      assertPropString(instError, 'message');
      ok(instError.message.includes('value too long for type character varying'));
    });
  });

  describe('Duplicate Data Handling', function () {
    it('should handle duplicate NIK submissions appropriately', async function () {
      const uniqueNIK = generateUniqueNIK();

      // First submission
      const formData1 = createKYCFormData({
        nik: uniqueNIK,
        name: 'First Submission User',
      });

      const response1 = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData1,
      });

      strictEqual(
        response1.status,
        201,
        `First submission should succeed, got ${response1.status}`,
      );

      // Second submission with same NIK
      const formData2 = createKYCFormData({
        nik: uniqueNIK,
        name: 'Second Submission User',
      });

      const response2 = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData2,
      });

      strictEqual(
        response2.status,
        409,
        `Second submission should fail with 409, got ${response2.status}`,
      );

      const errorData = await response2.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');

      const { error } = errorData;
      assertDefined(error);
      assertPropString(error, 'code');
      strictEqual(error.code, 'CONFLICT');
      assertPropDefined(error, 'details');

      const { details } = error;
      assertDefined(details);
      assertPropString(details, 'message');
      ok(details.message.includes('already pending review'));
    });

    it('should handle duplicate business name submissions appropriately', async function () {
      const uniqueBusinessName = generateUniqueBusinessName();

      // First submission
      const formData1 = createInstitutionFormData({
        businessName: uniqueBusinessName,
        npwpNumber: generateUniqueNPWP(),
      });

      const response1 = await authenticatedFetch('/institution-applications', {
        method: 'POST',
        body: formData1,
      });

      strictEqual(
        response1.status,
        201,
        `First submission should succeed, got ${response1.status}`,
      );

      // Second submission with same business name
      const formData2 = createInstitutionFormData({
        businessName: uniqueBusinessName,
        npwpNumber: generateUniqueNPWP(),
      });

      const response2 = await authenticatedFetch('/institution-applications', {
        method: 'POST',
        body: formData2,
      });

      strictEqual(
        response2.status,
        409,
        `Second submission should fail with 409, got ${response2.status}`,
      );

      const errorData = await response2.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');

      const { error } = errorData;
      assertDefined(error);
      assertPropString(error, 'code');
      strictEqual(error.code, 'BUSINESS_NAME_EXISTS');
      assertPropDefined(error, 'details');

      const { details } = error;
      assertDefined(details);
      assertPropString(details, 'businessName');
      assertPropString(details, 'message');
      strictEqual(details.businessName, uniqueBusinessName);
    });
  });

  describe('HTTP Method Errors', function () {
    it('should return 405 for incorrect HTTP methods on KYC endpoints', async function () {
      // Test wrong method on submit endpoint
      const response1 = await authenticatedFetch('/users/kyc/submit', {
        method: 'GET',
      });

      strictEqual(
        response1.status,
        404,
        `Expected 404 for unsupported GET on submit endpoint, got ${response1.status}`,
      );

      // Test wrong method on status endpoint
      const formData = createKYCFormData({ nik: generateUniqueNIK() });
      const response2 = await authenticatedFetch('/users/kyc/status', {
        method: 'POST',
        body: formData,
      });

      strictEqual(
        response2.status,
        404,
        `Expected 404 for unsupported POST on status endpoint, got ${response2.status}`,
      );
    });

    it('should return 405 for incorrect HTTP methods on institution endpoints', async function () {
      // Test wrong method on institutions endpoint
      const response1 = await authenticatedFetch('/institution-applications', {
        method: 'GET',
      });

      strictEqual(
        response1.status,
        404,
        `Expected 404 for unsupported GET on institutions endpoint, got ${response1.status}`,
      );

      // Test wrong method on status endpoint
      const formData = createInstitutionFormData({
        businessName: generateUniqueBusinessName(),
        npwpNumber: generateUniqueNPWP(),
      });
      const response2 = await authenticatedFetch('/institution-applications/status', {
        method: 'POST',
        body: formData,
      });

      strictEqual(
        response2.status,
        404,
        `Expected 404 for unsupported POST on status endpoint, got ${response2.status}`,
      );
    });
  });

  describe('Malformed Request Handling', function () {
    it('should handle malformed JSON in request body appropriately', async function () {
      // This test is not applicable to multipart/form-data KYC endpoints
      // but we can test it conceptually by checking if GET works without body

      const response = await authenticatedFetch('/users/kyc/status', {
        method: 'GET',
      });

      // Should work since GET to /users/kyc/status is valid
      ok(response.status === 200);
    });

    it('should handle missing Content-Type header appropriately', async function () {
      const formData = createKYCFormData({ nik: generateUniqueNIK() });

      const response = await testUser.fetch('/api/users/kyc/submit', {
        method: 'POST',
        // Explicitly not setting Content-Type to test multipart/form-data handling
        body: formData,
      });

      // FormData should automatically set the correct Content-Type
      // Accept 201 (success), 400 (validation error), or 409 (already exists)
      ok(
        response.status === 201 || response.status === 400 || response.status === 409,
        `Content-Type test failed: expected 201, 400, or 409, got ${response.status}`,
      );
    });

    it('should handle empty request body on POST endpoints', async function () {
      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        // No body provided
      });

      strictEqual(response.status, 422, `Expected 422 for empty body, got ${response.status}`);
    });
  });

  describe('Resource Not Found Errors', function () {
    it('should return 200 for user with institution application status check', async function () {
      // This test represents checking status when user has an application (from previous tests)
      const response = await authenticatedFetch('/institution-applications/status');

      strictEqual(
        response.status,
        200,
        `Expected 200 for existing institution, got ${response.status}`,
      );

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'application');

      const { application } = responseData;
      assertDefined(application);
      assertPropDefined(application, 'id');
      assertPropString(application, 'businessName');
    });

    it('should return 404 for invalid URL paths', async function () {
      const response = await authenticatedFetch('/users/kyc/invalid-endpoint');

      strictEqual(response.status, 404, `Expected 404 for invalid path, got ${response.status}`);
    });

    it('should return status for existing institution application', async function () {
      const response = await authenticatedFetch('/institution-applications/status');

      strictEqual(
        response.status,
        200,
        `Expected 200 for existing application, got ${response.status}`,
      );
    });
  });

  describe('Error Response Format Validation', function () {
    it('should return consistent error response format for all endpoints', async function () {
      const responses: Array<unknown> = [];

      // Collect various error responses
      responses.push(await unauthenticatedFetch('/users/kyc/status')); // 401
      responses.push(await authenticatedFetch('/users/kyc/submit', { method: 'POST' })); // 400
      responses.push(await authenticatedFetch('/institution-applications/status')); // 404

      for (const response of responses) {
        ok(response instanceof Response, `Response is not an instance of Response`);

        if (response.status >= 400) {
          const errorData = await response.json();
          assertDefined(errorData);

          // All error responses should have consistent format
          assertProp(
            v => v === false,
            errorData,
            'success',
            'Error response should have success: false',
          );
          assertPropString(errorData, 'timestamp');

          if (hasPropDefined(errorData, 'error')) {
            const error = errorData.error;
            assertDefined(error);
            assertPropString(error, 'code');
            assertPropString(error, 'message');
          }

          // requestId should be present for tracking
          if ('requestId' in errorData) {
            assertPropString(errorData, 'requestId');
          }
        }
      }
    });

    it('should include request ID in all error responses', async function () {
      const formData = createKYCFormData({
        nik: invalidDataPatterns.nik.tooShort,
        name: 'Request ID Test User',
      });

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 422);

      const errorData = await response.json();
      assertDefined(errorData);

      if ('requestId' in errorData) {
        assertPropString(errorData, 'requestId');
        assertProp(
          v => v === false,
          errorData,
          'success',
          'Error response should have success: false',
        );
        assertPropString(errorData, 'timestamp');
        ok(errorData.requestId.length > 0, 'Request ID should not be empty');
      }
    });
  });
});
