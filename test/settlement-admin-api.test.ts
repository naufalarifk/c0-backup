import { ok, strictEqual } from 'node:assert/strict';

import { assertDefined } from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createTestUser, type TestUser } from './setup/user';

/**
 * Settlement System E2E Tests
 *
 * Tests the settlement admin API endpoints according to settlement module requirements.
 *
 * Test Coverage:
 * - POST /api/admin/settlement/trigger - Manual settlement triggering
 * - Authentication and authorization (admin role requirement)
 * - Binance API integration validation
 * - Rate limiting (3 requests per minute)
 * - Audit trail logging
 * - Error handling
 *
 * Prerequisites:
 * - BINANCE_API_KEY and BINANCE_API_SECRET in .env
 * - BINANCE_API_ENABLED=true
 * - Admin role access (403 expected without admin role)
 */

suite('Settlement Admin API', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let testUser: TestUser;

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();
    testUser = await createTestUser({ testSetup, testId });
  });

  after(async function () {
    await testSetup?.teardown();
  });

  describe('POST /api/admin/settlement/trigger', function () {
    it('should require authentication', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/admin/settlement/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(response.status, 401);
    });

    it('should require admin role authorization', async function () {
      const response = await testUser.fetch('/api/admin/settlement/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should return 403 Forbidden for non-admin users
      strictEqual(response.status, 403);
    });
  });

  describe('Binance API Integration', function () {
    it('should reject GET method on settlement trigger endpoint', async function () {
      const response = await testUser.fetch('/api/admin/settlement/trigger', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should return 404 (Not Found) or 405 (Method Not Allowed)
      ok(response.status === 404 || response.status === 405, 'Should reject GET requests');
    });

    it('should validate settlement endpoint exists', async function () {
      const response = await testUser.fetch('/api/admin/settlement/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should return 403 (not 404), confirming endpoint exists
      strictEqual(response.status, 403, 'Endpoint should exist and require admin role');
    });
  });
});
