import { equal, ok } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import { createEarlyExitNodeTestIt } from '../utils/node-test';
import { FinanceRepository } from './finance.repository';

export async function runFinanceRepositoryTestSuite(
  createRepo: () => Promise<FinanceRepository>,
  teardownRepo: (repo: FinanceRepository) => Promise<void>,
): Promise<void> {
  const { afterEach, beforeEach, it } = createEarlyExitNodeTestIt();
  await suite('FinanceRepository', function () {
    let repo: FinanceRepository;

    beforeEach(async function () {
      repo = await createRepo();
    });

    afterEach(async function () {
      await teardownRepo(repo);
    });

    describe('Account & Balance Management', function () {
      it('should create user account with initial zero balance', async function () {
        // Create test user who wants to create an account
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'accountholder@test.com', name: 'Account Holder' }],
        });

        const _userId = userCreationResult.users[0].id;
        const currencyBlockchainKey = 'eip155:56';
        const currencyTokenId = 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';

        const result = await repo.testCreatesUserAccount({
          userId: userCreationResult.users[0].id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        equal(result.userId, userCreationResult.users[0].id);
        equal(result.currencyBlockchainKey, currencyBlockchainKey);
        equal(result.currencyTokenId, currencyTokenId);
        equal(result.balance, '0');
        equal(result.accountType, 'User');
        equal(typeof result.id, 'string');
      });

      it('should handle account creation with existing currency (upsert)', async function () {
        // Create test user who will create duplicate account
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'duplicateuser@test.com', name: 'Duplicate User' }],
        });

        const userId = userCreationResult.users[0].id;
        const currencyBlockchainKey = 'bip122:000000000019d6689c085ae165831e93';
        const currencyTokenId = 'slip44:0';

        // Create account first time
        const firstResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey,
          currencyTokenId,
          accountType: 'User',
        });

        // Create account second time with same account type (should upsert)
        const secondResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey,
          currencyTokenId,
          accountType: 'User',
        });

        equal(firstResult.id, secondResult.id);
        equal(secondResult.accountType, 'User');
        equal(secondResult.balance, '0');
      });

      it('should retrieve account balances for user', async function () {
        // Create test user who will have multiple accounts
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'multiaccountuser@test.com', name: 'Multi Account User' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create multiple accounts
        await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          accountType: 'User',
        });

        const result = await repo.userRetrievesAccountBalances({ userId });

        equal(result.accounts.length, 2);
        equal(result.accounts[0].userId, userId);
        equal(result.accounts[0].balance, '0');
        equal(result.accounts[1].userId, userId);
        equal(result.accounts[1].balance, '0');

        // Check ordering by currency
        const ethereumAccount = result.accounts.find(a => a.currencyBlockchainKey === 'eip155:56');
        const bitcoinAccount = result.accounts.find(
          a => a.currencyBlockchainKey === 'bip122:000000000019d6689c085ae165831e93',
        );
        ok(ethereumAccount, 'Ethereum account should exist');
        ok(bitcoinAccount, 'Bitcoin account should exist');
      });

      it('should return empty array for user with no accounts', async function () {
        const result = await repo.userRetrievesAccountBalances({ userId: '999' });
        equal(result.accounts.length, 0);
      });

      it('should retrieve account transaction history with pagination', async function () {
        // Create test user who will have transaction history
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'transactionuser@test.com', name: 'Transaction User' }],
        });

        const userId = userCreationResult.users[0].id;
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Create some test mutations (this would normally be done by other flows)
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T10:00:00Z',
              amount: '1000000000',
            },
            {
              mutationType: 'WithdrawalRequested',
              mutationDate: '2024-01-01T11:00:00Z',
              amount: '-500000000',
            },
            {
              mutationType: 'WithdrawalRefunded',
              mutationDate: '2024-01-01T12:00:00Z',
              amount: '500000000',
            },
          ],
        });

        const result = await repo.userViewsAccountTransactionHistory({
          accountId: accountResult.id,
          limit: 2,
          offset: 0,
        });

        equal(result.mutations.length, 2);
        equal(result.hasMore, true);
        equal(result.totalCount, 3);

        // Should be ordered by date DESC
        equal(result.mutations[0].mutationType, 'WithdrawalRefunded');
        equal(result.mutations[1].mutationType, 'WithdrawalRequested');
      });

      it('should filter transaction history by mutation type', async function () {
        // Create test user who will have filtered transactions
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'filtereduser@test.com', name: 'Filtered User' }],
        });

        const userId = userCreationResult.users[0].id;
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Create test mutations
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T10:00:00Z',
              amount: '1000000000',
            },
            {
              mutationType: 'WithdrawalRequested',
              mutationDate: '2024-01-01T11:00:00Z',
              amount: '-500000000',
            },
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T12:00:00Z',
              amount: '2000000000',
            },
          ],
        });

        const result = await repo.userViewsAccountTransactionHistory({
          accountId: accountResult.id,
          mutationType: 'InvoiceReceived',
        });

        equal(result.mutations.length, 2);
        result.mutations.forEach(mutation => {
          equal(mutation.mutationType, 'InvoiceReceived');
        });
      });

      it('should filter transaction history by date range', async function () {
        // Create test user who will have date-filtered transactions
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'datefilteruser@test.com', name: 'Date Filter User' }],
        });

        const userId = userCreationResult.users[0].id;
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Create test mutations
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T10:00:00Z',
              amount: '1000000000',
            },
            {
              mutationType: 'WithdrawalRequested',
              mutationDate: '2024-01-02T11:00:00Z',
              amount: '-500000000',
            },
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-03T12:00:00Z',
              amount: '2000000000',
            },
          ],
        });

        const result = await repo.userViewsAccountTransactionHistory({
          accountId: accountResult.id,
          fromDate: new Date('2024-01-02T00:00:00Z'),
          toDate: new Date('2024-01-02T23:59:59Z'),
        });

        equal(result.mutations.length, 1);
        equal(result.mutations[0].mutationType, 'WithdrawalRequested');
      });
    });

    describe('Invoice Management', function () {
      it('should create invoice with payment address', async function () {
        // Create test borrower who needs loan collateral invoice
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'borrower@test.com', name: 'Test Borrower' }],
        });

        const userId = userCreationResult.users[0].id;
        const invoiceDate = new Date('2024-01-01T03:00:00Z');
        const dueDate = new Date('2024-01-02T03:00:00Z');

        const result = await repo.testCreatesInvoice({
          userId,
          currencyBlockchainKey: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          currencyTokenId: 'slip44:501',
          invoicedAmount: '10000000000', // 10 SOL in lamports
          walletDerivationPath: "m/44'/501'/0'/0/100",
          walletAddress: '11111111111111111111111111111112',
          invoiceType: 'LoanCollateral',
          invoiceDate,
          dueDate,
        });

        equal(result.userId, userId);
        equal(result.walletAddress, '11111111111111111111111111111112');
        equal(result.invoiceType, 'LoanCollateral');
        equal(result.status, 'Pending');
        equal(result.invoicedAmount, '10000000000');
        equal(result.paidAmount, '0');
        equal(result.invoiceDate.getTime(), invoiceDate.getTime());
        equal(result.dueDate?.getTime(), dueDate.getTime());
        equal(typeof result.id, 'string');
      });

      it('should create invoice without due date', async function () {
        // Create test borrower who needs loan principal invoice without due date
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'principalborrower@test.com', name: 'Principal Borrower' }],
        });

        const userId = userCreationResult.users[0].id;
        const invoiceDate = new Date('2024-01-01T10:00:00Z');

        const result = await repo.testCreatesInvoice({
          userId,
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          invoicedAmount: '50000000', // 0.5 BTC in satoshis
          walletDerivationPath: "m/44'/0'/0'/0/11",
          walletAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          invoiceType: 'LoanPrincipal',
          invoiceDate,
        });

        equal(result.dueDate, null);
        equal(result.invoiceType, 'LoanPrincipal');
      });

      it('should record blockchain payment for invoice', async function () {
        // Create test user who will pay invoice via blockchain
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'invoicepayer@test.com', name: 'Invoice Payer' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account first (needed for invoice payment triggers)
        await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        const invoiceResult = await repo.testCreatesInvoice({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '1000000',
          walletDerivationPath: "m/44'/60'/0'/0/12",
          walletAddress: '0x2234567890123456789012345678901234567890',
          invoiceType: 'LoanCollateral',
          invoiceDate: new Date('2024-01-01T03:00:00Z'),
        });

        const paymentDate = new Date('2024-01-01T04:00:00Z');
        const paymentResult = await repo.platformRecordInvoicePayment({
          walletAddress: invoiceResult.walletAddress,
          paymentHash: '0xabcdef1234567890abcdef1234567890abcdef12345678',
          amount: '1000000',
          paymentDate,
        });

        equal(paymentResult.invoiceId, invoiceResult.id);
        equal(paymentResult.paymentHash, '0xabcdef1234567890abcdef1234567890abcdef12345678');
        equal(paymentResult.amount, '1000000');
        equal(paymentResult.paymentDate.getTime(), paymentDate.getTime());
        equal(typeof paymentResult.id, 'string');
      });

      it('should update invoice status', async function () {
        // Create test user whose invoice will expire
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'expiredinvoiceuser@test.com', name: 'Expired Invoice User' }],
        });

        const userId = userCreationResult.users[0].id;
        const invoiceResult = await repo.testCreatesInvoice({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '1000000',
          walletDerivationPath: "m/44'/60'/0'/0/13",
          walletAddress: '0x3234567890123456789012345678901234567890',
          invoiceType: 'LoanRepayment',
          invoiceDate: new Date('2024-01-01T10:00:00Z'),
        });

        const expiredDate = new Date('2024-01-03T03:00:00Z');
        const notifiedDate = new Date('2024-01-02T03:00:00Z');

        const result = await repo.testUpdatesInvoiceStatus({
          invoiceId: invoiceResult.id,
          status: 'Expired',
          expiredDate,
          notifiedDate,
        });

        equal(result.id, invoiceResult.id);
        equal(result.status, 'Expired');
        equal(result.expiredDate?.getTime(), expiredDate.getTime());
        equal(result.notifiedDate?.getTime(), notifiedDate.getTime());
      });

      it('should throw error when updating non-existent invoice', async function () {
        let errorThrown = false;
        try {
          await repo.testUpdatesInvoiceStatus({
            invoiceId: '999',
            status: 'Paid',
          });
        } catch (error) {
          errorThrown = true;
          ok(error.message.includes('Invoice status update failed'));
        }
        ok(errorThrown, 'Expected error for non-existent invoice');
      });

      it('should view invoice details', async function () {
        // Create test user who wants to view invoice details
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'invoiceviewer@test.com', name: 'Invoice Viewer' }],
        });

        const userId = userCreationResult.users[0].id;
        const invoiceDate = new Date('2024-01-01T03:00:00Z');
        const dueDate = new Date('2024-01-02T03:00:00Z');

        const invoiceResult = await repo.testCreatesInvoice({
          userId,
          currencyBlockchainKey: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          currencyTokenId: 'slip44:501',
          invoicedAmount: '10000000000',
          walletDerivationPath: "m/44'/501'/0'/0/14",
          walletAddress: '11111111111111111111111111111112',
          invoiceType: 'LoanCollateral',
          invoiceDate,
          dueDate,
        });

        const result = await repo.userViewsInvoiceDetails({
          invoiceId: invoiceResult.id,
        });

        equal(result.id, invoiceResult.id);
        equal(result.userId, userId);
        equal(result.currencyBlockchainKey, 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');
        equal(result.currencyTokenId, 'slip44:501');
        equal(result.invoicedAmount, '10000000000');
        equal(result.paidAmount, '0');
        equal(result.walletAddress, '11111111111111111111111111111112');
        equal(result.invoiceType, 'LoanCollateral');
        equal(result.status, 'Pending');
        equal(result.invoiceDate.getTime(), invoiceDate.getTime());
        equal(result.dueDate?.getTime(), dueDate.getTime());
        equal(result.expiredDate, null);
        equal(result.paidDate, null);
      });

      it('should throw error when viewing non-existent invoice', async function () {
        let errorThrown = false;
        try {
          await repo.userViewsInvoiceDetails({
            invoiceId: '999',
          });
        } catch (error) {
          errorThrown = true;
          ok(error.message.includes('Invoice not found'));
        }
        ok(errorThrown, 'Expected error for non-existent invoice');
      });

      it('should view active but expired invoices', async function () {
        // Create test users who will have invoices
        const userCreationResult = await repo.testCreatesUsers({
          users: [
            { email: 'expireduser1@test.com', name: 'Expired User 1' },
            { email: 'expireduser2@test.com', name: 'Expired User 2' },
            { email: 'activeuser@test.com', name: 'Active User' },
          ],
        });

        const expiredUser1Id = userCreationResult.users[0].id;
        const expiredUser2Id = userCreationResult.users[1].id;
        const activeUserId = userCreationResult.users[2].id;

        const baseDate = new Date('2024-01-01T10:00:00Z');
        const invoiceDate1 = new Date('2024-01-01T06:00:00Z'); // Created earlier
        const invoiceDate2 = new Date('2024-01-01T07:00:00Z'); // Created earlier
        const dueDatePast = new Date('2024-01-01T08:00:00Z'); // Due date before base date
        const dueDateFuture = new Date('2024-01-01T12:00:00Z'); // 2 hours from now

        // Create expired invoice with 'Pending' status (should be found)
        const expiredInvoice1 = await repo.testCreatesInvoice({
          userId: expiredUser1Id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '1000000',
          walletDerivationPath: "m/44'/60'/0'/0/20",
          walletAddress: '0x1234567890123456789012345678901234567890',
          invoiceType: 'LoanCollateral',
          invoiceDate: invoiceDate1,
          dueDate: dueDatePast,
        });

        // Create expired invoice with 'PartiallyPaid' status (should be found)
        const expiredInvoice2 = await repo.testCreatesInvoice({
          userId: expiredUser2Id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '2000000',
          walletDerivationPath: "m/44'/60'/0'/0/21",
          walletAddress: '0x2234567890123456789012345678901234567890',
          invoiceType: 'LoanRepayment',
          invoiceDate: invoiceDate2,
          dueDate: dueDatePast,
        });

        // Update second invoice to PartiallyPaid status
        await repo.testUpdatesInvoiceStatus({
          invoiceId: expiredInvoice2.id,
          status: 'PartiallyPaid',
        });

        // Create active invoice with future due date (should NOT be found)
        await repo.testCreatesInvoice({
          userId: activeUserId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '3000000',
          walletDerivationPath: "m/44'/60'/0'/0/22",
          walletAddress: '0x3234567890123456789012345678901234567890',
          invoiceType: 'LoanPrincipal',
          invoiceDate: baseDate,
          dueDate: dueDateFuture,
        });

        // Create invoice without due date (should NOT be found)
        await repo.testCreatesInvoice({
          userId: activeUserId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '4000000',
          walletDerivationPath: "m/44'/60'/0'/0/23",
          walletAddress: '0x4234567890123456789012345678901234567890',
          invoiceType: 'LoanCollateral',
          invoiceDate: baseDate,
        });

        // Query for expired invoices as of the base date
        const result = await repo.platformViewsActiveButExpiredInvoices({
          asOfDate: baseDate,
          limit: 10,
          offset: 0,
        });

        equal(result.invoices.length, 2);
        equal(result.totalCount, 2);
        equal(result.hasMore, false);

        // Check that returned invoices are the correct ones
        const returnedIds = result.invoices.map(i => i.id);
        ok(returnedIds.includes(expiredInvoice1.id), 'Should include expired invoice 1');
        ok(returnedIds.includes(expiredInvoice2.id), 'Should include expired invoice 2');

        // Check ordering (should be by due_date ASC)
        ok(
          (result.invoices[0].dueDate?.getTime() ?? 0) <=
            (result.invoices[1].dueDate?.getTime() ?? 0),
          'Should be ordered by due date ASC',
        );

        // Verify returned data structure
        for (const invoice of result.invoices) {
          equal(typeof invoice.id, 'string');
          equal(typeof invoice.userId, 'string');
          equal(typeof invoice.currencyBlockchainKey, 'string');
          equal(typeof invoice.currencyTokenId, 'string');
          equal(typeof invoice.invoicedAmount, 'string');
          equal(typeof invoice.paidAmount, 'string');
          equal(typeof invoice.walletAddress, 'string');
          equal(typeof invoice.walletDerivationPath, 'string');
          equal(typeof invoice.invoiceType, 'string');
          equal(typeof invoice.status, 'string');
          ok(invoice.invoiceDate instanceof Date);
          ok(invoice.dueDate instanceof Date || invoice.dueDate === null);
          ok(invoice.expiredDate instanceof Date || invoice.expiredDate === null);
        }
      });

      it('should set active but expired invoice as expired', async function () {
        // Create test user who has an expired invoice
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'toexpireuser@test.com', name: 'To Expire User' }],
        });

        const userId = userCreationResult.users[0].id;
        const _baseDate = new Date('2024-01-01T10:00:00Z');
        const invoiceDate = new Date('2024-01-01T06:00:00Z'); // Created earlier
        const dueDatePast = new Date('2024-01-01T08:00:00Z');

        // Create invoice that should be expired
        const invoiceResult = await repo.testCreatesInvoice({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '1000000',
          walletDerivationPath: "m/44'/60'/0'/0/24",
          walletAddress: '0x5234567890123456789012345678901234567890',
          invoiceType: 'LoanCollateral',
          invoiceDate: invoiceDate,
          dueDate: dueDatePast,
        });

        // Verify initial status is 'Pending'
        equal(invoiceResult.status, 'Pending');

        const expiredDate = new Date('2024-01-01T11:00:00Z');

        // Set invoice as expired
        const result = await repo.platformSetActiveButExpiredInvoiceAsExpired({
          invoiceId: invoiceResult.id,
          expiredDate,
        });

        equal(result.id, invoiceResult.id);
        equal(result.status, 'Expired');
        equal(result.expiredDate.getTime(), expiredDate.getTime());

        // Verify that the invoice details reflect the change
        const updatedInvoice = await repo.userViewsInvoiceDetails({
          invoiceId: invoiceResult.id,
        });

        equal(updatedInvoice.status, 'Expired');
        equal(updatedInvoice.expiredDate?.getTime(), expiredDate.getTime());
      });

      it('should throw error when setting non-active invoice as expired', async function () {
        // Create test user who has a paid invoice
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'paidinvoiceuser@test.com', name: 'Paid Invoice User' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create invoice
        const invoiceResult = await repo.testCreatesInvoice({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '1000000',
          walletDerivationPath: "m/44'/60'/0'/0/25",
          walletAddress: '0x6234567890123456789012345678901234567890',
          invoiceType: 'LoanCollateral',
          invoiceDate: new Date('2024-01-01T10:00:00Z'),
        });

        // Set invoice as paid
        await repo.testUpdatesInvoiceStatus({
          invoiceId: invoiceResult.id,
          status: 'Paid',
        });

        // Try to set paid invoice as expired (should fail)
        let errorThrown = false;
        try {
          await repo.platformSetActiveButExpiredInvoiceAsExpired({
            invoiceId: invoiceResult.id,
            expiredDate: new Date('2024-01-01T12:00:00Z'),
          });
        } catch (error) {
          errorThrown = true;
          ok(error.message.includes('Invoice not found or cannot be expired'));
        }
        ok(errorThrown, 'Expected error when trying to expire non-active invoice');
      });

      it('should throw error when setting non-existent invoice as expired', async function () {
        let errorThrown = false;
        try {
          await repo.platformSetActiveButExpiredInvoiceAsExpired({
            invoiceId: '999999',
            expiredDate: new Date('2024-01-01T12:00:00Z'),
          });
        } catch (error) {
          errorThrown = true;
          ok(error.message.includes('Invoice not found or cannot be expired'));
        }
        ok(errorThrown, 'Expected error when trying to expire non-existent invoice');
      });

      it('should handle pagination for viewing active but expired invoices', async function () {
        // Create test users with multiple expired invoices
        const userCreationResult = await repo.testCreatesUsers({
          users: [
            { email: 'pagination1@test.com', name: 'Pagination User 1' },
            { email: 'pagination2@test.com', name: 'Pagination User 2' },
            { email: 'pagination3@test.com', name: 'Pagination User 3' },
          ],
        });

        const baseDate = new Date('2024-01-01T10:00:00Z');
        const invoiceDate1 = new Date('2024-01-01T04:00:00Z'); // Created earlier
        const invoiceDate2 = new Date('2024-01-01T05:00:00Z'); // Created earlier
        const invoiceDate3 = new Date('2024-01-01T06:00:00Z'); // Created earlier
        const dueDatePast1 = new Date('2024-01-01T06:00:00Z');
        const dueDatePast2 = new Date('2024-01-01T07:00:00Z');
        const dueDatePast3 = new Date('2024-01-01T08:00:00Z');

        // Create 3 expired invoices with different due dates
        await repo.testCreatesInvoice({
          userId: userCreationResult.users[0].id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '1000000',
          walletDerivationPath: "m/44'/60'/0'/0/26",
          walletAddress: '0x7234567890123456789012345678901234567890',
          invoiceType: 'LoanCollateral',
          invoiceDate: invoiceDate1,
          dueDate: dueDatePast1,
        });

        await repo.testCreatesInvoice({
          userId: userCreationResult.users[1].id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '2000000',
          walletDerivationPath: "m/44'/60'/0'/0/27",
          walletAddress: '0x8234567890123456789012345678901234567890',
          invoiceType: 'LoanRepayment',
          invoiceDate: invoiceDate2,
          dueDate: dueDatePast2,
        });

        await repo.testCreatesInvoice({
          userId: userCreationResult.users[2].id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          invoicedAmount: '3000000',
          walletDerivationPath: "m/44'/60'/0'/0/28",
          walletAddress: '0x9234567890123456789012345678901234567890',
          invoiceType: 'LoanPrincipal',
          invoiceDate: invoiceDate3,
          dueDate: dueDatePast3,
        });

        // Test first page with limit 2
        const firstPage = await repo.platformViewsActiveButExpiredInvoices({
          asOfDate: baseDate,
          limit: 2,
          offset: 0,
        });

        equal(firstPage.invoices.length, 2);
        equal(firstPage.totalCount, 3);
        equal(firstPage.hasMore, true);

        // Test second page
        const secondPage = await repo.platformViewsActiveButExpiredInvoices({
          asOfDate: baseDate,
          limit: 2,
          offset: 2,
        });

        equal(secondPage.invoices.length, 1);
        equal(secondPage.totalCount, 3);
        equal(secondPage.hasMore, false);

        // Verify ordering (should be by due_date ASC)
        equal(firstPage.invoices[0].dueDate?.getTime(), dueDatePast1.getTime());
        equal(firstPage.invoices[1].dueDate?.getTime(), dueDatePast2.getTime());
        equal(secondPage.invoices[0].dueDate?.getTime(), dueDatePast3.getTime());
      });
    });

    describe('Withdrawal Management', function () {
      it('should register withdrawal beneficiary', async function () {
        // Create test user who wants to register withdrawal address
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'withdrawer@test.com', name: 'Test Withdrawer' }],
        });

        const userId = userCreationResult.users[0].id;
        const address = '0x4234567890123456789012345678901234567890';

        const result = await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'eip155:56',
          address,
        });

        equal(result.userId, userId);
        equal(result.blockchainKey, 'eip155:56');
        equal(result.address, address);
        equal(typeof result.id, 'string');
      });

      it('should view user withdrawal beneficiaries', async function () {
        // Create test user who has multiple withdrawal beneficiaries
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'multibeneficiaryuser@test.com', name: 'Multi Beneficiary User' }],
        });

        const userId = userCreationResult.users[0].id;

        // Register multiple beneficiaries
        await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'eip155:56',
          address: '0x5234567890123456789012345678901234567890',
        });

        await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0w21',
        });

        const result = await repo.userViewsWithdrawalBeneficiaries({ userId });

        equal(result.beneficiaries.length, 2);
        result.beneficiaries.forEach(beneficiary => {
          equal(beneficiary.userId, userId);
          equal(typeof beneficiary.id, 'string');
          ok(
            ['eip155:56', 'bip122:000000000019d6689c085ae165831e93'].includes(
              beneficiary.blockchainKey,
            ),
          );
        });
      });

      it('should return empty array for user with no beneficiaries', async function () {
        const result = await repo.userViewsWithdrawalBeneficiaries({ userId: '999' });
        equal(result.beneficiaries.length, 0);
      });

      it('should request withdrawal', async function () {
        // Create test user who wants to withdraw funds
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'withdrawalrequester@test.com', name: 'Withdrawal Requester' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T09:00:00Z',
              amount: '1000000',
            },
          ],
        });

        // Register beneficiary first
        const beneficiaryResult = await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'eip155:56',
          address: '0x6234567890123456789012345678901234567822',
        });

        const requestDate = new Date('2024-01-01T03:00:00Z');
        const result = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          amount: '500000',
          requestDate,
        });

        equal(result.beneficiaryId, beneficiaryResult.id);
        equal(result.amount, '500000');
        equal(result.requestAmount, '500000');
        equal(result.status, 'Requested');
        equal(result.requestDate.getTime(), requestDate.getTime());
        equal(typeof result.id, 'string');
      });

      it('should process withdrawal with sent status', async function () {
        // Create test user whose withdrawal will be sent
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'sentwithdrawaluser@test.com', name: 'Sent Withdrawal User' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T09:00:00Z',
              amount: '2000000',
            },
          ],
        });

        const beneficiaryResult = await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'eip155:56',
          address: '0x7234567890123456789012345678901234567823',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          amount: '1000000',
          requestDate: new Date('2024-01-01T10:00:00Z'),
        });

        const sentDate = new Date('2024-01-01T11:00:00Z');
        const result = await repo.platformSendsWithdrawal({
          withdrawalId: withdrawalResult.id,
          sentAmount: '950000', // After fees
          sentHash: '0xdef1234567890abcdef1234567890abcdef1234567890abcdef123456789',
          sentDate,
        });

        equal(result.id, withdrawalResult.id);
        equal(result.status, 'Sent');
        equal(result.sentAmount, '950000');
        equal(result.sentHash, '0xdef1234567890abcdef1234567890abcdef1234567890abcdef123456789');
        equal(result.sentDate?.getTime(), sentDate.getTime());
      });

      it('should process withdrawal with confirmed status', async function () {
        // Create test user whose withdrawal will be confirmed
        const userCreationResult = await repo.testCreatesUsers({
          users: [
            {
              email: 'confirmedwithdrawaluser@test.com',
              name: 'Confirmed Withdrawal User',
            },
          ],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T09:00:00Z',
              amount: '20000000', // 0.2 BTC in satoshis
            },
          ],
        });

        const beneficiaryResult = await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          amount: '10000000', // 0.1 BTC in satoshis
          requestDate: new Date('2024-01-01T10:00:00Z'),
        });

        // First set to sent
        await repo.platformSendsWithdrawal({
          withdrawalId: withdrawalResult.id,
          sentAmount: '9500000', // 0.095 BTC in satoshis
          sentHash: '0xabc1234567890abcdef1234567890abcdef1234567890abcdef123456789',
          sentDate: new Date('2024-01-01T11:00:00Z'),
        });

        // Then confirm
        const confirmedDate = new Date('2024-01-01T12:00:00Z');
        const result = await repo.platformConfirmsWithdrawal({
          withdrawalId: withdrawalResult.id,
          confirmedDate,
        });

        equal(result.status, 'Confirmed');
        equal(result.confirmedDate?.getTime(), confirmedDate.getTime());
      });

      it('should process withdrawal with failed status', async function () {
        // Create test user whose withdrawal will fail
        const userCreationResult = await repo.testCreatesUsers({
          users: [{ email: 'failedwithdrawaluser@test.com', name: 'Failed Withdrawal User' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T09:00:00Z',
              amount: '5000000',
            },
          ],
        });

        const beneficiaryResult = await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'eip155:56',
          address: '0x8234567890123456789012345678901234567825',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          amount: '2000000',
          requestDate: new Date('2024-01-01T10:00:00Z'),
        });

        const failedDate = new Date('2024-01-01T11:30:00Z');
        const result = await repo.platformFailsWithdrawal({
          withdrawalId: withdrawalResult.id,
          failedDate,
          failureReason: 'Insufficient platform wallet balance',
        });

        equal(result.status, 'Failed');
        equal(result.failedDate?.getTime(), failedDate.getTime());
        equal(result.failureReason, 'Insufficient platform wallet balance');
      });

      it('should throw error when processing non-existent withdrawal', async function () {
        let errorThrown = false;
        try {
          await repo.platformSendsWithdrawal({
            withdrawalId: '999',
            sentAmount: '100000',
            sentHash: '0x123',
            sentDate: new Date(),
          });
        } catch (error) {
          errorThrown = true;
          ok(error.message.includes('Withdrawal send update failed'));
        }
        ok(errorThrown, 'Expected error for non-existent withdrawal');
      });

      it('should approve withdrawal refund', async function () {
        // Create test user whose withdrawal refund needs approval and admin reviewer
        const userCreationResult = await repo.testCreatesUsers({
          users: [
            { email: 'refunduser@test.com', name: 'Refund User' },
            { email: 'reviewer100@test.com', name: 'Test Reviewer 100', role: 'Admin' },
          ],
        });

        const userId = userCreationResult.users[0].id;
        const reviewerUserId = userCreationResult.users[1].id;

        // Create user account and add balance first
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T09:00:00Z',
              amount: '3000000',
            },
          ],
        });

        const beneficiaryResult = await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'eip155:56',
          address: '0x9234567890123456789012345678901234567826',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          amount: '1500000',
          requestDate: new Date('2024-01-01T10:00:00Z'),
        });

        // Set withdrawal to failed first
        await repo.platformFailsWithdrawal({
          withdrawalId: withdrawalResult.id,
          failedDate: new Date('2024-01-01T11:30:00Z'),
          failureReason: 'Network congestion',
        });

        const approvalDate = new Date('2024-01-02T10:00:00Z');
        const result = await repo.adminApprovesWithdrawalRefund({
          withdrawalId: withdrawalResult.id,
          reviewerUserId,
          approvalDate,
        });

        equal(result.id, withdrawalResult.id);
        equal(result.status, 'RefundApproved');
        equal(result.failureRefundApprovedDate?.getTime(), approvalDate.getTime());
      });

      it('should reject withdrawal refund', async function () {
        // Create test user whose withdrawal refund will be rejected and admin reviewer
        const userCreationResult = await repo.testCreatesUsers({
          users: [
            { email: 'rejectedrefunduser@test.com', name: 'Rejected Refund User' },
            { email: 'reviewer101@test.com', name: 'Test Reviewer 101', role: 'Admin' },
          ],
        });

        const userId = userCreationResult.users[0].id;
        const reviewerUserId = userCreationResult.users[1].id;

        // Create user account and add balance first
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T09:00:00Z',
              amount: '50000000', // 0.5 BTC in satoshis
            },
          ],
        });

        const beneficiaryResult = await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0w27',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          amount: '20000000', // 0.2 BTC in satoshis
          requestDate: new Date('2024-01-01T10:00:00Z'),
        });

        // Set withdrawal to failed first
        await repo.platformFailsWithdrawal({
          withdrawalId: withdrawalResult.id,
          failedDate: new Date('2024-01-01T11:30:00Z'),
          failureReason: 'Invalid address',
        });

        const rejectionDate = new Date('2024-01-02T10:00:00Z');
        const rejectionReason = 'User provided invalid address';

        const result = await repo.adminRejectsWithdrawalRefund({
          withdrawalId: withdrawalResult.id,
          reviewerUserId,
          rejectionReason,
          rejectionDate,
        });

        equal(result.id, withdrawalResult.id);
        equal(result.status, 'RefundRejected');
        equal(result.failureRefundRejectedDate?.getTime(), rejectionDate.getTime());
      });

      it('should throw error when approving refund for non-failed withdrawal', async function () {
        // Create test user and admin reviewer for error scenario
        const userCreationResult = await repo.testCreatesUsers({
          users: [
            { email: 'errorrefunduser@test.com', name: 'Error Refund User' },
            { email: 'reviewer102@test.com', name: 'Test Reviewer 102', role: 'Admin' },
          ],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.testCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.testCreatesAccountMutations({
          accountId: accountResult.id,
          mutations: [
            {
              mutationType: 'InvoiceReceived',
              mutationDate: '2024-01-01T09:00:00Z',
              amount: '2000000',
            },
          ],
        });

        const beneficiaryResult = await repo.userRegistersWithdrawalBeneficiary({
          userId,
          blockchainKey: 'eip155:56',
          address: '0xa234567890123456789012345678901234567828',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          amount: '800000',
          requestDate: new Date('2024-01-01T10:00:00Z'),
        });

        // Don't set to failed, keep as 'Requested'
        let errorThrown = false;
        try {
          await repo.adminApprovesWithdrawalRefund({
            withdrawalId: withdrawalResult.id,
            reviewerUserId: userCreationResult.users[1].id,
            approvalDate: new Date('2024-01-02T10:00:00Z'),
          });
        } catch (error) {
          errorThrown = true;
          ok(error.message.includes('Withdrawal refund approval failed'));
        }
        ok(errorThrown, 'Expected error when approving refund for non-failed withdrawal');
      });
    });

    describe('Currency Management', function () {
      it('should retrieve all supported currencies', async function () {
        const result = await repo.userViewsCurrencies({ type: 'all' });

        // Should return currencies from the schema (BTC, ETH, BNB, SOL as collateral + USDT as loan currency)
        ok(result.currencies.length >= 5, 'Should have at least 5 currencies from schema');

        // Check if BTC collateral currency is present
        const btcCurrency = result.currencies.find(
          c => c.symbol === 'BTC' && c.isCollateralCurrency,
        );
        ok(btcCurrency, 'BTC collateral currency should exist');
        equal(btcCurrency.blockchainKey, 'bip122:000000000019d6689c085ae165831e93');
        equal(btcCurrency.tokenId, 'slip44:0');
        equal(btcCurrency.maxLtv, 60.0);
        ok(btcCurrency.blockchain, 'Should include blockchain info');
        equal(btcCurrency.blockchain.name, 'Bitcoin');

        // Check if USDC loan currencies are present (can be on multiple blockchains)
        const usdcCurrencies = result.currencies.filter(
          c => c.symbol === 'USDC' && c.isLoanCurrency,
        );
        ok(usdcCurrencies.length > 0, 'USDC loan currency should exist');

        // Verify all USDC currencies are loan currencies
        for (const usdcCurrency of usdcCurrencies) {
          equal(usdcCurrency.isCollateralCurrency, false);
          equal(usdcCurrency.isLoanCurrency, true);
          equal(usdcCurrency.maxLtv, 0);
          // USDC can be on various blockchains (BSC, Ethereum Sepolia, Solana Devnet, etc.)
          ok(usdcCurrency.blockchainKey, 'USDC should have a blockchain key');
        }
      });

      it('should filter currencies by collateral type', async function () {
        const result = await repo.userViewsCurrencies({ type: 'collateral' });

        ok(result.currencies.length > 0, 'Should have collateral currencies');

        // All returned currencies should be collateral currencies
        for (const currency of result.currencies) {
          equal(currency.isCollateralCurrency, true);
          ok(currency.maxLtv > 0, 'Collateral currencies should have max LTV > 0');
        }

        // Should include BTC, ETH, BNB, SOL
        const symbols = result.currencies.map(c => c.symbol);
        ok(symbols.includes('BTC'), 'Should include BTC');
        ok(symbols.includes('ETH'), 'Should include ETH');
        ok(symbols.includes('BNB'), 'Should include BNB');
        ok(symbols.includes('SOL'), 'Should include SOL');
      });

      it('should filter currencies by loan type', async function () {
        const result = await repo.userViewsCurrencies({ type: 'loan' });

        ok(result.currencies.length > 0, 'Should have loan currencies');

        // All returned currencies should be loan currencies
        for (const currency of result.currencies) {
          equal(currency.isLoanCurrency, true);
          equal(currency.maxLtv, 0, 'Loan currencies should have max LTV = 0');
          ok(
            ['USDC', 'USDT', 'USD'].includes(currency.symbol),
            'Loan currencies should be USDT-based',
          );
        }
      });

      it('should filter currencies by blockchain key', async function () {
        const result = await repo.userViewsCurrencies({
          blockchainKey: 'eip155:1',
        });

        ok(result.currencies.length > 0, 'Should have currencies for Ethereum');

        // All returned currencies should be on Ethereum network
        for (const currency of result.currencies) {
          equal(currency.blockchainKey, 'eip155:1');
          equal(currency.blockchain.key, 'eip155:1');
        }
      });

      it('should filter currencies by LTV range', async function () {
        const result = await repo.userViewsCurrencies({
          minLtv: 60,
          maxLtv: 70,
        });

        ok(result.currencies.length > 0, 'Should have currencies in LTV range');

        // All returned currencies should be within the LTV range
        for (const currency of result.currencies) {
          ok(currency.maxLtv >= 60, 'Currency max LTV should be >= 60');
          ok(currency.maxLtv <= 70, 'Currency max LTV should be <= 70');
        }
      });

      it('should return currencies with proper blockchain information', async function () {
        const result = await repo.userViewsCurrencies({ type: 'all' });

        ok(result.currencies.length > 0, 'Should have currencies');

        // Check that each currency has complete blockchain information
        for (const currency of result.currencies) {
          ok(currency.blockchain, 'Should have blockchain info');
          ok(currency.blockchain.key, 'Should have blockchain key');
          ok(currency.blockchain.name, 'Should have blockchain name');
          ok(currency.blockchain.shortName, 'Should have blockchain short name');
          ok(currency.blockchain.image, 'Should have blockchain image URL');

          // Blockchain key should match currency's blockchain key
          equal(currency.blockchain.key, currency.blockchainKey);
        }
      });

      it('should return currencies ordered with collateral currencies first', async function () {
        const result = await repo.userViewsCurrencies({ type: 'all' });

        ok(result.currencies.length > 0, 'Should have currencies');

        let foundLoanCurrency = false;
        for (const currency of result.currencies) {
          if (foundLoanCurrency && currency.isCollateralCurrency) {
            throw new Error('Collateral currencies should come before loan currencies');
          }
          if (currency.isLoanCurrency) {
            foundLoanCurrency = true;
          }
        }
      });
    });
  });
}
