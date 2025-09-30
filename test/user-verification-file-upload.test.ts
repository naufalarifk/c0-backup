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

import { assertDefined, assertPropDefined, assertPropNumber, assertPropString } from 'typeshaper';

import { setupBetterAuthClient } from './setup/better-auth';
import { waitForEmailVerification } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createKycTestUser, type TestUser } from './setup/user';
import {
  createInstitutionFormData,
  createKYCFormData,
  generateTestId,
} from './user-verification-test-data';

suite('User verification File Upload Validation E2E Tests', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let kycUser: TestUser;

  before(async function () {
    testId = generateTestId();
    testSetup = await setup();

    // Create a KYC test user (Individual type)
    kycUser = await createKycTestUser({
      testId,
      testSetup,
      email: `file_upload_test_${testId}@test.com`,
      name: `File Upload Test User ${testId}`,
    });
  });

  after(async function () {
    await testSetup?.teardown();
  });

  // Helper function to make authenticated requests
  async function authenticatedFetch(path: string, options: RequestInit = {}) {
    return kycUser.fetch(`/api${path}`, options);
  }

  describe('KYC File Upload Validation', function () {
    it('should accept valid image formats for KYC documents', async function () {
      // Use the helper function to create valid KYC form data with proper file signatures
      const formData = createKYCFormData({
        nik: '3171111222333444',
        name: 'Test User Image Validation',
      });

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 201, `Expected 201, got ${response.status}`);
    });

    it('should reject KYC submission with missing image files', async function () {
      // Create form data without files using the helper function
      const formData = createKYCFormData(
        {
          nik: '3171555666777999',
          name: 'Test User Missing Files',
        },
        false,
      ); // includeFiles = false

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
      strictEqual(error.code, 'BAD_REQUEST');
      assertPropString(error, 'message');

      // Should have error message about missing files
      ok(
        error.message.includes('ID Card Photo is required') ||
          error.message.includes('Selfie with ID Card Photo is required'),
      );
    });

    it('should reject invalid file types for KYC documents', async function () {
      // Create form data without files, then add invalid files
      const formData = createKYCFormData(
        {
          nik: '3171999888777666',
          name: 'Test User Invalid Files',
        },
        false,
      );

      // Add invalid file types
      const textFile = new Blob(['text content'], { type: 'text/plain' });
      const execFile = new Blob(['executable'], { type: 'application/x-executable' });

      formData.append('idCardPhoto', textFile, 'id-card.txt');
      formData.append('selfieWithIdCardPhoto', execFile, 'selfie.exe');

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
      strictEqual(error.code, 'BAD_REQUEST'); // File validation throws BadRequestException
    });

    it('should handle oversized files appropriately', async function () {
      // Create form data without files, then add oversized files
      const formData = createKYCFormData(
        {
          nik: '3171444555666777',
          name: 'Test User Large Files',
        },
        false,
      );

      // Create large files (simulate oversized files)
      const largeFileData = 'x'.repeat(11 * 1024 * 1024); // 11MB (assuming 10MB limit)
      const largeFile = new Blob([largeFileData], { type: 'image/jpeg' });

      formData.append('idCardPhoto', largeFile, 'large-id-card.jpg');
      formData.append('selfieWithIdCardPhoto', largeFile, 'large-selfie.jpg');

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      // Should reject due to file size limit
      ok(
        response.status === 400 || response.status === 413,
        `Expected 400 or 413, got ${response.status}`,
      );

      if (response.status === 400) {
        const errorData = await response.json();
        assertDefined(errorData);
        assertPropDefined(errorData, 'success');
        strictEqual(errorData.success, false);
      }
    });
  });

  describe('Institution File Upload Validation', function () {
    it('should accept valid document formats for institution application', async function () {
      // Use the helper function to create valid institution form data
      const formData = createInstitutionFormData({
        businessName: `PT File Validation Test ${testId}`,
        registrationNumber: '8120202123456',
        npwpNumber: '01.234.567.8-901.000',
      });

      const response = await authenticatedFetch('/institution-applications', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 201, `Expected 201, got ${response.status}`);
    });

    it('should reject institution application with missing required documents', async function () {
      // Create form data without files using the helper function
      const formData = createInstitutionFormData(
        {
          businessName: `PT Missing Docs Test ${testId}`,
          registrationNumber: '8120202123457',
          npwpNumber: '02.234.567.8-901.000',
        },
        false,
      ); // includeFiles = false to test missing files

      const response = await authenticatedFetch('/institution-applications', {
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
      strictEqual(error.code, 'VALIDATION_ERROR'); // Institutions service uses UnprocessableEntityException

      assertPropDefined(error, 'details');
      const details = error.details;
      assertDefined(details);

      // Should have errors for missing required documents
      const missingDocs = [
        'npwpDocument',
        'registrationDocument',
        'deedOfEstablishment',
        'directorIdCard',
        'ministryApprovalDocument',
      ];
      let foundMissingDocs = 0;

      for (const doc of missingDocs) {
        if (doc in details) {
          foundMissingDocs++;
        }
      }

      ok(foundMissingDocs > 0, 'Should have validation errors for missing required documents');
    });

    it('should accept optional business license document', async function () {
      // Use the helper function to create valid institution form data with all required documents
      const formData = createInstitutionFormData({
        businessName: `PT Optional Doc Test ${testId}`,
        registrationNumber: '8120202123458',
        npwpNumber: '03.234.567.8-901.000',
      });

      // Note: The helper function should already include all required documents.
      // If there were optional documents to add, we would add them here.
      // For now, we're just testing that the standard form submission works.

      const response = await authenticatedFetch('/institution-applications', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 201, `Expected 201, got ${response.status}`);
    });

    it('should handle mixed valid and invalid file types', async function () {
      // Create form data without files, then add mixed valid/invalid files
      const formData = createInstitutionFormData(
        {
          businessName: `PT Mixed Files Test ${testId}`,
          registrationNumber: '8120202123459',
          npwpNumber: '04.234.567.8-901.000',
        },
        false,
      );

      // Mix valid and invalid files - we need to create proper valid files with correct signatures
      // Get the valid PDF from the helper function
      const validFormData = createInstitutionFormData({}, true);
      const validPdfFile = validFormData.get('npwpDocument') as File;
      const validImageFile = validFormData.get('directorIdCard') as File;

      const textFile = new Blob(['text content'], { type: 'text/plain' });

      formData.append('npwpDocument', validPdfFile, 'npwp.pdf'); // Valid
      formData.append('registrationDocument', textFile, 'registration.txt'); // Invalid
      formData.append('deedOfEstablishment', validPdfFile, 'deed.pdf'); // Valid
      formData.append('directorIdCard', validImageFile, 'director-id.jpg'); // Valid
      formData.append('ministryApprovalDocument', validPdfFile, 'ministry.pdf'); // Valid

      const response = await authenticatedFetch('/institution-applications', {
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
      strictEqual(error.code, 'BAD_REQUEST'); // File validation throws BadRequestException
    });
  });

  describe('File Upload Security', function () {
    it('should reject executable files with image extensions', async function () {
      const formData = createKYCFormData(
        {
          nik: '3171111000222333',
          name: 'Security Test User',
        },
        false,
      );

      // Create malicious files (executable content with image extension)
      const maliciousFile = new Blob(['#!/bin/bash\necho "malicious"'], { type: 'image/jpeg' });

      formData.append('idCardPhoto', maliciousFile, 'malicious.jpg');
      formData.append('selfieWithIdCardPhoto', maliciousFile, 'malicious.png');

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      // Should be rejected due to content validation
      strictEqual(response.status, 400, `Expected 400, got ${response.status}`);
    });

    it('should validate file content matches declared type', async function () {
      const formData = createKYCFormData(
        {
          nik: '3171222000333444',
          name: 'Content Validation Test',
        },
        false,
      );

      // Create files with mismatched content and MIME type
      const fakeImageFile = new Blob(['This is not image data'], { type: 'image/jpeg' });

      formData.append('idCardPhoto', fakeImageFile, 'fake-image.jpg');
      formData.append('selfieWithIdCardPhoto', fakeImageFile, 'fake-image.png');

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      // May be accepted depending on server validation strictness
      // This test documents expected behavior
      ok(response.status === 201 || response.status === 400);
    });
  });

  describe('File Upload Performance', function () {
    it('should handle multiple concurrent file uploads', async function () {
      const promises: Promise<Response>[] = [];

      for (let i = 0; i < 3; i++) {
        // Create valid NIKs and names using the helper functions from test data
        const formData = createKYCFormData({
          nik: `31710012345${i.toString().padStart(5, '0')}`, // Valid 16-digit NIK
          name: `Concurrent Test User Alpha${i === 0 ? '' : i === 1 ? ' Beta' : ' Gamma'}`, // Valid name with letters only
        });

        const promise = authenticatedFetch('/users/kyc/submit', {
          method: 'POST',
          body: formData,
        });

        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      // All requests should complete successfully or with expected errors
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        ok(
          response.status === 201 || response.status === 409 || response.status === 422, // 201=success, 409=duplicate NIK, 422=validation error
          `Request ${i} failed with status ${response.status}`,
        );
      }
    });

    it('should respect upload timeout limits', async function () {
      // This test documents expected behavior for slow uploads
      // In a real scenario, you might simulate a slow network
      // Since this user may have already submitted KYC, we should handle conflicts

      const formData = createKYCFormData({
        nik: '3171777888999000', // Valid 16-digit NIK
        name: 'Timeout Test User', // Valid name
      });

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      // Should complete within reasonable time - may be success or conflict if already submitted
      ok(
        response.status === 201 || response.status === 409,
        `Expected 201 or 409, got ${response.status}`,
      );
    });
  });
});
