import { strictEqual } from 'node:assert';

import {
  assertArray,
  assertDefined,
  assertPropArrayMapOf,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it } from './setup/test';
import { createTestUser, type TestUser } from './setup/user';

describe('Admin - Wallet Management', function () {
  const testId = Date.now().toString(36).toLowerCase();
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let adminUser: TestUser;
  let regularUser: TestUser;

  before(async function () {
    testSetup = await setup();
    [adminUser, regularUser] = await Promise.all([
      createTestUser({ testId, testSetup, email: 'admin-wallet@test.com', role: 'admin' }),
      createTestUser({ testId, testSetup, email: 'regular-wallet@test.com' }),
    ]);
  });

  after(async function () {
    await testSetup.teardown();
  });

  it('GET /api/admin/wallets - should list all active wallets', async function () {
    const response = await adminUser.fetch('/api/admin/wallets');

    strictEqual(response.status, 200, 'Admin should be able to fetch wallet list');

    const responseData = await response.json();
    assertDefined(responseData);
    assertPropDefined(responseData, 'success');
    assertPropDefined(responseData, 'data');

    const data = responseData.data;
    assertDefined(data);

    // Validate hotWallets
    assertPropDefined(data, 'hotWallets');
    assertArray(data.hotWallets);
    assertPropArrayMapOf(data, 'hotWallets', function (wallet) {
      assertDefined(wallet);
      assertPropString(wallet, 'blockchainKey');
      assertPropDefined(wallet, 'blockchain');
      const blockchain = wallet.blockchain;
      assertPropString(blockchain, 'name');
      assertPropString(blockchain, 'shortName');
      assertPropString(blockchain, 'image');
      assertPropString(wallet, 'address');
      assertPropString(wallet, 'derivationPath');
      assertPropString(wallet, 'type');
      strictEqual(wallet.type, 'hot_wallet', 'Hot wallet type should be hot_wallet');
      return wallet;
    });

    // Validate invoiceWallets
    assertPropDefined(data, 'invoiceWallets');
    assertArray(data.invoiceWallets);
    // Invoice wallets might be empty if no active invoices exist
    if (data.invoiceWallets.length > 0) {
      assertPropArrayMapOf(data, 'invoiceWallets', function (wallet) {
        assertDefined(wallet);
        assertPropString(wallet, 'blockchainKey');
        assertPropDefined(wallet, 'blockchain');
        const blockchain = wallet.blockchain;
        assertPropString(blockchain, 'name');
        assertPropString(blockchain, 'shortName');
        assertPropString(blockchain, 'image');
        assertPropDefined(wallet, 'currency');
        const currency = wallet.currency;
        assertPropString(currency, 'tokenId');
        assertPropString(currency, 'name');
        assertPropString(currency, 'symbol');
        assertPropNumber(currency, 'decimals');
        assertPropString(currency, 'image');
        assertPropString(wallet, 'address');
        assertPropString(wallet, 'derivationPath');
        assertPropNumber(wallet, 'invoiceId');
        assertPropString(wallet, 'type');
        strictEqual(wallet.type, 'invoice_wallet', 'Invoice wallet type should be invoice_wallet');
        return wallet;
      });
    }

    // Validate statistics
    assertPropDefined(data, 'statistics');
    const statistics = data.statistics;
    assertDefined(statistics);
    assertPropNumber(statistics, 'totalHotWallets');
    assertPropNumber(statistics, 'totalInvoiceWallets');
    assertPropDefined(statistics, 'blockchainDistribution');

    // Verify statistics match data
    strictEqual(
      statistics.totalHotWallets,
      data.hotWallets.length,
      'Total hot wallets should match array length',
    );
    strictEqual(
      statistics.totalInvoiceWallets,
      data.invoiceWallets.length,
      'Total invoice wallets should match array length',
    );

    // Verify blockchain distribution is an object with numeric values
    const distribution = statistics.blockchainDistribution;
    assertDefined(distribution);
    for (const [blockchain, count] of Object.entries(distribution)) {
      strictEqual(
        typeof count,
        'number',
        `Blockchain distribution count for ${blockchain} should be a number`,
      );
    }
  });

  it('GET /api/admin/wallets - should reject non-admin access', async function () {
    const response = await regularUser.fetch('/api/admin/wallets');

    strictEqual(
      response.status,
      403,
      'Non-admin user should be forbidden from accessing wallet list',
    );

    const errorData = await response.json();
    assertDefined(errorData);
    assertPropDefined(errorData, 'error');
  });
});
