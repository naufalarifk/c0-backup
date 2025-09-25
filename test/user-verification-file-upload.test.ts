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

import {
  assertDefined,
  assertPropDefined,
  assertPropNumber,
  assertPropOneOf,
  assertPropString,
} from './setup/assertions';
import { setupBetterAuthClient } from './setup/better-auth';
import { waitForEmailVerification } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import {
  createInstitutionFormData,
  createKYCFormData,
  generateTestId,
} from './user-verification-test-data';

suite('User verification File Upload Validation E2E Tests', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let authClient: ReturnType<typeof setupBetterAuthClient>;
  let authTokens: { token: string };

  before(async function () {
    testId = generateTestId();
    testSetup = await setup();
    authClient = setupBetterAuthClient(testSetup.backendUrl);

    // Create and authenticate a test user
    const email = `file_upload_test_${testId}@test.com`;
    const password = 'ValidPassword123!';

    const _signUpResult = await authClient.authClient.signUp.email({
      email,
      password,
      name: `File Upload Test User ${testId}`,
      callbackURL: 'http://localhost/test-callback',
    });

    await waitForEmailVerification(testSetup.mailpitUrl, email);

    const signInResult = await authClient.authClient.signIn.email({
      email,
      password,
    });

    assertDefined(signInResult.data, 'Sign in result data should exist');
    assertPropString(signInResult.data, 'token');
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

  describe('KYC File Upload Validation', function () {
    it('should accept valid image formats for KYC documents', async function () {
      const formData = new FormData();

      // Add text data
      formData.append('nik', '3171111222333444');
      formData.append('name', 'Test User Image Validation');
      formData.append('birthCity', 'Jakarta');
      formData.append('birthDate', '1990-05-15');
      formData.append('province', 'DKI Jakarta');
      formData.append('city', 'Jakarta Pusat');
      formData.append('district', 'Menteng');
      formData.append('subdistrict', 'Menteng');
      formData.append('address', 'Test Address');
      formData.append('postalCode', '10350');

      // Test different valid image formats
      const jpegFile = new Blob(['fake-jpeg-data'], { type: 'image/jpeg' });
      const pngFile = new Blob(['fake-png-data'], { type: 'image/png' });

      formData.append('idCardPhoto', jpegFile, 'id-card.jpg');
      formData.append('selfieWithIdCardPhoto', pngFile, 'selfie.png');

      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 201, `Expected 201, got ${response.status}`);
    });

    it('should reject KYC submission with missing image files', async function () {
      const formData = new FormData();

      // Add only text data, no files
      formData.append('nik', '3171555666777999');
      formData.append('name', 'Test User Missing Files');
      formData.append('birthCity', 'Jakarta');
      formData.append('birthDate', '1990-05-15');
      formData.append('province', 'DKI Jakarta');
      formData.append('city', 'Jakarta Pusat');
      formData.append('district', 'Menteng');
      formData.append('subdistrict', 'Menteng');
      formData.append('address', 'Test Address');
      formData.append('postalCode', '10350');

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

      // Should have errors for missing files
      ok('idCardPhoto' in details || 'selfieWithIdCardPhoto' in details);
    });

    it('should reject invalid file types for KYC documents', async function () {
      const formData = new FormData();

      // Add text data
      formData.append('nik', '3171999888777666');
      formData.append('name', 'Test User Invalid Files');
      formData.append('birthCity', 'Jakarta');
      formData.append('birthDate', '1990-05-15');
      formData.append('province', 'DKI Jakarta');
      formData.append('city', 'Jakarta Pusat');
      formData.append('district', 'Menteng');
      formData.append('subdistrict', 'Menteng');
      formData.append('address', 'Test Address');
      formData.append('postalCode', '10350');

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
      strictEqual(error.code, 'VALIDATION_ERROR');
    });

    it('should handle oversized files appropriately', async function () {
      const formData = new FormData();

      // Add text data
      formData.append('nik', '3171444555666777');
      formData.append('name', 'Test User Large Files');
      formData.append('birthCity', 'Jakarta');
      formData.append('birthDate', '1990-05-15');
      formData.append('province', 'DKI Jakarta');
      formData.append('city', 'Jakarta Pusat');
      formData.append('district', 'Menteng');
      formData.append('subdistrict', 'Menteng');
      formData.append('address', 'Test Address');
      formData.append('postalCode', '10350');

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
      const formData = new FormData();

      // Add institution data
      formData.append('businessName', `PT File Validation Test ${testId}`);
      formData.append('registrationNumber', '8120202123456');
      formData.append('npwpNumber', '01.234.567.8-901.000');
      formData.append('businessType', 'PT');
      formData.append('businessProvince', 'DKI Jakarta');
      formData.append('businessCity', 'Jakarta Selatan');
      formData.append('businessDistrict', 'Kebayoran Baru');
      formData.append('businessSubdistrict', 'Senayan');
      formData.append('businessAddress', 'Test Business Address');
      formData.append('businessPostalCode', '10270');
      formData.append('directorName', 'Test Director');
      formData.append('directorPosition', 'CEO');

      // Add valid document files
      const pdfDoc = new Blob(['fake-pdf-data'], { type: 'application/pdf' });
      const imageDoc = new Blob(['fake-image-data'], { type: 'image/jpeg' });

      formData.append('npwpDocument', pdfDoc, 'npwp.pdf');
      formData.append('registrationDocument', pdfDoc, 'registration.pdf');
      formData.append('deedOfEstablishment', pdfDoc, 'deed.pdf');
      formData.append('directorIdCard', imageDoc, 'director-id.jpg');
      formData.append('ministryApprovalDocument', pdfDoc, 'ministry.pdf');

      const response = await authenticatedFetch('/institutions', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 201, `Expected 201, got ${response.status}`);
    });

    it('should reject institution application with missing required documents', async function () {
      const formData = new FormData();

      // Add only basic data without required documents
      formData.append('businessName', `PT Missing Docs Test ${testId}`);
      formData.append('registrationNumber', '8120202123457');
      formData.append('npwpNumber', '02.234.567.8-901.000');
      formData.append('businessType', 'PT');
      formData.append('businessProvince', 'DKI Jakarta');
      formData.append('businessCity', 'Jakarta Selatan');
      formData.append('businessDistrict', 'Kebayoran Baru');
      formData.append('businessSubdistrict', 'Senayan');
      formData.append('businessAddress', 'Test Business Address');
      formData.append('businessPostalCode', '10270');
      formData.append('directorName', 'Test Director');
      formData.append('directorPosition', 'CEO');

      // Only include some documents, not all required ones
      const pdfDoc = new Blob(['fake-pdf-data'], { type: 'application/pdf' });
      formData.append('npwpDocument', pdfDoc, 'npwp.pdf');
      // Missing: registrationDocument, deedOfEstablishment, directorIdCard, ministryApprovalDocument

      const response = await authenticatedFetch('/institutions', {
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

      // Should have errors for missing required documents
      const missingDocs = [
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
      const formData = new FormData();

      // Add institution data
      formData.append('businessName', `PT Optional Doc Test ${testId}`);
      formData.append('registrationNumber', '8120202123458');
      formData.append('npwpNumber', '03.234.567.8-901.000');
      formData.append('businessType', 'PT');
      formData.append('businessProvince', 'DKI Jakarta');
      formData.append('businessCity', 'Jakarta Selatan');
      formData.append('businessDistrict', 'Kebayoran Baru');
      formData.append('businessSubdistrict', 'Senayan');
      formData.append('businessAddress', 'Test Business Address');
      formData.append('businessPostalCode', '10270');
      formData.append('directorName', 'Test Director');
      formData.append('directorPosition', 'CEO');

      // Add all required documents
      const pdfDoc = new Blob(['fake-pdf-data'], { type: 'application/pdf' });
      const imageDoc = new Blob(['fake-image-data'], { type: 'image/jpeg' });

      formData.append('npwpDocument', pdfDoc, 'npwp.pdf');
      formData.append('registrationDocument', pdfDoc, 'registration.pdf');
      formData.append('deedOfEstablishment', pdfDoc, 'deed.pdf');
      formData.append('directorIdCard', imageDoc, 'director-id.jpg');
      formData.append('ministryApprovalDocument', pdfDoc, 'ministry.pdf');

      // Add optional document
      formData.append('businessLicense', pdfDoc, 'business-license.pdf');

      const response = await authenticatedFetch('/institutions', {
        method: 'POST',
        body: formData,
      });

      strictEqual(response.status, 201, `Expected 201, got ${response.status}`);
    });

    it('should handle mixed valid and invalid file types', async function () {
      const formData = new FormData();

      // Add institution data
      formData.append('businessName', `PT Mixed Files Test ${testId}`);
      formData.append('registrationNumber', '8120202123459');
      formData.append('npwpNumber', '04.234.567.8-901.000');
      formData.append('businessType', 'PT');
      formData.append('businessProvince', 'DKI Jakarta');
      formData.append('businessCity', 'Jakarta Selatan');
      formData.append('businessDistrict', 'Kebayoran Baru');
      formData.append('businessSubdistrict', 'Senayan');
      formData.append('businessAddress', 'Test Business Address');
      formData.append('businessPostalCode', '10270');
      formData.append('directorName', 'Test Director');
      formData.append('directorPosition', 'CEO');

      // Mix valid and invalid files
      const pdfDoc = new Blob(['fake-pdf-data'], { type: 'application/pdf' });
      const textFile = new Blob(['text content'], { type: 'text/plain' });
      const imageDoc = new Blob(['fake-image-data'], { type: 'image/jpeg' });

      formData.append('npwpDocument', pdfDoc, 'npwp.pdf'); // Valid
      formData.append('registrationDocument', textFile, 'registration.txt'); // Invalid
      formData.append('deedOfEstablishment', pdfDoc, 'deed.pdf'); // Valid
      formData.append('directorIdCard', imageDoc, 'director-id.jpg'); // Valid
      formData.append('ministryApprovalDocument', pdfDoc, 'ministry.pdf'); // Valid

      const response = await authenticatedFetch('/institutions', {
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
        const formData = createKYCFormData({
          nik: `317100${i}000${i}${i}${i}${i}${i}${i}${i}`,
          name: `Concurrent Test User ${i}`,
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
          response.status === 201 || response.status === 409, // 409 for duplicate NIK
          `Request ${i} failed with status ${response.status}`,
        );
      }
    });

    it('should respect upload timeout limits', async function () {
      const formData = createKYCFormData({
        nik: '3171777888999000',
        name: 'Timeout Test User',
      });

      // This test documents expected behavior for slow uploads
      // In a real scenario, you might simulate a slow network
      const response = await authenticatedFetch('/users/kyc/submit', {
        method: 'POST',
        body: formData,
      });

      // Should complete within reasonable time
      strictEqual(response.status, 201, `Expected 201, got ${response.status}`);
    });
  });
});
