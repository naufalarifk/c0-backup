import { deepEqual, deepStrictEqual, doesNotReject, equal, ok, rejects } from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { BigNumber } from 'bignumber.js';
import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropArray,
  assertPropArrayMapOf,
  assertPropBoolean,
  assertPropDefined,
  assertPropNullableString,
  assertPropNumber,
  assertPropString,
  assertString,
  check,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it } from './setup/test';
import { createTestUser, RealtimeClient } from './setup/user';

describe('Loan Match with Realtime Events', function () {
  const testId = Date.now().toString(36).toLowerCase();
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let lender: Awaited<ReturnType<typeof createTestUser>>;
  let borrower: Awaited<ReturnType<typeof createTestUser>>;

  before(async function () {
    testSetup = await setup();
    [lender, borrower] = await Promise.all([
      createTestUser({ testSetup, testId, email: `lender_${testId}@test.com` }),
      createTestUser({ testSetup, testId, email: `borrower_${testId}@test.com` }),
    ]);
  });

  after(async function () {
    await testSetup.teardown();
  });

  it('match loan offer and loan application', async function () {
    const [lenderRealtimeClient, borrowerRealtimeClient] = await Promise.all([
      lender.connectRealtimeClient(['notification.created'], { timeout: 10000 }),
      borrower.connectRealtimeClient(['notification.created'], { timeout: 10000 }),
    ]);

    await Promise.all([
      setupLoanOffer(testSetup, lender),
      setupLoanApplication(testSetup, borrower),
      lenderRealtimeClient.waitForEvent(
        function (message) {
          assertPropString(message.data, 'type');
          return message.data.type === 'LoanOfferMatched';
        },
        { timeout: 10000 },
      ),
      borrowerRealtimeClient.waitForEvent(
        function (message) {
          assertPropString(message.data, 'type');
          return message.data.type === 'LoanApplicationMatched';
        },
        { timeout: 10000 },
      ),
    ]);

    const [lenderLoansData, borrowerLoansData] = await Promise.all([
      lender.fetch('/api/loans').then(r => r.json()),
      borrower.fetch('/api/loans').then(r => r.json()),
    ]);

    assertDefined(lenderLoansData);
    assertPropDefined(lenderLoansData, 'data');
    assertPropDefined(lenderLoansData.data, 'loans');
    assertPropArrayMapOf(lenderLoansData.data, 'loans', function (loan) {
      assertLoan(loan);
      return loan;
    });
    const lenderLoan = lenderLoansData.data.loans[0];

    assertDefined(borrowerLoansData);
    assertPropDefined(borrowerLoansData, 'data');
    assertPropArrayMapOf(borrowerLoansData.data, 'loans', function (loan) {
      assertLoan(loan);
      return loan;
    });
    const borrowerLoan = borrowerLoansData.data.loans[0];

    deepEqual(lenderLoan, borrowerLoan, 'Lender and borrower should see the same loan details');
  });
});

async function setupLoanOffer(
  testSetup: Awaited<ReturnType<typeof setup>>,
  lender: Awaited<ReturnType<typeof createTestUser>>,
) {
  const loanOfferParams = {
    principalBlockchainKey: 'cg:testnet',
    principalTokenId: 'mock:usd',
    totalAmount: '20000.000000000000000000',
    interestRate: 0.1,
    termOptions: [3, 6, 12],
    minLoanAmount: '1000.000000000000000000',
    maxLoanAmount: '20000.000000000000000000',
    expirationDate: '2025-12-31T23:59:59Z',
    creationDate: '2025-10-14T10:00:00.000Z',
  };

  const loanOfferCreationResp = await lender.fetch('/api/loan-offers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loanOfferParams),
  });

  equal(loanOfferCreationResp.status, 201);
  const loanCreationResult = await loanOfferCreationResp.json();
  assertDefined(loanCreationResult);
  assertPropBoolean(loanCreationResult, 'success');
  equal(loanCreationResult.success, true);
  assertPropDefined(loanCreationResult, 'data');
  assertPropString(loanCreationResult.data, 'id');
  assertProp(v => v === 'Draft', loanCreationResult.data, 'status');
  assertPropString(loanCreationResult.data, 'createdDate');
  assertPropDefined(loanCreationResult.data, 'fundingInvoice');
  assertPropString(loanCreationResult.data.fundingInvoice, 'id');
  assertPropString(loanCreationResult.data.fundingInvoice, 'walletAddress');

  equal(loanCreationResult.data.fundingInvoice.walletAddress.slice(0, 2), '0x');
  equal(
    loanCreationResult.data.createdDate,
    loanOfferParams.creationDate,
    'Created date should match the provided value',
  );

  const myLoanOffersResp = await lender.fetch('/api/loan-offers/my-offers');
  const myLoanOffersData = (await myLoanOffersResp.json()) as unknown;

  assertDefined(myLoanOffersData);
  assertPropBoolean(myLoanOffersData, 'success');
  assertPropDefined(myLoanOffersData, 'data');
  assertPropArrayMapOf(myLoanOffersData.data, 'offers', function (offer) {
    assertDefined(offer);
    assertPropDefined(offer, 'fundingInvoice');
    assertPropString(offer.fundingInvoice, 'id');
    assertPropString(offer.fundingInvoice, 'walletAddress');
    return {
      ...offer,
      fundingInvoice: offer.fundingInvoice,
    };
  });

  equal(myLoanOffersData.success, true);
  equal(myLoanOffersData.data.offers.length, 1);
  equal(
    myLoanOffersData.data.offers[0].fundingInvoice.id,
    loanCreationResult.data.fundingInvoice.id,
  );
  equal(
    myLoanOffersData.data.offers[0].fundingInvoice.walletAddress,
    loanCreationResult.data.fundingInvoice.walletAddress,
  );

  const walletAddress = loanCreationResult.data.fundingInvoice.walletAddress;

  const [lenderRealtimeClient, currenciesData] = await Promise.all([
    lender.connectRealtimeClient(
      ['notification.created', 'loan.status.changed', 'loan.offer.updated'],
      {
        timeout: 10000,
      },
    ),
    lender.fetch('/api/currencies?type=loan').then(r => r.json()),
  ]);

  assertDefined(currenciesData);
  assertPropDefined(currenciesData, 'data');
  assertPropArrayMapOf(currenciesData.data, 'currencies', function (currency) {
    assertDefined(currency);
    assertPropString(currency, 'blockchainKey');
    assertPropString(currency, 'tokenId');
    assertPropNumber(currency, 'decimals');
    return currency;
  });

  const principalCurrency = currenciesData.data.currencies.find(function (currency) {
    return (
      currency.blockchainKey === loanOfferParams.principalBlockchainKey &&
      currency.tokenId === loanOfferParams.principalTokenId
    );
  });

  assertDefined(principalCurrency, 'Principal currency not found in currencies list');

  await Promise.all([
    lender.fetch('/api/test/cg-testnet-blockchain-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockchainKey: 'cg:testnet',
        tokenId: 'mock:usd',
        address: walletAddress,
        amount: new BigNumber(loanOfferParams.totalAmount)
          .multipliedBy(new BigNumber(10).pow(principalCurrency.decimals))
          .toFixed(0),
        txHash: `0x${randomUUID().replace(/-/g, '')}`,
        sender: '0xLenderAddress123',
      }),
    }),
    lenderRealtimeClient.waitForEvent(
      function (message) {
        assertPropString(message.data, 'type');
        return message.data.type === 'LoanOfferPublished';
      },
      { timeout: 10000 },
    ),
  ]);

  lenderRealtimeClient.disconnect();
}

async function setupLoanApplication(
  testSetup: Awaited<ReturnType<typeof setup>>,
  borrower: Awaited<ReturnType<typeof createTestUser>>,
) {
  const loanApplicationParams = {
    collateralBlockchainKey: 'cg:testnet',
    collateralTokenId: 'mock:native',
    principalAmount: '8000.000000000000000000',
    maxInterestRate: 0.12,
    termMonths: 6,
    liquidationMode: 'Full',
    minLtvRatio: 0.6,
    creationDate: '2025-10-14T11:00:00.000Z',
  };

  const loanApplicationResp = await borrower.fetch('/api/loan-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loanApplicationParams),
  });

  equal(loanApplicationResp.status, 201);

  const loanApplicationResult = (await loanApplicationResp.json()) as unknown;
  assertDefined(loanApplicationResult);
  assertPropBoolean(loanApplicationResult, 'success');
  equal(loanApplicationResult.success, true);
  assertPropDefined(loanApplicationResult, 'data');
  assertPropString(loanApplicationResult.data, 'id');
  assertPropString(loanApplicationResult.data, 'createdDate');
  assertProp(v => v === 'Draft', loanApplicationResult.data, 'status');
  assertPropDefined(loanApplicationResult.data, 'collateralInvoice');
  assertPropString(loanApplicationResult.data.collateralInvoice, 'id');
  assertPropString(loanApplicationResult.data.collateralInvoice, 'walletAddress');

  equal(
    loanApplicationResult.data.createdDate,
    loanApplicationParams.creationDate,
    'Created date should match the provided value',
  );
  equal(loanApplicationResult.data.collateralInvoice.walletAddress.slice(0, 2), '0x');

  const myLoanApplicationsResp = await borrower.fetch('/api/loan-applications/my-applications');
  const myLoanApplicationsData = (await myLoanApplicationsResp.json()) as unknown;

  assertDefined(myLoanApplicationsData);
  assertPropBoolean(myLoanApplicationsData, 'success');
  assertPropDefined(myLoanApplicationsData, 'data');
  assertPropArrayMapOf(myLoanApplicationsData.data, 'applications', function (application) {
    assertDefined(application);
    assertPropDefined(application, 'collateralInvoice');
    assertPropString(application.collateralInvoice, 'id');
    assertPropString(application.collateralInvoice, 'walletAddress');
    return {
      ...application,
      collateralInvoice: application.collateralInvoice,
    };
  });

  equal(myLoanApplicationsData.success, true);
  equal(myLoanApplicationsData.data.applications.length, 1);
  equal(
    myLoanApplicationsData.data.applications[0].collateralInvoice.id,
    loanApplicationResult.data.collateralInvoice.id,
  );
  equal(
    myLoanApplicationsData.data.applications[0].collateralInvoice.walletAddress,
    loanApplicationResult.data.collateralInvoice.walletAddress,
  );

  const walletAddress = loanApplicationResult.data.collateralInvoice.walletAddress;

  const [borrowerRealtimeClient, currenciesData] = await Promise.all([
    borrower.connectRealtimeClient(['notification.created', 'loan.status.changed'], {
      timeout: 10000,
    }),
    borrower.fetch('/api/currencies?type=collateral').then(r => r.json()),
  ]);

  assertDefined(currenciesData);
  assertPropDefined(currenciesData, 'data');
  assertPropArrayMapOf(currenciesData.data, 'currencies', function (currency) {
    assertDefined(currency);
    assertPropString(currency, 'blockchainKey');
    assertPropString(currency, 'tokenId');
    assertPropNumber(currency, 'decimals');
    return currency;
  });

  const collateralCurrency = currenciesData.data.currencies.find(function (currency) {
    return (
      currency.blockchainKey === loanApplicationParams.collateralBlockchainKey &&
      currency.tokenId === loanApplicationParams.collateralTokenId
    );
  });

  assertDefined(collateralCurrency, 'Collateral currency not found in currencies list');

  await Promise.all([
    borrower.fetch('/api/test/cg-testnet-blockchain-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockchainKey: 'cg:testnet',
        tokenId: 'mock:native',
        address: walletAddress,
        amount: new BigNumber('1')
          .multipliedBy(new BigNumber(10).pow(collateralCurrency.decimals))
          .toFixed(0),
        txHash: `0x${randomUUID().replace(/-/g, '')}`,
        sender: '0xBorrowerAddress123',
      }),
    }),
    borrowerRealtimeClient.waitForEvent(
      function (message) {
        assertPropString(message.data, 'type');
        return message.data.type === 'LoanApplicationPublished';
      },
      { timeout: 10000 },
    ),
  ]);

  borrowerRealtimeClient.disconnect();
}

function assertLoan(loan: unknown) {
  assertDefined(loan);
  assertPropString(loan, 'id');
  assertPropString(loan, 'lenderId');
  assertPropString(loan, 'loanOfferId');
  assertPropDefined(loan, 'principalCurrency');
  assertPropString(loan.principalCurrency, 'blockchainKey');
  assertPropString(loan.principalCurrency, 'tokenId');
  assertPropString(loan.principalCurrency, 'symbol');
  assertPropString(loan.principalCurrency, 'name');
  assertPropNumber(loan.principalCurrency, 'decimals');
  assertPropString(loan.principalCurrency, 'logoUrl');
  assertPropString(loan, 'principalAmount');
  assertPropDefined(loan, 'collateralCurrency');
  assertPropString(loan.collateralCurrency, 'blockchainKey');
  assertPropString(loan.collateralCurrency, 'tokenId');
  assertPropString(loan.collateralCurrency, 'symbol');
  assertPropString(loan.collateralCurrency, 'name');
  assertPropNumber(loan.collateralCurrency, 'decimals');
  assertPropString(loan.collateralCurrency, 'logoUrl');
  assertPropString(loan, 'collateralAmount');
  assertPropNumber(loan, 'termMonths');
  assertPropNumber(loan, 'currentLtv');
  assertPropNumber(loan, 'maxLtvRatio');
  assertPropString(loan, 'status');
  assertPropString(loan, 'originationDate');
  assertPropString(loan, 'disbursementDate');
  assertPropString(loan, 'maturityDate');
  assertPropString(loan, 'borrowerNumber');
  assertPropDefined(loan, 'loanBreakdown');
  assertPropString(loan.loanBreakdown, 'principalAmount');
  assertPropString(loan.loanBreakdown, 'interestAmount');
  assertPropString(loan.loanBreakdown, 'originationFeeAmount');
  assertPropString(loan.loanBreakdown, 'totalRepaymentAmount');
  return loan;
}
