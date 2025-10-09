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
  close: () => Promise<void>;
}> {
  const wsUrl = params.backendUrl.replace(/^http/, 'ws');
  const ws = new WebSocket(`${wsUrl}/api/realtime`);
  const messages: Array<{ event: string; data: unknown }> = [];
  const eventPromises = new Map<string, Array<(msg: { event: string; data: unknown }) => void>>();
  const activeTimeouts = new Set<NodeJS.Timeout>();

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
      } catch (_error) {
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
        activeTimeouts.delete(timeout);
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

      // Track the timeout so it can be cleared on close
      activeTimeouts.add(timeout);

      const resolver = (message: { event: string; data: unknown }) => {
        clearTimeout(timeout);
        activeTimeouts.delete(timeout);

        // Clean up the waiter from the map
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

        resolve(message);
      };

      const waiters = eventPromises.get(eventName) || [];
      waiters.push(resolver);
      eventPromises.set(eventName, waiters);
    });
  };

  const close = async () => {
    // Clear all pending timeouts
    for (const timeout of activeTimeouts) {
      clearTimeout(timeout);
    }
    activeTimeouts.clear();

    // Clear any pending waiters in eventPromises
    for (const [eventName, waiters] of eventPromises.entries()) {
      for (const waiter of waiters) {
        // Resolve pending waiters with null data to prevent hanging promises
        try {
          waiter({ event: eventName, data: null });
        } catch {
          // Ignore errors from rejected promises
        }
      }
    }
    eventPromises.clear();

    // Close the WebSocket connection and wait for it to fully close
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      await new Promise<void>(resolve => {
        const onClose = () => {
          ws.off('close', onClose);
          ws.off('error', onError);
          resolve();
        };
        const onError = () => {
          ws.off('close', onClose);
          ws.off('error', onError);
          resolve();
        };

        ws.once('close', onClose);
        ws.once('error', onError);

        // Force close after a short timeout if the close event doesn't fire
        setTimeout(() => {
          ws.off('close', onClose);
          ws.off('error', onError);
          resolve();
        }, 100);

        ws.close();
      });
    }

    // Remove all listeners to prevent memory leaks
    ws.removeAllListeners();
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
  let timeoutHandle: NodeJS.Timeout | undefined;
  return Promise.race([
    promise.then(result => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      return result;
    }),
    new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

/**
 * Helper to wait for a specific notification type within notification.created events
 */
async function waitForNotificationType(
  ws: Awaited<ReturnType<typeof connectWebSocket>>,
  notificationType: string,
  timeoutMs = 15000,
): Promise<{ event: string; data: unknown }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    // Check existing messages for the notification type
    const existingMessage = ws.messages.find(msg => {
      if (msg.event !== 'notification.created') return false;
      const data = msg.data as { type?: string };
      return data?.type === notificationType;
    });

    if (existingMessage) {
      return existingMessage;
    }

    // Wait for next notification.created event
    try {
      const remainingTime = timeoutMs - (Date.now() - startTime);
      if (remainingTime <= 0) break;

      const event = await waitWithTimeout(
        ws.waitForEvent('notification.created'),
        remainingTime,
        'Timeout waiting for notification.created event',
      );

      const data = event.data as { type?: string };
      if (data?.type === notificationType) {
        return event;
      }
    } catch (_error) {
      // Timeout or other error
      break;
    }
  }

  throw new Error(
    `Timeout waiting for notification type: ${notificationType} (waited ${timeoutMs}ms)`,
  );
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

  describe('Complete loan match flow with realtime events', function () {
    let lender: Awaited<ReturnType<typeof createTestUser>>;
    let borrower: Awaited<ReturnType<typeof createTestUser>>;
    let lenderOfferId: string;
    let borrowerApplicationId: string;
    let lenderWs: Awaited<ReturnType<typeof connectWebSocket>> | undefined;
    let borrowerWs: Awaited<ReturnType<typeof connectWebSocket>> | undefined;

    after(async function () {
      if (lenderWs) {
        await lenderWs.close();
      }
      if (borrowerWs) {
        await borrowerWs.close();
      }
    });

    it('should setup user lender', async function () {
      lender = await createTestUser({
        testSetup,
        testId,
        email: `lender_flow_${testId}@test.com`,
        name: 'Lender Flow',
        userType: 'Individual',
      });

      ok(lender, 'Lender should be created');
    });

    it('should listen to realtime websocket event for user lender', async function () {
      ok(lender, 'Lender must be created first');

      // Create realtime auth token
      const tokenResponse = await lender.fetch('/api/realtime-auth-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: ['notification.created', 'loan.offer.updated'],
        }),
      });

      strictEqual(tokenResponse.status, 201);
      const tokenData = await tokenResponse.json();
      assertDefined(tokenData);
      assertPropString(tokenData, 'token');

      // Connect to WebSocket
      lenderWs = await connectWebSocket({
        backendUrl: testSetup.backendUrl,
        accessToken: tokenData.token,
        eventTypes: ['notification.created', 'loan.offer.updated'],
      });

      ok(lenderWs, 'Lender WebSocket connection should be established');
    });

    it('user lender creates loan offer', async function () {
      ok(lender, 'Lender must be created first');

      const loanOfferData = {
        principalBlockchainKey: 'cg:testnet',
        principalTokenId: 'mock:usd',
        totalAmount: '20000.000000000000000000',
        interestRate: 0.1,
        termOptions: [3, 6, 12],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '20000.000000000000000000',
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

      // Wait a bit for the indexer to register the wallet address
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    it('should simulate loan offer invoice payment', async function () {
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
            sender: '0xLenderAddress123',
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

    it('should receive realtime websocket event for loan offer published', async function () {
      ok(lenderWs, 'Lender WebSocket must be connected');

      // Give the system time to process the invoice payment and send notifications
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for LoanOfferPublished notification type
      const notificationEvent = await waitForNotificationType(
        lenderWs,
        'LoanOfferPublished',
        30000,
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

      // Verify notification type
      strictEqual(notificationData.type, 'LoanOfferPublished');

      // Verify loan offer is now published
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

    it('should setup user borrower', async function () {
      borrower = await createTestUser({
        testSetup,
        testId,
        email: `borrower_flow_${testId}@test.com`,
        name: 'Borrower Flow',
        userType: 'Individual',
      });

      ok(borrower, 'Borrower should be created');
    });

    it('should listen to realtime websocket event for user borrower', async function () {
      ok(borrower, 'Borrower must be created first');

      // Create realtime auth token
      const tokenResponse = await borrower.fetch('/api/realtime-auth-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: ['notification.created', 'loan.status.changed'],
        }),
      });

      strictEqual(tokenResponse.status, 201);
      const tokenData = await tokenResponse.json();
      assertDefined(tokenData);
      assertPropString(tokenData, 'token');

      // Connect to WebSocket
      borrowerWs = await connectWebSocket({
        backendUrl: testSetup.backendUrl,
        accessToken: tokenData.token,
        eventTypes: ['notification.created', 'loan.status.changed'],
      });

      ok(borrowerWs, 'Borrower WebSocket connection should be established');
    });

    it('user borrower creates loan application', async function () {
      ok(borrower, 'Borrower must be created first');

      const applicationData = {
        collateralBlockchainKey: 'cg:testnet',
        collateralTokenId: 'mock:native',
        principalAmount: '8000.000000000000000000',
        maxInterestRate: 0.12,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.6,
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

      // Wait a bit for the indexer to register the wallet address
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    it('should simulate loan application collateral invoice payment', async function () {
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

    it('should receive realtime websocket event for collateral invoice paid', async function () {
      ok(borrowerWs, 'Borrower WebSocket must be connected');

      // Give the system time to process the invoice payment and send notifications
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for LoanApplicationPublished notification type
      const notificationEvent = await waitForNotificationType(
        borrowerWs,
        'LoanApplicationPublished',
        30000,
      );

      assertDefined(notificationEvent);
      assertPropString(notificationEvent, 'event');
      strictEqual(notificationEvent.event, 'notification.created');
      assertPropDefined(notificationEvent, 'data');

      const notificationData = notificationEvent.data;
      assertDefined(notificationData);
      assertPropString(notificationData, 'type');

      // Verify notification type
      strictEqual(notificationData.type, 'LoanApplicationPublished');

      // Verify loan application is now published (or already matched if the matcher was very fast)
      const response = await borrower.fetch(`/api/loan-applications/${borrowerApplicationId}`);
      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');

      const application = data.data;
      assertPropString(application, 'status');
      ok(
        application.status === 'Published' || application.status === 'Matched',
        `Expected status to be Published or Matched, got ${application.status}`,
      );
      assertPropString(application, 'publishedDate');
    });

    it('backend should match loan offer and loan application', async function () {
      ok(lenderOfferId, 'Loan offer must exist');
      ok(borrowerApplicationId, 'Loan application must exist');

      // Note: In production, the loan matcher runs automatically via BullMQ queue processor.
      // The matcher is triggered when loan offers and applications are published.
      // For testing, we wait for the automatic matching to occur.
      // The loan-matcher worker should be running (started via setup).

      // Wait for loan matcher to process
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

      assertPropString(application, 'matchedLoanOfferId');
      strictEqual(application.matchedLoanOfferId, lenderOfferId);
    });

    it('user lender and user borrower should receive realtime websocket event for loan matched', async function () {
      ok(lenderWs, 'Lender WebSocket must be connected');
      ok(borrowerWs, 'Borrower WebSocket must be connected');

      // Give the notification queue time to process the match notifications
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for lender notification about loan match
      const lenderNotificationEvent = await waitForNotificationType(
        lenderWs,
        'LoanOfferMatched',
        15000,
      );

      assertDefined(lenderNotificationEvent);
      assertPropDefined(lenderNotificationEvent, 'data');

      const lenderNotificationData = lenderNotificationEvent.data;
      assertDefined(lenderNotificationData);
      assertPropString(lenderNotificationData, 'type');
      assertPropString(lenderNotificationData, 'title');
      assertPropString(lenderNotificationData, 'content');

      // Verify notification is about loan offer matching
      strictEqual(lenderNotificationData.type, 'LoanOfferMatched');

      // Wait for borrower notification about loan match
      const borrowerNotificationEvent = await waitForNotificationType(
        borrowerWs,
        'LoanApplicationMatched',
        15000,
      );

      assertDefined(borrowerNotificationEvent);
      assertPropDefined(borrowerNotificationEvent, 'data');

      const borrowerNotificationData = borrowerNotificationEvent.data;
      assertDefined(borrowerNotificationData);
      assertPropString(borrowerNotificationData, 'type');
      assertPropString(borrowerNotificationData, 'title');
      assertPropString(borrowerNotificationData, 'content');

      // Verify notification is about loan application matching
      strictEqual(borrowerNotificationData.type, 'LoanApplicationMatched');
    });

    it('should verify loan offer and loan application status after matched', async function () {
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
      assertPropString(offer, 'totalAmount');

      // Available amount should be reduced after matching (funds reserved)
      const availableAmount = parseFloat(offer.availableAmount);
      const totalAmount = parseFloat(offer.totalAmount);
      ok(
        availableAmount < totalAmount,
        'Available amount should be less than total amount after matching',
      );

      // Verify loan application data
      const appResponse = await borrower.fetch(`/api/loan-applications/${borrowerApplicationId}`);
      const appData = await appResponse.json();
      assertDefined(appData);
      assertPropDefined(appData, 'data');

      const application = appData.data;
      assertPropString(application, 'status');
      assertPropString(application, 'matchedLoanOfferId');
      strictEqual(application.matchedLoanOfferId, lenderOfferId);
      assertPropNumber(application, 'matchedLtvRatio');
      ok(application.matchedLtvRatio > 0 && application.matchedLtvRatio <= 1);
    });

    it('should verify loans exist in /api/loans after matching and origination', async function () {
      ok(borrower, 'Borrower must exist');
      ok(lender, 'Lender must exist');

      // Note: With automatic loan origination after matching, loan records should be created
      // immediately after the match is successful.

      // Query loans for borrower - should have 1 loan
      const borrowerLoansResponse = await borrower.fetch('/api/loans');
      strictEqual(borrowerLoansResponse.status, 200);
      const borrowerLoansData = await borrowerLoansResponse.json();
      assertDefined(borrowerLoansData);
      assertPropDefined(borrowerLoansData, 'data');
      assertPropArray(borrowerLoansData.data, 'loans');
      strictEqual(
        borrowerLoansData.data.loans.length,
        1,
        'Borrower should have exactly 1 loan after matching and origination',
      );

      // Verify borrower loan details
      const borrowerLoan = borrowerLoansData.data.loans[0];
      assertDefined(borrowerLoan);
      assertPropString(borrowerLoan, 'id');
      assertPropString(borrowerLoan, 'borrowerId');
      assertPropString(borrowerLoan, 'lenderId');
      assertPropString(borrowerLoan, 'principalAmount');
      assertPropString(borrowerLoan, 'collateralAmount');
      assertPropNumber(borrowerLoan, 'interestRate');
      assertPropNumber(borrowerLoan, 'termMonths');
      assertPropNumber(borrowerLoan, 'currentLtv');
      assertPropNumber(borrowerLoan, 'maxLtvRatio');
      assertPropString(borrowerLoan, 'status');
      assertPropString(borrowerLoan, 'originationDate');
      assertPropString(borrowerLoan, 'maturityDate');

      // Status should be ACTIVE after automatic disbursement
      // Note: platformDisbursesPrincipal updates status from 'Originated' to 'Active'
      // which maps to 'ACTIVE' in the API
      strictEqual(
        borrowerLoan.status,
        'ACTIVE',
        `Expected status to be ACTIVE after automatic disbursement, got ${borrowerLoan.status}`,
      );

      // Disbursement date should be set after automatic disbursement
      assertPropString(borrowerLoan, 'disbursementDate');
      ok(
        borrowerLoan.disbursementDate,
        'Disbursement date should be set after automatic disbursement',
      );

      // Query loans for lender - should have 1 loan
      const lenderLoansResponse = await lender.fetch('/api/loans');
      strictEqual(lenderLoansResponse.status, 200);
      const lenderLoansData = await lenderLoansResponse.json();
      assertDefined(lenderLoansData);
      assertPropDefined(lenderLoansData, 'data');
      assertPropArray(lenderLoansData.data, 'loans');
      strictEqual(
        lenderLoansData.data.loans.length,
        1,
        'Lender should have exactly 1 loan after matching and origination',
      );

      // Verify lender loan details
      const lenderLoan = lenderLoansData.data.loans[0];
      assertDefined(lenderLoan);
      assertPropString(lenderLoan, 'id');
      assertPropString(lenderLoan, 'borrowerId');
      assertPropString(lenderLoan, 'lenderId');

      // Verify both borrower and lender see the same loan
      strictEqual(borrowerLoan.id, lenderLoan.id, 'Borrower and lender should see the same loan');
      strictEqual(
        borrowerLoan.borrowerId,
        borrower.id,
        'Loan borrower ID should match borrower user ID',
      );
      strictEqual(borrowerLoan.lenderId, lender.id, 'Loan lender ID should match lender user ID');
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
