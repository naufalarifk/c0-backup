import type { BlockchainBalance } from '../../modules/settlement/types/settlement.types';

import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isBoolean,
  isNullable,
  isString,
} from 'typeshaper';

import { LoanPlatformRepository } from './loan-platform.repository';

/**
 * Settlement result from database
 */
export interface SettlementLogRecord {
  id: string;
  blockchainKey: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  originalBalance: string;
  settlementAmount: string;
  remainingBalance: string;
  transactionHash: string | null;
  senderAddress: string | null;
  recipientAddress: string;
  binanceAsset: string | null;
  binanceNetwork: string | null;
  status: 'Pending' | 'Sent' | 'Verified' | 'Failed';
  success: boolean;
  errorMessage: string | null;
  settledAt: Date;
  sentAt: Date | null;
  verifiedAt: Date | null;
  failedAt: Date | null;
  verified: boolean;
  verificationError: string | null;
  verificationDetails: unknown | null;
}

/**
 * Parameters for storing settlement results
 */
export interface StoreSettlementResultParams {
  blockchainKey: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  originalBalance: string;
  settlementAmount: string;
  remainingBalance: string;
  transactionHash: string | null;
  senderAddress: string | null;
  recipientAddress: string;
  binanceAsset: string | null;
  binanceNetwork: string | null;
  success: boolean;
  errorMessage: string | null;
  settledAt: Date;
}

/**
 * Parameters for storing settlement verification
 */
export interface StoreSettlementVerificationParams {
  settlementLogId: string;
  blockchainConfirmed: boolean;
  binanceMatched: boolean;
  amountMatches: boolean;
  txHashMatches: boolean;
  senderAddressMatches: boolean;
  recipientAddressMatches: boolean;
  binanceDepositId: string | null;
  binanceStatus: string | null;
  binanceConfirmations: string | null;
  binanceInsertTime: number | null;
  overallMatched: boolean;
  verificationMessage: string;
  verificationErrors: string[];
  verificationAttempt: number;
}

/**
 * Settlement verification record from database
 */
export interface SettlementVerificationRecord {
  id: string;
  settlementLogId: string;
  blockchainConfirmed: boolean;
  binanceMatched: boolean;
  amountMatches: boolean;
  txHashMatches: boolean;
  senderAddressMatches: boolean;
  recipientAddressMatches: boolean;
  binanceDepositId: string | null;
  binanceStatus: string | null;
  binanceConfirmations: string | null;
  overallMatched: boolean;
  verificationMessage: string;
  verificationErrors: string[];
  verifiedAt: Date;
  verificationAttempt: number;
}

/**
 * Settlement log with verification details (from view)
 */
export interface SettlementLogWithVerification extends SettlementLogRecord {
  currencySymbol: string | null;
  currencyDecimals: number | null;
  verificationId: string | null;
  overallMatched: boolean | null;
  txHashMatches: boolean | null;
  senderAddressMatches: boolean | null;
  recipientAddressMatches: boolean | null;
  amountMatches: boolean | null;
  binanceStatus: string | null;
  verificationErrors: string[] | null;
  verificationAttempt: number | null;
}

/**
 * Settlement statistics by currency (from view)
 */
export interface SettlementStatsByCurrency {
  currencyBlockchainKey: string;
  currencyTokenId: string;
  currencySymbol: string | null;
  currencyDecimals: number | null;
  totalSettlements: number;
  verifiedCount: number;
  failedCount: number;
  pendingCount: number;
  totalAmountSettled: string;
  totalAmountVerified: string;
  firstSettlement: Date | null;
  lastSettlement: Date | null;
}

/**
 * SettlementPlatformRepository
 *
 * Contains all settlement-related database queries for the platform.
 * Handles hot wallet balance queries, currency queries, and settlement logging.
 */
export abstract class SettlementPlatformRepository extends LoanPlatformRepository {
  /**
   * Get all hot wallet balances grouped by blockchain and currency
   * Excludes crosschain, target network (Binance), and testnet currencies
   *
   * @returns Array of blockchain balances
   */
  async platformGetsHotWalletBalances(): Promise<BlockchainBalance[]> {
    const balances = await this.sql`
      SELECT 
        a.currency_blockchain_key as blockchain_key,
        SUM(a.balance)::text as total_balance,
        a.currency_token_id
      FROM user_accounts a
      WHERE a.user_id = 1
        AND a.account_type = 'PlatformEscrow'
        AND a.balance > 0
        AND a.currency_blockchain_key NOT IN ('crosschain', 'eip155:56', 'cg:testnet')
        AND a.currency_blockchain_key NOT LIKE 'bip122:000000000933%'
        AND a.currency_blockchain_key NOT LIKE 'eip155:11155111%'
        AND a.currency_blockchain_key NOT LIKE 'eip155:97%'
        AND a.currency_blockchain_key NOT LIKE 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1%'
      GROUP BY a.currency_blockchain_key, a.currency_token_id
      ORDER BY a.currency_blockchain_key, a.currency_token_id
    `;

    // Validate and map the results
    assertArrayMapOf(balances, b => {
      assertDefined(b);
      assertPropString(b, 'blockchain_key');
      assertPropString(b, 'total_balance');
      assertPropString(b, 'currency_token_id');
      return b;
    });

    return balances.map(b => ({
      blockchainKey: b.blockchain_key,
      balance: b.total_balance,
      currency: b.currency_token_id,
    }));
  }

  /**
   * Get target network (Binance) balance for a specific currency
   *
   * @param currencyTokenId The currency token ID to query
   * @returns Total balance as string, or '0' if no balance found
   */
  async platformGetsTargetNetworkBalance(currencyTokenId: string): Promise<string> {
    const result = await this.sql`
      SELECT SUM(balance)::text as total_balance
      FROM user_accounts
      WHERE user_id = 1
        AND account_type = 'PlatformEscrow'
        AND currency_blockchain_key = 'eip155:56'
        AND currency_token_id = ${currencyTokenId}
      GROUP BY currency_token_id
    `;

    if (result.length === 0) {
      return '0';
    }

    assertArrayMapOf(result, r => {
      assertDefined(r);
      assertPropString(r, 'total_balance');
      return r;
    });

    return result[0].total_balance;
  }

  /**
   * Get hot wallet balances for a specific currency across all blockchains
   * Excludes crosschain, target network, and testnet currencies
   *
   * @param currencyTokenId The currency token ID to query
   * @returns Array of balances per blockchain
   */
  async platformGetsHotWalletBalancesForCurrency(currencyTokenId: string): Promise<
    Array<{
      blockchainKey: string;
      balance: string;
    }>
  > {
    const hotWallets = await this.sql`
      SELECT 
        a.currency_blockchain_key as blockchain_key,
        a.balance::text as balance
      FROM user_accounts a
      WHERE a.user_id = 1
        AND a.account_type = 'PlatformEscrow'
        AND a.currency_token_id = ${currencyTokenId}
        AND a.balance > 0
        AND a.currency_blockchain_key NOT IN ('crosschain', 'eip155:56', 'cg:testnet')
        AND a.currency_blockchain_key NOT LIKE 'bip122:000000000933%'
        AND a.currency_blockchain_key NOT LIKE 'eip155:11155111%'
        AND a.currency_blockchain_key NOT LIKE 'eip155:97%'
        AND a.currency_blockchain_key NOT LIKE 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1%'
      ORDER BY a.currency_blockchain_key
    `;

    assertArrayMapOf(hotWallets, hw => {
      assertDefined(hw);
      assertPropString(hw, 'blockchain_key');
      assertPropString(hw, 'balance');
      return hw;
    });

    return hotWallets.map(hw => ({
      blockchainKey: hw.blockchain_key,
      balance: hw.balance,
    }));
  }

  /**
   * Get all unique currencies that have balances in hot wallets
   * Excludes crosschain, target network, and testnet currencies
   *
   * @returns Array of currency token IDs
   */
  async platformGetsCurrenciesWithBalances(): Promise<string[]> {
    const currencies = await this.sql`
      SELECT DISTINCT a.currency_token_id
      FROM user_accounts a
      WHERE a.user_id = 1
        AND a.account_type = 'PlatformEscrow'
        AND a.balance > 0
        AND a.currency_blockchain_key NOT IN ('crosschain', 'eip155:56', 'cg:testnet')
        AND a.currency_blockchain_key NOT LIKE 'bip122:000000000933%'
        AND a.currency_blockchain_key NOT LIKE 'eip155:11155111%'
        AND a.currency_blockchain_key NOT LIKE 'eip155:97%'
        AND a.currency_blockchain_key NOT LIKE 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1%'
      ORDER BY a.currency_token_id
    `;

    assertArrayMapOf(currencies, c => {
      assertDefined(c);
      assertPropString(c, 'currency_token_id');
      return c;
    });

    return currencies.map(c => c.currency_token_id);
  }

  /**
   * Store settlement result in the database for audit trail
   *
   * @param params Settlement result parameters
   * @returns Settlement log ID
   */
  async platformStoresSettlementResult(params: StoreSettlementResultParams): Promise<string> {
    const rows = await this.sql`
      INSERT INTO settlement_logs (
        blockchain_key,
        currency_blockchain_key,
        currency_token_id,
        original_balance,
        settlement_amount,
        remaining_balance,
        transaction_hash,
        sender_address,
        recipient_address,
        binance_asset,
        binance_network,
        status,
        success,
        error_message,
        settled_at,
        sent_at
      ) VALUES (
        ${params.blockchainKey},
        ${params.currencyBlockchainKey},
        ${params.currencyTokenId},
        ${params.originalBalance},
        ${params.settlementAmount},
        ${params.remainingBalance},
        ${params.transactionHash},
        ${params.senderAddress},
        ${params.recipientAddress},
        ${params.binanceAsset},
        ${params.binanceNetwork},
        ${params.success ? 'Sent' : 'Failed'},
        ${params.success},
        ${params.errorMessage},
        ${params.settledAt.toISOString()},
        ${params.success ? params.settledAt.toISOString() : null}
      )
      RETURNING id
    `;

    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertPropString(row, 'id');
      return row;
    });

    return rows[0].id;
  }

  /**
   * Store settlement verification result
   *
   * @param params Verification parameters
   * @returns Verification record ID
   */
  async platformStoresSettlementVerification(
    params: StoreSettlementVerificationParams,
  ): Promise<string> {
    const rows = await this.sql`
      INSERT INTO settlement_verifications (
        settlement_log_id,
        blockchain_confirmed,
        binance_matched,
        amount_matches,
        tx_hash_matches,
        sender_address_matches,
        recipient_address_matches,
        binance_deposit_id,
        binance_status,
        binance_confirmations,
        binance_insert_time,
        overall_matched,
        verification_message,
        verification_errors,
        verification_attempt
      ) VALUES (
        ${params.settlementLogId},
        ${params.blockchainConfirmed},
        ${params.binanceMatched},
        ${params.amountMatches},
        ${params.txHashMatches},
        ${params.senderAddressMatches},
        ${params.recipientAddressMatches},
        ${params.binanceDepositId},
        ${params.binanceStatus},
        ${params.binanceConfirmations},
        ${params.binanceInsertTime},
        ${params.overallMatched},
        ${params.verificationMessage},
        ${JSON.stringify(params.verificationErrors)},
        ${params.verificationAttempt}
      )
      RETURNING id
    `;

    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertPropString(row, 'id');
      return row;
    });

    return rows[0].id;
  }

  /**
   * Get settlement history with optional limit
   *
   * @param limit Maximum number of records to return (default: 100)
   * @returns Array of settlement log records
   */
  async platformGetsSettlementHistory(limit = 100): Promise<SettlementLogRecord[]> {
    const rows = await this.sql`
      SELECT 
        id::text,
        blockchain_key,
        currency_blockchain_key,
        currency_token_id,
        original_balance::text,
        settlement_amount::text,
        remaining_balance::text,
        transaction_hash,
        sender_address,
        recipient_address,
        binance_asset,
        binance_network,
        status,
        success,
        error_message,
        settled_at,
        sent_at,
        verified_at,
        failed_at,
        verified,
        verification_error,
        verification_details
      FROM settlement_logs
      ORDER BY settled_at DESC
      LIMIT ${limit}
    `;

    // Validate and map the results
    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      assertPropString(row, 'original_balance');
      assertPropString(row, 'settlement_amount');
      assertPropString(row, 'remaining_balance');
      assertProp(check(isNullable, isString), row, 'transaction_hash');
      assertProp(check(isNullable, isString), row, 'sender_address');
      assertPropString(row, 'recipient_address');
      assertProp(check(isNullable, isString), row, 'binance_asset');
      assertProp(check(isNullable, isString), row, 'binance_network');
      assertPropString(row, 'status');
      assertProp(isBoolean, row, 'success');
      assertProp(check(isNullable, isString), row, 'error_message');
      assertPropString(row, 'settled_at');
      assertProp(check(isNullable, isString), row, 'sent_at');
      assertProp(check(isNullable, isString), row, 'verified_at');
      assertProp(check(isNullable, isString), row, 'failed_at');
      assertProp(isBoolean, row, 'verified');
      assertProp(check(isNullable, isString), row, 'verification_error');
      return row;
    });

    return rows.map(row => ({
      id: row.id,
      blockchainKey: row.blockchain_key,
      currencyBlockchainKey: row.currency_blockchain_key,
      currencyTokenId: row.currency_token_id,
      originalBalance: row.original_balance,
      settlementAmount: row.settlement_amount,
      remainingBalance: row.remaining_balance,
      transactionHash: row.transaction_hash ?? null,
      senderAddress: row.sender_address ?? null,
      recipientAddress: row.recipient_address,
      binanceAsset: row.binance_asset ?? null,
      binanceNetwork: row.binance_network ?? null,
      status: row.status as 'Pending' | 'Sent' | 'Verified' | 'Failed',
      success: row.success,
      errorMessage: row.error_message ?? null,
      settledAt: new Date(row.settled_at),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      failedAt: row.failed_at ? new Date(row.failed_at) : null,
      verified: row.verified,
      verificationError: row.verification_error ?? null,
      verificationDetails: (row as any).verification_details ?? null,
    }));
  }

  /**
   * Get settlement log by ID
   *
   * @param id Settlement log ID
   * @returns Settlement log record or null if not found
   */
  async platformGetsSettlementLogById(id: string): Promise<SettlementLogRecord | null> {
    const rows = await this.sql`
      SELECT 
        id::text,
        blockchain_key,
        currency_blockchain_key,
        currency_token_id,
        original_balance::text,
        settlement_amount::text,
        remaining_balance::text,
        transaction_hash,
        sender_address,
        recipient_address,
        binance_asset,
        binance_network,
        status,
        success,
        error_message,
        settled_at,
        sent_at,
        verified_at,
        failed_at,
        verified,
        verification_error,
        verification_details
      FROM settlement_logs
      WHERE id = ${id}
    `;

    if (rows.length === 0) {
      return null;
    }

    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      assertPropString(row, 'original_balance');
      assertPropString(row, 'settlement_amount');
      assertPropString(row, 'remaining_balance');
      assertProp(check(isNullable, isString), row, 'transaction_hash');
      assertProp(check(isNullable, isString), row, 'sender_address');
      assertPropString(row, 'recipient_address');
      assertProp(check(isNullable, isString), row, 'binance_asset');
      assertProp(check(isNullable, isString), row, 'binance_network');
      assertPropString(row, 'status');
      assertProp(isBoolean, row, 'success');
      assertProp(check(isNullable, isString), row, 'error_message');
      assertPropString(row, 'settled_at');
      assertProp(check(isNullable, isString), row, 'sent_at');
      assertProp(check(isNullable, isString), row, 'verified_at');
      assertProp(check(isNullable, isString), row, 'failed_at');
      assertProp(isBoolean, row, 'verified');
      assertProp(check(isNullable, isString), row, 'verification_error');
      return row;
    });

    const row = rows[0];
    return {
      id: row.id,
      blockchainKey: row.blockchain_key,
      currencyBlockchainKey: row.currency_blockchain_key,
      currencyTokenId: row.currency_token_id,
      originalBalance: row.original_balance,
      settlementAmount: row.settlement_amount,
      remainingBalance: row.remaining_balance,
      transactionHash: row.transaction_hash ?? null,
      senderAddress: row.sender_address ?? null,
      recipientAddress: row.recipient_address,
      binanceAsset: row.binance_asset ?? null,
      binanceNetwork: row.binance_network ?? null,
      status: row.status as 'Pending' | 'Sent' | 'Verified' | 'Failed',
      success: row.success,
      errorMessage: row.error_message ?? null,
      settledAt: new Date(row.settled_at),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      failedAt: row.failed_at ? new Date(row.failed_at) : null,
      verified: row.verified,
      verificationError: row.verification_error ?? null,
      verificationDetails: (row as any).verification_details ?? null,
    };
  }

  /**
   * Get unverified settlements that need attention
   *
   * @param hours Number of hours to look back (default: 24)
   * @returns Array of unverified settlement records
   */
  async platformGetsUnverifiedSettlements(hours = 24): Promise<SettlementLogRecord[]> {
    const rows = await this.sql`
      SELECT 
        id::text,
        blockchain_key,
        currency_blockchain_key,
        currency_token_id,
        original_balance::text,
        settlement_amount::text,
        remaining_balance::text,
        transaction_hash,
        sender_address,
        recipient_address,
        binance_asset,
        binance_network,
        status,
        success,
        error_message,
        settled_at,
        sent_at,
        verified_at,
        failed_at,
        verified,
        verification_error,
        verification_details
      FROM settlement_logs
      WHERE status IN ('Pending', 'Sent')
        AND settled_at > NOW() - MAKE_INTERVAL(hours => ${hours})
      ORDER BY settled_at DESC
    `;

    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      assertPropString(row, 'original_balance');
      assertPropString(row, 'settlement_amount');
      assertPropString(row, 'remaining_balance');
      assertProp(check(isNullable, isString), row, 'transaction_hash');
      assertProp(check(isNullable, isString), row, 'sender_address');
      assertPropString(row, 'recipient_address');
      assertProp(check(isNullable, isString), row, 'binance_asset');
      assertProp(check(isNullable, isString), row, 'binance_network');
      assertPropString(row, 'status');
      assertProp(isBoolean, row, 'success');
      assertProp(check(isNullable, isString), row, 'error_message');
      assertPropString(row, 'settled_at');
      assertProp(check(isNullable, isString), row, 'sent_at');
      assertProp(check(isNullable, isString), row, 'verified_at');
      assertProp(check(isNullable, isString), row, 'failed_at');
      assertProp(isBoolean, row, 'verified');
      assertProp(check(isNullable, isString), row, 'verification_error');
      return row;
    });

    return rows.map(row => ({
      id: row.id,
      blockchainKey: row.blockchain_key,
      currencyBlockchainKey: row.currency_blockchain_key,
      currencyTokenId: row.currency_token_id,
      originalBalance: row.original_balance,
      settlementAmount: row.settlement_amount,
      remainingBalance: row.remaining_balance,
      transactionHash: row.transaction_hash ?? null,
      senderAddress: row.sender_address ?? null,
      recipientAddress: row.recipient_address,
      binanceAsset: row.binance_asset ?? null,
      binanceNetwork: row.binance_network ?? null,
      status: row.status as 'Pending' | 'Sent' | 'Verified' | 'Failed',
      success: row.success,
      errorMessage: row.error_message ?? null,
      settledAt: new Date(row.settled_at),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      failedAt: row.failed_at ? new Date(row.failed_at) : null,
      verified: row.verified,
      verificationError: row.verification_error ?? null,
      verificationDetails: (row as any).verification_details ?? null,
    }));
  }

  /**
   * Get settlement logs with verification details using the view
   * Provides comprehensive settlement and verification information
   *
   * @param limit Maximum number of records to return (default: 100)
   * @returns Array of settlement logs with verification details
   */
  async platformGetsSettlementLogsWithVerification(
    limit = 100,
  ): Promise<SettlementLogWithVerification[]> {
    const rows = await this.sql`
      SELECT 
        id::text,
        blockchain_key,
        currency_blockchain_key,
        currency_token_id,
        currency_symbol,
        currency_decimals,
        original_balance::text,
        settlement_amount::text,
        remaining_balance::text,
        transaction_hash,
        sender_address,
        recipient_address,
        binance_asset,
        binance_network,
        status,
        success,
        error_message,
        settled_at,
        sent_at,
        verified_at,
        failed_at,
        verified,
        verification_error,
        verification_details,
        verification_id::text as verification_id,
        overall_matched,
        tx_hash_matches,
        sender_address_matches,
        recipient_address_matches,
        amount_matches,
        binance_status,
        verification_errors,
        verification_attempt
      FROM settlement_logs_with_verification
      ORDER BY settled_at DESC
      LIMIT ${limit}
    `;

    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      assertProp(check(isNullable, isString), row, 'currency_symbol');
      assertPropString(row, 'original_balance');
      assertPropString(row, 'settlement_amount');
      assertPropString(row, 'remaining_balance');
      assertProp(check(isNullable, isString), row, 'transaction_hash');
      assertProp(check(isNullable, isString), row, 'sender_address');
      assertPropString(row, 'recipient_address');
      assertProp(check(isNullable, isString), row, 'binance_asset');
      assertProp(check(isNullable, isString), row, 'binance_network');
      assertPropString(row, 'status');
      assertProp(isBoolean, row, 'success');
      assertProp(check(isNullable, isString), row, 'error_message');
      assertPropString(row, 'settled_at');
      assertProp(check(isNullable, isString), row, 'sent_at');
      assertProp(check(isNullable, isString), row, 'verified_at');
      assertProp(check(isNullable, isString), row, 'failed_at');
      assertProp(isBoolean, row, 'verified');
      assertProp(check(isNullable, isString), row, 'verification_error');
      assertProp(check(isNullable, isString), row, 'verification_id');
      return row;
    });

    return rows.map(row => ({
      id: row.id,
      blockchainKey: row.blockchain_key,
      currencyBlockchainKey: row.currency_blockchain_key,
      currencyTokenId: row.currency_token_id,
      originalBalance: row.original_balance,
      settlementAmount: row.settlement_amount,
      remainingBalance: row.remaining_balance,
      transactionHash: row.transaction_hash ?? null,
      senderAddress: row.sender_address ?? null,
      recipientAddress: row.recipient_address,
      binanceAsset: row.binance_asset ?? null,
      binanceNetwork: row.binance_network ?? null,
      status: row.status as 'Pending' | 'Sent' | 'Verified' | 'Failed',
      success: row.success,
      errorMessage: row.error_message ?? null,
      settledAt: new Date(row.settled_at),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      failedAt: row.failed_at ? new Date(row.failed_at) : null,
      verified: row.verified,
      verificationError: row.verification_error ?? null,
      verificationDetails: (row as any).verification_details ?? null,
      currencySymbol: row.currency_symbol ?? null,
      currencyDecimals: (row as any).currency_decimals ?? null,
      verificationId: row.verification_id ?? null,
      overallMatched: (row as any).overall_matched ?? null,
      txHashMatches: (row as any).tx_hash_matches ?? null,
      senderAddressMatches: (row as any).sender_address_matches ?? null,
      recipientAddressMatches: (row as any).recipient_address_matches ?? null,
      amountMatches: (row as any).amount_matches ?? null,
      binanceStatus: (row as any).binance_status ?? null,
      verificationErrors: (row as any).verification_errors ?? null,
      verificationAttempt: (row as any).verification_attempt ?? null,
    }));
  }

  /**
   * Get settlement statistics by currency using the view
   * Provides aggregated settlement metrics per currency
   *
   * @returns Array of settlement statistics by currency
   */
  async platformGetsSettlementStatsByCurrency(): Promise<SettlementStatsByCurrency[]> {
    const rows = await this.sql`
      SELECT 
        currency_blockchain_key,
        currency_token_id,
        currency_symbol,
        currency_decimals,
        total_settlements,
        verified_count,
        failed_count,
        pending_count,
        total_amount_settled::text,
        total_amount_verified::text,
        first_settlement,
        last_settlement
      FROM settlement_stats_by_currency
      ORDER BY currency_token_id
    `;

    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      assertProp(check(isNullable, isString), row, 'currency_symbol');
      assertProp(check(isNullable, isString), row, 'total_amount_settled');
      assertProp(check(isNullable, isString), row, 'total_amount_verified');
      assertProp(check(isNullable, isString), row, 'first_settlement');
      assertProp(check(isNullable, isString), row, 'last_settlement');
      return row;
    });

    return rows.map(row => ({
      currencyBlockchainKey: row.currency_blockchain_key,
      currencyTokenId: row.currency_token_id,
      currencySymbol: row.currency_symbol ?? null,
      currencyDecimals: (row as any).currency_decimals ?? null,
      totalSettlements: Number((row as any).total_settlements ?? 0),
      verifiedCount: Number((row as any).verified_count ?? 0),
      failedCount: Number((row as any).failed_count ?? 0),
      pendingCount: Number((row as any).pending_count ?? 0),
      totalAmountSettled: row.total_amount_settled ?? '0',
      totalAmountVerified: row.total_amount_verified ?? '0',
      firstSettlement: row.first_settlement ? new Date(row.first_settlement) : null,
      lastSettlement: row.last_settlement ? new Date(row.last_settlement) : null,
    }));
  }
}
