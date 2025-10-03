import { deepStrictEqual, doesNotReject, ok, rejects, strictEqual } from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

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
  check,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';
import { WebSocket } from 'ws';

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createTestUser } from './setup/user';

/**
 * Helper function to establish a WebSocket connection and authenticate
 */
async function connectWebSocket(params: {
  backendUrl: string;
  accessToken: string;
  eventTypes: string[];
}): Promise<{
  ws: WebSocket;
  messages: Array<{ event: string; data: unknown }>;
  waitForEvent: (
    eventName: string,
    timeoutMs?: number,
  ) => Promise<{ event: string; data: unknown }>;
  close: () => void;
}> {
  const wsUrl = params.backendUrl.replace(/^http/, 'ws');
  const ws = new WebSocket(`${wsUrl}/api/realtime`);
  const messages: Array<{ event: string; data: unknown }> = [];
  const eventPromises = new Map<string, Array<(msg: { event: string; data: unknown }) => void>>();

  // Wait for WebSocket connection to open
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    ws.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  // Set up message handler
  ws.on('message', rawData => {
    try {
      const parsed: unknown = JSON.parse(rawData.toString());
      assertDefined(parsed);
      assertPropString(parsed, 'event');
      assertPropDefined(parsed, 'data');

      const message = {
        event: parsed.event,
        data: parsed.data,
      };

      messages.push(message);

      // Resolve any waiting promises for this event
      const waiters = eventPromises.get(message.event);
      if (waiters && waiters.length > 0) {
        const waiter = waiters.shift();
        if (waiter) {
          waiter(message);
        }
        if (waiters.length === 0) {
          eventPromises.delete(message.event);
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  });

  // Send auth message
  ws.send(
    JSON.stringify({
      event: 'auth',
      data: {
        accessToken: params.accessToken,
        events: params.eventTypes,
      },
    }),
  );

  // Wait for auth confirmation
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket authentication timeout'));
    }, 5000);

    const messageHandler = (rawData: Buffer) => {
      try {
        const parsed: unknown = JSON.parse(rawData.toString());
        assertDefined(parsed);
        assertPropString(parsed, 'event');

        if (parsed.event === 'auth.confirmed') {
          clearTimeout(timeout);
          ws.off('message', messageHandler);
          resolve();
        } else if (parsed.event === 'auth.error') {
          clearTimeout(timeout);
          ws.off('message', messageHandler);
          reject(new Error(`WebSocket authentication failed: ${JSON.stringify(parsed)}`));
        }
      } catch (error) {
        // Ignore parse errors during auth
      }
    };

    ws.on('message', messageHandler);
  });

  const waitForEvent = (
    eventName: string,
    timeoutMs = 30000,
  ): Promise<{ event: string; data: unknown }> => {
    // Check if event already received
    const existingMessage = messages.find(msg => msg.event === eventName);
    if (existingMessage) {
      return Promise.resolve(existingMessage);
    }

    // Wait for event
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Clean up
        const waiters = eventPromises.get(eventName);
        if (waiters) {
          const index = waiters.indexOf(resolver);
          if (index > -1) {
            waiters.splice(index, 1);
          }
          if (waiters.length === 0) {
            eventPromises.delete(eventName);
          }
        }
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeoutMs);

      const resolver = (message: { event: string; data: unknown }) => {
        clearTimeout(timeout);
        resolve(message);
      };

      const waiters = eventPromises.get(eventName) || [];
      waiters.push(resolver);
      eventPromises.set(eventName, waiters);
    });
  };

  const close = () => {
    ws.close();
  };

  return { ws, messages, waitForEvent, close };
}

/**
 * Helper to wait with timeout
 */
async function waitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs)),
  ]);
}

suite('Loan Match with Realtime Events', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;

  before(async function () {
    try {
      testId = Date.now().toString(36).toLowerCase();
      testSetup = await setup();
    } catch (error) {
      console.debug('Setup failed:', error);
      throw error;
    }
  });

  after(async function () {
    await testSetup?.teardown();
  });

  describe('Lender creates loan offer with realtime notifications', function () {
    let lender: Awaited<ReturnType<typeof createTestUser>>;
    let lenderOfferId: string;
    let lenderWs: Awaited<ReturnType<typeof connectWebSocket>> | undefined;

    before(async function () {
      lender = await createTestUser({
        testSetup,
        testId,
        email: `lender_realtime_${testId}@test.com`,
        name: 'Lender Realtime',
        userType: 'Individual',
      });
    });

    after(async function () {
      lenderWs?.close();
    });

    it('should create realtime auth token for lender', async function () {
      const response = await lender.fetch('/api/realtime-auth-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: ['notification.created', 'loan.offer.updated'],
        }),
      });

      strictEqual(response.status, 201);
      const data = await response.json();
      assertDefined(data);
      assertPropString(data, 'token');
      assertPropString(data, 'expiresAt');
      assertPropNumber(data, 'expiresIn');
      assertPropArray(data, 'allowedEventTypes');

      // Store token for WebSocket connection
      lender.realtimeToken = data.token;
    });

    it('should connect to realtime websocket and authenticate', async function () {
      ok(lender.realtimeToken, 'Realtime token must be created first');

      lenderWs = await connectWebSocket({
        backendUrl: testSetup.backendUrl,
        accessToken: lender.realtimeToken,
        eventTypes: ['notification.created', 'loan.offer.updated'],
      });

      ok(lenderWs, 'WebSocket connection should be established');
    });

    it('should create loan offer with principal invoice', async function () {
      const loanOfferData = {
        principalBlockchainKey: 'cg:testnet',
        principalTokenId: 'mock:usd',
        totalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '10000.000000000000000000',
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const response = await lender.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      strictEqual(response.status, 201);
      const data = await response.json();
      assertDefined(data);
      assertPropBoolean(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const offer = data.data;
      assertPropString(offer, 'id');
      assertPropString(offer, 'lenderId');
      assertPropDefined(offer, 'principalCurrency');
      assertPropString(offer, 'totalAmount');
      assertPropString(offer, 'availableAmount');
      assertProp(v => v === 'Draft' || v === 'PendingFunding', offer, 'status');

      // Verify funding invoice exists
      assertPropDefined(offer, 'fundingInvoice');
      const invoice = offer.fundingInvoice;
      assertPropString(invoice, 'id');
      assertPropString(invoice, 'amount');
      assertPropString(invoice, 'walletAddress');
      assertPropString(invoice, 'expiryDate');
      assertProp(check(isNullable, isString), invoice, 'paidDate');

      lenderOfferId = offer.id;
      lender.fundingInvoiceAddress = invoice.walletAddress;
      lender.fundingInvoiceAmount = invoice.amount;
    });

    it('should simulate invoice payment via cg:testnet blockchain listener', async function () {
      ok(lenderOfferId, 'Loan offer must be created first');
      ok(lender.fundingInvoiceAddress, 'Funding invoice address must exist');
      ok(lender.fundingInvoiceAmount, 'Funding invoice amount must exist');

      // Simulate blockchain payment
      const paymentResponse = await fetch(
        `${testSetup.backendUrl}/api/test/cg-testnet-blockchain-payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockchainKey: 'cg:testnet',
            tokenId: 'mock:usd',
            address: lender.fundingInvoiceAddress,
            amount: lender.fundingInvoiceAmount,
            txHash: `0x${randomUUID().replace(/-/g, '')}`,
            sender: '0xSenderAddress123',
          }),
        },
      );

      ok(
        paymentResponse.status === 200 || paymentResponse.status === 201,
        `Expected status 200 or 201, got ${paymentResponse.status}`,
      );
      const paymentData = await paymentResponse.json();
      assertDefined(paymentData);
      assertPropBoolean(paymentData, 'success');
      strictEqual(paymentData.success, true);
    });

    it('should receive loan offer published notification via realtime websocket', async function () {
      ok(lenderWs, 'WebSocket must be connected');

      // Wait for notification.created event
      const notificationEvent = await waitWithTimeout(
        lenderWs.waitForEvent('notification.created'),
        10000,
        'Timeout waiting for loan offer published notification',
      );

      assertDefined(notificationEvent);
      assertPropString(notificationEvent, 'event');
      strictEqual(notificationEvent.event, 'notification.created');
      assertPropDefined(notificationEvent, 'data');

      const notificationData = notificationEvent.data;
      assertDefined(notificationData);
      assertPropString(notificationData, 'notificationId');
      assertPropString(notificationData, 'type');
      assertPropString(notificationData, 'title');
      assertPropString(notificationData, 'content');
      assertPropString(notificationData, 'createdAt');

      // Verify notification type is related to loan offer
      ok(
        notificationData.type === 'LoanOfferPublished' ||
          notificationData.type.includes('LoanOffer'),
        'Notification should be related to loan offer',
      );
    });

    it('should verify loan offer is published', async function () {
      ok(lenderOfferId, 'Loan offer must be created first');

      const response = await lender.fetch(`/api/loan-offers/${lenderOfferId}`);
      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');

      const offer = data.data;
      assertPropString(offer, 'status');
      strictEqual(offer.status, 'Published');
      assertPropString(offer, 'publishedDate');
    });
  });

  describe('Borrower creates loan application with realtime notifications', function () {
    let borrower: Awaited<ReturnType<typeof createTestUser>>;
    let borrowerApplicationId: string;
    let borrowerWs: Awaited<ReturnType<typeof connectWebSocket>> | undefined;

    before(async function () {
      borrower = await createTestUser({
        testSetup,
        testId,
        email: `borrower_realtime_${testId}@test.com`,
        name: 'Borrower Realtime',
        userType: 'Individual',
      });
    });

    after(async function () {
      borrowerWs?.close();
    });

    it('should create realtime auth token for borrower', async function () {
      const response = await borrower.fetch('/api/realtime-auth-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: ['notification.created', 'loan.status.changed'],
        }),
      });

      strictEqual(response.status, 201);
      const data = await response.json();
      assertDefined(data);
      assertPropString(data, 'token');

      borrower.realtimeToken = data.token;
    });

    it('should connect to realtime websocket and authenticate', async function () {
      ok(borrower.realtimeToken, 'Realtime token must be created first');

      borrowerWs = await connectWebSocket({
        backendUrl: testSetup.backendUrl,
        accessToken: borrower.realtimeToken,
        eventTypes: ['notification.created', 'loan.status.changed'],
      });

      ok(borrowerWs, 'WebSocket connection should be established');
    });

    it('should create loan application with collateral invoice', async function () {
      const applicationData = {
        collateralBlockchainKey: 'cg:testnet',
        collateralTokenId: 'mock:native',
        principalAmount: '5000.000000000000000000',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const response = await borrower.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      strictEqual(response.status, 201);
      const data = await response.json();
      assertDefined(data);
      assertPropBoolean(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const application = data.data;
      assertPropString(application, 'id');
      assertPropString(application, 'borrowerId');
      assertPropDefined(application, 'collateralCurrency');
      assertPropString(application, 'principalAmount');
      assertProp(v => v === 'PendingCollateral' || v === 'Draft', application, 'status');

      // Verify collateral invoice exists
      assertPropDefined(application, 'collateralInvoice');
      const invoice = application.collateralInvoice;
      assertPropString(invoice, 'id');
      assertPropString(invoice, 'amount');
      assertPropString(invoice, 'walletAddress');
      assertPropString(invoice, 'expiryDate');
      assertProp(check(isNullable, isString), invoice, 'paidDate');

      borrowerApplicationId = application.id;
      borrower.collateralInvoiceAddress = invoice.walletAddress;
      borrower.collateralInvoiceAmount = invoice.amount;
    });

    it('should simulate collateral payment via cg:testnet blockchain listener', async function () {
      ok(borrowerApplicationId, 'Loan application must be created first');
      ok(borrower.collateralInvoiceAddress, 'Collateral invoice address must exist');
      ok(borrower.collateralInvoiceAmount, 'Collateral invoice amount must exist');

      // Simulate blockchain payment
      const paymentResponse = await fetch(
        `${testSetup.backendUrl}/api/test/cg-testnet-blockchain-payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockchainKey: 'cg:testnet',
            tokenId: 'mock:native',
            address: borrower.collateralInvoiceAddress,
            amount: borrower.collateralInvoiceAmount,
            txHash: `0x${randomUUID().replace(/-/g, '')}`,
            sender: '0xBorrowerAddress456',
          }),
        },
      );

      ok(
        paymentResponse.status === 200 || paymentResponse.status === 201,
        `Expected status 200 or 201, got ${paymentResponse.status}`,
      );
      const paymentData = await paymentResponse.json();
      assertDefined(paymentData);
      assertPropBoolean(paymentData, 'success');
      strictEqual(paymentData.success, true);
    });

    it('should receive loan application published notification via realtime websocket', async function () {
      ok(borrowerWs, 'WebSocket must be connected');

      // Wait for notification.created event
      const notificationEvent = await waitWithTimeout(
        borrowerWs.waitForEvent('notification.created'),
        10000,
        'Timeout waiting for loan application published notification',
      );

      assertDefined(notificationEvent);
      assertPropString(notificationEvent, 'event');
      strictEqual(notificationEvent.event, 'notification.created');
      assertPropDefined(notificationEvent, 'data');

      const notificationData = notificationEvent.data;
      assertDefined(notificationData);
      assertPropString(notificationData, 'type');

      // Verify notification type is related to loan application
      ok(
        notificationData.type === 'LoanApplicationPublished' ||
          notificationData.type.includes('LoanApplication'),
        'Notification should be related to loan application',
      );
    });

    it('should verify loan application is published', async function () {
      ok(borrowerApplicationId, 'Loan application must be created first');

      const response = await borrower.fetch(`/api/loan-applications/${borrowerApplicationId}`);
      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');

      const application = data.data;
      assertPropString(application, 'status');
      strictEqual(application.status, 'Published');
      assertPropString(application, 'publishedDate');
    });
  });

  describe('Backend loan matcher matches offer and application', function () {
    let lender: Awaited<ReturnType<typeof createTestUser>>;
    let borrower: Awaited<ReturnType<typeof createTestUser>>;
    let lenderOfferId: string;
    let borrowerApplicationId: string;
    let lenderWs: Awaited<ReturnType<typeof connectWebSocket>> | undefined;
    let borrowerWs: Awaited<ReturnType<typeof connectWebSocket>> | undefined;

    before(async function () {
      // Create lender and loan offer
      lender = await createTestUser({
        testSetup,
        testId,
        email: `lender_match_${testId}@test.com`,
        name: 'Lender Match',
        userType: 'Individual',
      });

      // Create loan offer
      const loanOfferData = {
        principalBlockchainKey: 'cg:testnet',
        principalTokenId: 'mock:usd',
        totalAmount: '20000.000000000000000000',
        interestRate: 10.0,
        termOptions: [3, 6, 12],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '20000.000000000000000000',
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const offerResponse = await lender.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      strictEqual(offerResponse.status, 201);
      const offerData = await offerResponse.json();
      lenderOfferId = offerData.data.id;

      // Pay funding invoice
      const fundingInvoice = offerData.data.fundingInvoice;
      await fetch(`${testSetup.backendUrl}/api/test/cg-testnet-blockchain-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockchainKey: 'cg:testnet',
          tokenId: 'mock:usd',
          address: fundingInvoice.walletAddress,
          amount: fundingInvoice.amount,
          txHash: `0x${randomUUID().replace(/-/g, '')}`,
        }),
      });

      // Wait for offer to be published
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create borrower and loan application
      borrower = await createTestUser({
        testSetup,
        testId,
        email: `borrower_match_${testId}@test.com`,
        name: 'Borrower Match',
        userType: 'Individual',
      });

      const applicationData = {
        collateralBlockchainKey: 'cg:testnet',
        collateralTokenId: 'mock:native',
        principalAmount: '8000.000000000000000000',
        maxInterestRate: 12.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.6,
      };

      const appResponse = await borrower.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      strictEqual(appResponse.status, 201);
      const appData = await appResponse.json();
      borrowerApplicationId = appData.data.id;

      // Pay collateral invoice
      const collateralInvoice = appData.data.collateralInvoice;
      await fetch(`${testSetup.backendUrl}/api/test/cg-testnet-blockchain-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockchainKey: 'cg:testnet',
          tokenId: 'mock:native',
          address: collateralInvoice.walletAddress,
          amount: collateralInvoice.amount,
          txHash: `0x${randomUUID().replace(/-/g, '')}`,
        }),
      });

      // Wait for application to be published
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Connect WebSockets for both parties
      const lenderTokenResponse = await lender.fetch('/api/realtime-auth-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: ['notification.created'],
        }),
      });
      const lenderTokenData = await lenderTokenResponse.json();

      const borrowerTokenResponse = await borrower.fetch('/api/realtime-auth-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: ['notification.created'],
        }),
      });
      const borrowerTokenData = await borrowerTokenResponse.json();

      lenderWs = await connectWebSocket({
        backendUrl: testSetup.backendUrl,
        accessToken: lenderTokenData.token,
        eventTypes: ['notification.created'],
      });

      borrowerWs = await connectWebSocket({
        backendUrl: testSetup.backendUrl,
        accessToken: borrowerTokenData.token,
        eventTypes: ['notification.created'],
      });
    });

    after(async function () {
      lenderWs?.close();
      borrowerWs?.close();
    });

    it('should wait for loan matcher to match offer and application', async function () {
      ok(lenderOfferId, 'Loan offer must exist');
      ok(borrowerApplicationId, 'Loan application must exist');

      // Note: In production, the loan matcher runs automatically via BullMQ queue processor.
      // The matcher is triggered when loan offers and applications are published.
      // For testing, we wait for the automatic matching to occur.
      // The loan-matcher worker should be running (started via setup or manually).
      // If the test fails here, ensure the loan-matcher worker is active.

      // Wait for loan matcher to process (typically runs within a few seconds)
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify that loan application has been matched
      const appResponse = await borrower.fetch(`/api/loan-applications/${borrowerApplicationId}`);
      const appData = await appResponse.json();
      assertDefined(appData);
      assertPropDefined(appData, 'data');

      const application = appData.data;
      assertPropString(application, 'status');

      // Status should be Matched or Active after matching
      ok(
        application.status === 'Matched' || application.status === 'Active',
        `Expected status to be Matched or Active, got ${application.status}`,
      );

      if (application.status === 'Matched' || application.status === 'Active') {
        assertPropString(application, 'matchedLoanOfferId');
        strictEqual(application.matchedLoanOfferId, lenderOfferId);
      }
    });

    it('should receive loan matched notification for lender via realtime', async function () {
      ok(lenderWs, 'Lender WebSocket must be connected');

      // Wait for notification about loan match
      const notificationEvent = await waitWithTimeout(
        lenderWs.waitForEvent('notification.created'),
        15000,
        'Timeout waiting for lender loan matched notification',
      );

      assertDefined(notificationEvent);
      assertPropDefined(notificationEvent, 'data');

      const notificationData = notificationEvent.data;
      assertDefined(notificationData);
      assertPropString(notificationData, 'type');
      assertPropString(notificationData, 'title');
      assertPropString(notificationData, 'content');

      // Verify notification is about loan offer matching
      strictEqual(notificationData.type, 'LoanOfferMatched');
    });

    it('should receive loan matched notification for borrower via realtime', async function () {
      ok(borrowerWs, 'Borrower WebSocket must be connected');

      // Wait for notification about loan match
      const notificationEvent = await waitWithTimeout(
        borrowerWs.waitForEvent('notification.created'),
        15000,
        'Timeout waiting for borrower loan matched notification',
      );

      assertDefined(notificationEvent);
      assertPropDefined(notificationEvent, 'data');

      const notificationData = notificationEvent.data;
      assertDefined(notificationData);
      assertPropString(notificationData, 'type');
      assertPropString(notificationData, 'title');
      assertPropString(notificationData, 'content');

      // Verify notification is about loan application matching
      strictEqual(notificationData.type, 'LoanApplicationMatched');
    });

    it('should verify loan match data is correct', async function () {
      ok(lenderOfferId, 'Loan offer must exist');
      ok(borrowerApplicationId, 'Loan application must exist');

      // Verify loan offer data
      const offerResponse = await lender.fetch(`/api/loan-offers/${lenderOfferId}`);
      const offerData = await offerResponse.json();
      assertDefined(offerData);
      assertPropDefined(offerData, 'data');

      const offer = offerData.data;
      assertPropString(offer, 'status');
      assertPropString(offer, 'disbursedAmount');
      assertPropString(offer, 'availableAmount');

      // Disbursed amount should be greater than 0 after matching
      const disbursedAmount = parseFloat(offer.disbursedAmount);
      ok(disbursedAmount > 0, 'Disbursed amount should be greater than 0');

      // Verify loan application data
      const appResponse = await borrower.fetch(`/api/loan-applications/${borrowerApplicationId}`);
      const appData = await appResponse.json();
      assertDefined(appData);
      assertPropDefined(appData, 'data');

      const application = appData.data;
      assertPropString(application, 'matchedLoanOfferId');
      strictEqual(application.matchedLoanOfferId, lenderOfferId);
      assertPropNumber(application, 'matchedLtvRatio');
      ok(application.matchedLtvRatio > 0 && application.matchedLtvRatio <= 1);
    });

    it('should verify loan exists and is active', async function () {
      ok(borrowerApplicationId, 'Loan application must exist');

      // Get loan application to find the loan ID
      const appResponse = await borrower.fetch(`/api/loan-applications/${borrowerApplicationId}`);
      const appData = await appResponse.json();
      assertDefined(appData);
      assertPropDefined(appData, 'data');

      // Check if loan was created via my-loans endpoint
      const loansResponse = await borrower.fetch('/api/loans/my-loans');
      const loansData = await loansResponse.json();

      if (loansResponse.status === 200) {
        assertDefined(loansData);
        assertPropDefined(loansData, 'data');
        assertPropArray(loansData.data, 'loans');

        // Verify at least one loan exists for this borrower
        ok(loansData.data.loans.length > 0, 'At least one loan should exist');

        const loan = loansData.data.loans[0];
        assertDefined(loan);
        assertPropString(loan, 'id');
        assertPropString(loan, 'status');
        assertPropString(loan, 'principalAmount');
        assertPropString(loan, 'collateralAmount');
        assertPropNumber(loan, 'interestRate');
      }
    });
  });
});

// Extend TestUser type to include realtime properties
declare module './setup/user' {
  interface TestUser {
    realtimeToken?: string;
    fundingInvoiceAddress?: string;
    fundingInvoiceAmount?: string;
    collateralInvoiceAddress?: string;
    collateralInvoiceAmount?: string;
  }
}
