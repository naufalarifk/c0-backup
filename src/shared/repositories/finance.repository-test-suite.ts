import { equal, ok } from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, suite } from 'node:test';

import { FinanceRepository } from './finance.repository';

export async function runFinanceRepositoryTestSuite(
  createRepo: () => Promise<FinanceRepository>,
  teardownRepo: (repo: FinanceRepository) => Promise<void>,
): Promise<void> {
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'accountholder@test.com', name: 'Account Holder' }],
        });

        const _userId = userCreationResult.users[0].id;
        const currencyBlockchainKey = 'eip155:56';
        const currencyTokenId = 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d';

        const result = await repo.platformCreatesUserAccount({
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'duplicateuser@test.com', name: 'Duplicate User' }],
        });

        const userId = userCreationResult.users[0].id;
        const currencyBlockchainKey = 'bip122:000000000019d6689c085ae165831e93';
        const currencyTokenId = 'slip44:0';

        // Create account first time
        const firstResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey,
          currencyTokenId,
          accountType: 'User',
        });

        // Create account second time with same account type (should upsert)
        const secondResult = await repo.platformCreatesUserAccount({
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'multiaccountuser@test.com', name: 'Multi Account User' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create multiple accounts
        await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        await repo.platformCreatesUserAccount({
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'transactionuser@test.com', name: 'Transaction User' }],
        });

        const userId = userCreationResult.users[0].id;
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Create some test mutations (this would normally be done by other flows)
        await repo.systemCreatesTestAccountMutations({
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'filtereduser@test.com', name: 'Filtered User' }],
        });

        const userId = userCreationResult.users[0].id;
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Create test mutations
        await repo.systemCreatesTestAccountMutations({
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'datefilteruser@test.com', name: 'Date Filter User' }],
        });

        const userId = userCreationResult.users[0].id;
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Create test mutations
        await repo.systemCreatesTestAccountMutations({
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'borrower@test.com', name: 'Test Borrower' }],
        });

        const userId = userCreationResult.users[0].id;
        const invoiceDate = new Date('2024-01-01T03:00:00Z');
        const dueDate = new Date('2024-01-02T03:00:00Z');

        const result = await repo.platformCreatesInvoice({
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'principalborrower@test.com', name: 'Principal Borrower' }],
        });

        const userId = userCreationResult.users[0].id;
        const invoiceDate = new Date('2024-01-01T10:00:00Z');

        const result = await repo.platformCreatesInvoice({
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'invoicepayer@test.com', name: 'Invoice Payer' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account first (needed for invoice payment triggers)
        await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        const invoiceResult = await repo.platformCreatesInvoice({
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
        const paymentResult = await repo.blockchainDetectsInvoicePayment({
          invoiceId: invoiceResult.id,
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'expiredinvoiceuser@test.com', name: 'Expired Invoice User' }],
        });

        const userId = userCreationResult.users[0].id;
        const invoiceResult = await repo.platformCreatesInvoice({
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

        const result = await repo.platformUpdatesInvoiceStatus({
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
          await repo.platformUpdatesInvoiceStatus({
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'invoiceviewer@test.com', name: 'Invoice Viewer' }],
        });

        const userId = userCreationResult.users[0].id;
        const invoiceDate = new Date('2024-01-01T03:00:00Z');
        const dueDate = new Date('2024-01-02T03:00:00Z');

        const invoiceResult = await repo.platformCreatesInvoice({
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
    });

    describe('Withdrawal Management', function () {
      it('should register withdrawal beneficiary', async function () {
        // Create test user who wants to register withdrawal address
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'withdrawer@test.com', name: 'Test Withdrawer' }],
        });

        const userId = userCreationResult.users[0].id;
        const address = '0x4234567890123456789012345678901234567890';

        const result = await repo.userRegistersWithdrawalBeneficiary({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          address,
        });

        equal(result.userId, userId);
        equal(result.currencyBlockchainKey, 'eip155:56');
        equal(result.currencyTokenId, 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d');
        equal(result.address, address);
        equal(typeof result.id, 'string');
      });

      it('should view user withdrawal beneficiaries', async function () {
        // Create test user who has multiple withdrawal beneficiaries
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'multibeneficiaryuser@test.com', name: 'Multi Beneficiary User' }],
        });

        const userId = userCreationResult.users[0].id;

        // Register multiple beneficiaries
        await repo.userRegistersWithdrawalBeneficiary({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          address: '0x5234567890123456789012345678901234567890',
        });

        await repo.userRegistersWithdrawalBeneficiary({
          userId,
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0w21',
        });

        const result = await repo.userViewsWithdrawalBeneficiaries({ userId });

        equal(result.beneficiaries.length, 2);
        result.beneficiaries.forEach(beneficiary => {
          equal(beneficiary.userId, userId);
          equal(typeof beneficiary.id, 'string');
          ok(
            ['eip155:56', 'bip122:000000000019d6689c085ae165831e93'].includes(
              beneficiary.currencyBlockchainKey,
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'withdrawalrequester@test.com', name: 'Withdrawal Requester' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.systemCreatesTestAccountMutations({
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
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          address: '0x6234567890123456789012345678901234567822',
        });

        const requestDate = new Date('2024-01-01T03:00:00Z');
        const result = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'sentwithdrawaluser@test.com', name: 'Sent Withdrawal User' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.systemCreatesTestAccountMutations({
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
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          address: '0x7234567890123456789012345678901234567823',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [
            {
              email: 'confirmedwithdrawaluser@test.com',
              name: 'Confirmed Withdrawal User',
            },
          ],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.systemCreatesTestAccountMutations({
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
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [{ email: 'failedwithdrawaluser@test.com', name: 'Failed Withdrawal User' }],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.systemCreatesTestAccountMutations({
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
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          address: '0x8234567890123456789012345678901234567825',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [
            { email: 'refunduser@test.com', name: 'Refund User' },
            { email: 'reviewer100@test.com', name: 'Test Reviewer 100', role: 'Admin' },
          ],
        });

        const userId = userCreationResult.users[0].id;
        const reviewerUserId = userCreationResult.users[1].id;

        // Create user account and add balance first
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.systemCreatesTestAccountMutations({
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
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          address: '0x9234567890123456789012345678901234567826',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [
            { email: 'rejectedrefunduser@test.com', name: 'Rejected Refund User' },
            { email: 'reviewer101@test.com', name: 'Test Reviewer 101', role: 'Admin' },
          ],
        });

        const userId = userCreationResult.users[0].id;
        const reviewerUserId = userCreationResult.users[1].id;

        // Create user account and add balance first
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.systemCreatesTestAccountMutations({
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
          currencyBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          currencyTokenId: 'slip44:0',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0w27',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
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
        const userCreationResult = await repo.systemCreatesTestUsers({
          users: [
            { email: 'errorrefunduser@test.com', name: 'Error Refund User' },
            { email: 'reviewer102@test.com', name: 'Test Reviewer 102', role: 'Admin' },
          ],
        });

        const userId = userCreationResult.users[0].id;

        // Create user account and add balance first
        const accountResult = await repo.platformCreatesUserAccount({
          userId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          accountType: 'User',
        });

        // Add balance by creating a test mutation
        await repo.systemCreatesTestAccountMutations({
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
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          address: '0xa234567890123456789012345678901234567828',
        });

        const withdrawalResult = await repo.userRequestsWithdrawal({
          beneficiaryId: beneficiaryResult.id,
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

    describe('Exchange Rate Management', function () {
      it('should retrieve exchange rates with filters', async function () {
        // First create some test data with valid currency combinations on same blockchain
        await repo.systemCreatesTestPriceFeeds({
          priceFeeds: [
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:60',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:60',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'coinbase',
            },
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:714',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'coinbase',
            },
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:501',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
          ],
        });

        const ethBinancePriceFeedResult = await repo.systemFindsTestPriceFeedId({
          blockchainKey: 'crosschain',
          baseCurrencyTokenId: 'slip44:60',
          quoteCurrencyTokenId: 'iso4217:usd',
          source: 'binance',
        });
        const ethBinancePriceFeedId = ethBinancePriceFeedResult.id;

        const ethCoinbasePriceFeedResult = await repo.systemFindsTestPriceFeedId({
          blockchainKey: 'crosschain',
          baseCurrencyTokenId: 'slip44:60',
          quoteCurrencyTokenId: 'iso4217:usd',
          source: 'coinbase',
        });
        const ethCoinbasePriceFeedId = ethCoinbasePriceFeedResult.id;

        await repo.systemCreatesTestExchangeRates({
          exchangeRates: [
            {
              priceFeedId: ethBinancePriceFeedId,
              bidPrice: '2999.00',
              askPrice: '3009.00',
              retrievalDate: '2024-01-01T10:00:00Z',
              sourceDate: '2024-01-01T09:59:30Z',
            },
            {
              priceFeedId: ethCoinbasePriceFeedId,
              bidPrice: '3000.00',
              askPrice: '3010.00',
              retrievalDate: '2024-01-01T10:00:00Z',
              sourceDate: '2024-01-01T09:59:30Z',
            },
          ],
        });

        const result = await repo.platformRetrievesExchangeRates({
          blockchainKey: 'crosschain',
          baseCurrencyTokenId: 'slip44:60',
        });

        equal(result.exchangeRates.length, 2);
        const binanceRate = result.exchangeRates.find(r => r.source === 'binance');
        ok(binanceRate, 'Binance rate should exist');
        equal(binanceRate.blockchain, 'crosschain');
        equal(binanceRate.baseCurrency, 'slip44:60');
        equal(binanceRate.quoteCurrency, 'iso4217:usd');
        equal(binanceRate.bidPrice, '2999.000000000000');
        equal(binanceRate.askPrice, '3009.000000000000');
        equal(binanceRate.source, 'binance');
        equal(typeof binanceRate.id, 'string');
        ok(binanceRate.retrievalDate instanceof Date);
        ok(binanceRate.sourceDate instanceof Date);
      });

      it('should retrieve all exchange rates without filters', async function () {
        // Create test data with valid currency combinations
        await repo.systemCreatesTestPriceFeeds({
          priceFeeds: [
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:60',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:714',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
          ],
        });

        const ethPriceFeedId = (
          await repo.systemFindsTestPriceFeedId({
            blockchainKey: 'crosschain',
            baseCurrencyTokenId: 'slip44:60',
            quoteCurrencyTokenId: 'iso4217:usd',
          })
        ).id;

        const bnbPriceFeedId = (
          await repo.systemFindsTestPriceFeedId({
            blockchainKey: 'crosschain',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'iso4217:usd',
          })
        ).id;

        await repo.systemCreatesTestExchangeRates({
          exchangeRates: [
            {
              priceFeedId: ethPriceFeedId,
              bidPrice: '3000.00',
              askPrice: '3010.00',
              retrievalDate: '2024-01-01T10:00:00Z',
              sourceDate: '2024-01-01T09:59:30Z',
            },
            {
              priceFeedId: bnbPriceFeedId,
              bidPrice: '500.00',
              askPrice: '502.00',
              retrievalDate: '2024-01-01T10:00:00Z',
              sourceDate: '2024-01-01T09:59:30Z',
            },
          ],
        });

        const result = await repo.platformRetrievesExchangeRates({});

        // Should include at least the rates from this test
        ok(result.exchangeRates.length >= 2);

        const ethRate = result.exchangeRates.find(r => r.baseCurrency === 'slip44:60');
        const bnbRate = result.exchangeRates.find(r => r.baseCurrency === 'slip44:714');

        ok(ethRate, 'ETH rate should exist');
        ok(bnbRate, 'BNB rate should exist');
      });

      it('should return empty array when no matching exchange rates', async function () {
        const result = await repo.platformRetrievesExchangeRates({
          blockchainKey: 'nonexistent',
        });

        equal(result.exchangeRates.length, 0);
      });

      it('should update exchange rate', async function () {
        // First create a price feed for testing with valid currency combination
        await repo.systemCreatesTestPriceFeeds({
          priceFeeds: [
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:60',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
          ],
        });

        // Get the price feed
        const priceFeedResult = await repo.systemFindsTestPriceFeedId({
          blockchainKey: 'crosschain',
          baseCurrencyTokenId: 'slip44:60',
          quoteCurrencyTokenId: 'iso4217:usd',
        });
        const priceFeedId = priceFeedResult.id;

        const retrievalDate = new Date('2024-01-01T11:00:00Z');
        const sourceDate = new Date('2024-01-01T10:59:30Z');

        const result = await repo.platformUpdatesExchangeRate({
          priceFeedId,
          bidPrice: '3100.00',
          askPrice: '3110.00',
          retrievalDate,
          sourceDate,
        });

        equal(result.priceFeedId, priceFeedId);
        equal(result.bidPrice, '3100.000000000000');
        equal(result.askPrice, '3110.000000000000');
        equal(result.retrievalDate.getTime(), retrievalDate.getTime());
        equal(result.sourceDate.getTime(), sourceDate.getTime());
        equal(typeof result.id, 'string');
      });
    });
  });
}
