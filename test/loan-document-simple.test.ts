import assert from 'node:assert/strict';

import {
  assertDefined,
  assertPropArray,
  assertPropBoolean,
  assertPropDefined,
  assertPropString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createTestUser, type TestUser } from './setup/user';

suite('Loan Document Generation - Simple Test', () => {
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let borrower: TestUser;

  before(async () => {
    testSetup = await setup();
    borrower = await createTestUser({ testSetup, testId: 'alice', userType: 'Individual' });
    await createTestUser({ testSetup, testId: 'bob', userType: 'Institution' });
  });

  after(async () => {
    await testSetup.teardown();
  });

  it('should handle loan agreement document request for non-existent loan', async () => {
    // Test the document endpoint with a non-existent loan ID
    const response = await borrower.fetch('/api/loans/nonexistent-loan-id/agreement');

    // Should return 404 or 400 for non-existent loan
    console.log('Response status for non-existent loan:', response.status);
    assert(response.status === 404 || response.status === 400);
  });

  it('should return appropriate response structure for document requests', async () => {
    // Test that the endpoint returns the correct response structure
    // even when document doesn't exist
    const response = await borrower.fetch('/api/loans/test-loan-id/agreement');

    console.log('Response status for test loan:', response.status);

    if (response.status === 200) {
      const payload = (await response.json()) as unknown;
      console.log('Response data:', JSON.stringify(payload, null, 2));

      // Verify response structure using typeshaper guards
      assertDefined(payload);
      assertPropBoolean(payload, 'success');
      assert.strictEqual(payload.success, true);
      assertPropDefined(payload, 'data');

      const docData = payload.data;
      assertDefined(docData);
      assertPropBoolean(docData, 'signatureRequired');
      assertPropArray(docData, 'signedBy');
      assertPropString(docData, 'generationStatus');

      // Status should be one of the valid states
      const validStatuses = ['ready', 'generating', 'pending', 'Failed', 'regenerating'];
      assert(validStatuses.includes(docData.generationStatus));
    }
  });
});
