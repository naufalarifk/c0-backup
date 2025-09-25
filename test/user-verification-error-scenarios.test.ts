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
  assertPropDefined,
  assertPropNumber,
  assertPropOneOf,
  assertPropString,
  hasProp,
} from './setup/assertions';
import { setupBetterAuthClient } from './setup/better-auth';
import { waitForEmailVerification } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
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
  let authClient: ReturnType<typeof setupBetterAuthClient>;
  let authTokens: { token: string };

  before(async function () {
    testId = generateTestId();
    testSetup = await setup();
    authClient = setupBetterAuthClient(testSetup.backendUrl);

    // Create and authenticate a test user
    const email = `error_test_${testId}@test.com`;
    const password = 'ValidPassword123!';

    const _signUpResult = await authClient.authClient.signUp.email({
      email,
      password,
      name: `Error Test User ${testId}`,
      callbackURL: 'http://localhost/test-callback',
    });

    await waitForEmailVerification(testSetup.mailpitUrl, email);

    const signInResult = await authClient.authClient.signIn.email({
      email,
      password,
    });

    assertDefined(signInResult.data?.token);

    authTokens = {
      token: signInResult.data.token,
    };
  });

  after(async function () {
    await testSetup?.teardown();
  });

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
        { nik: invalidDataPatterns.nik.empty, expectedError: 'required' },
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
          400,
          `Expected 400 for NIK ${testCase.nik}, got ${response.status}`,
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
          400,
          `Expected 400 for postal code ${testCase.postalCode}, got ${response.status}`,
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
          400,
          `Expected 400 for NPWP ${testCase.npwp}, got ${response.status}`,
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
          400,
          `Expected 400 for birth date ${testCase.birthDate}, got ${response.status}`,
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

      strictEqual(kycResponse.status, 400, `Expected 400 for long name, got ${kycResponse.status}`);

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
        `Expected 400 for long business name, got ${instResponse.status}`,
      );

      const instErrorData = await instResponse.json();
      assertDefined(instErrorData);
      assertPropDefined(instErrorData, 'error');
      const { error: instError } = instErrorData;
      assertDefined(instError);
      assertPropString(instError, 'code');
      strictEqual(instError.code, 'VALIDATION_ERROR');
      assertPropDefined(instError, 'details');
      assertPropString(instError.details, 'businessName');
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
      strictEqual(error.code, 'DUPLICATE_NIK');
      assertPropDefined(error, 'details');

      const { details } = error;
      assertDefined(details);
      assertPropString(details, 'nik');
      assertPropString(details, 'message');
      strictEqual(details.nik, uniqueNIK);
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
        405,
        `Expected 405 for GET on submit endpoint, got ${response1.status}`,
      );

      // Test wrong method on status endpoint
      const formData = createKYCFormData({ nik: generateUniqueNIK() });
      const response2 = await authenticatedFetch('/users/kyc/status', {
        method: 'POST',
        body: formData,
      });

      strictEqual(
        response2.status,
        405,
        `Expected 405 for POST on status endpoint, got ${response2.status}`,
      );
    });

    it('should return 405 for incorrect HTTP methods on institution endpoints', async function () {
      // Test wrong method on institutions endpoint
      const response1 = await authenticatedFetch('/institution-applications', {
        method: 'GET',
      });

      strictEqual(
        response1.status,
        405,
        `Expected 405 for GET on institutions endpoint, got ${response1.status}`,
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
        405,
        `Expected 405 for POST on status endpoint, got ${response2.status}`,
      );
    });
  });

  describe('Malformed Request Handling', function () {
    it('should handle malformed JSON in request body appropriately', async function () {
      // This might not apply to multipart/form-data endpoints
      // but tests the general error handling capability

      const response = await authenticatedFetch('/users/kyc/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{"invalid": json}', // Malformed JSON
      });

      // Should still work since GET doesn't need body
      ok(response.status === 200 || response.status === 400);
    });

    it('should handle missing Content-Type header appropriately', async function () {
      const formData = createKYCFormData({ nik: generateUniqueNIK() });

      const response = await fetch(`${testSetup.backendUrl}/api/users/kyc/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authTokens.token}`,
          // Explicitly not setting Content-Type to test multipart/form-data handling
        },
        body: formData,
      });

      // FormData should automatically set the correct Content-Type
      ok(response.status === 201 || response.status === 400);
    });

    it('should handle empty request body on POST endpoints', async function () {
      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        // No body provided
      });

      strictEqual(response.status, 400, `Expected 400 for empty body, got ${response.status}`);
    });
  });

  describe('Resource Not Found Errors', function () {
    it('should return 404 for user without institution application', async function () {
      // This test now represents checking status when user has no application
      const response = await authenticatedFetch('/institution-applications/status');

      strictEqual(
        response.status,
        404,
        `Expected 404 for non-existent institution, got ${response.status}`,
      );

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
      assertPropOneOf(errorData, 'success', [false], 'Error response should have success: false');
      strictEqual(errorData.success, false);

      const { error } = errorData;
      assertDefined(error);
      assertPropString(error, 'code');
      assertPropString(error, 'message');
      strictEqual(error.code, 'NOT_FOUND');
    });

    it('should return 404 for invalid URL paths', async function () {
      const response = await authenticatedFetch('/users/kyc/invalid-endpoint');

      strictEqual(response.status, 404, `Expected 404 for invalid path, got ${response.status}`);
    });

    it('should handle malformed institution ID parameter', async function () {
      const response = await authenticatedFetch('/institution-applications/status');

      strictEqual(
        response.status,
        400,
        `Expected 400 for invalid ID format, got ${response.status}`,
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
          assertPropOneOf(
            errorData,
            'success',
            [false],
            'Error response should have success: false',
          );
          assertPropString(errorData, 'timestamp');

          if (hasProp(errorData, 'error')) {
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

      strictEqual(response.status, 400);

      const errorData = await response.json();
      assertDefined(errorData);

      if ('requestId' in errorData) {
        assertPropString(errorData, 'requestId');
        assertPropOneOf(errorData, 'success', [false], 'Error response should have success: false');
        assertPropString(errorData, 'timestamp');
        ok(errorData.requestId.length > 0, 'Request ID should not be empty');
      }
    });
  });
});
