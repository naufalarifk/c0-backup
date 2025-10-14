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
  blockchainKey: string;
  originalBalance: string;
  settlementAmount: string;
  remainingBalance: string;
  transactionHash: string | null;
  success: boolean;
  errorMessage: string | null;
  settledAt: Date;
}

/**
 * Parameters for storing settlement results
 */
export interface StoreSettlementResultParams {
  blockchainKey: string;
  originalBalance: string;
  settlementAmount: string;
  remainingBalance: string;
  transactionHash: string | null;
  success: boolean;
  errorMessage: string | null;
  settledAt: Date;
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
      FROM accounts a
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
      FROM accounts
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
      FROM accounts a
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
      FROM accounts a
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
   */
  async platformStoresSettlementResult(params: StoreSettlementResultParams): Promise<void> {
    await this.sql`
      INSERT INTO settlement_logs (
        blockchain_key,
        original_balance,
        settlement_amount,
        remaining_balance,
        transaction_hash,
        success,
        error_message,
        settled_at
      ) VALUES (
        ${params.blockchainKey},
        ${params.originalBalance},
        ${params.settlementAmount},
        ${params.remainingBalance},
        ${params.transactionHash},
        ${params.success},
        ${params.errorMessage},
        ${params.settledAt.toISOString()}
      )
    `;
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
        blockchain_key,
        original_balance,
        settlement_amount,
        remaining_balance,
        transaction_hash,
        success,
        error_message,
        settled_at
      FROM settlement_logs
      ORDER BY settled_at DESC
      LIMIT ${limit}
    `;

    // Validate and map the results
    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'original_balance');
      assertPropString(row, 'settlement_amount');
      assertPropString(row, 'remaining_balance');
      assertProp(check(isNullable, isString), row, 'transaction_hash');
      assertProp(isBoolean, row, 'success');
      assertProp(check(isNullable, isString), row, 'error_message');
      assertPropString(row, 'settled_at');
      return row;
    });

    return rows.map(row => ({
      blockchainKey: row.blockchain_key,
      originalBalance: row.original_balance,
      settlementAmount: row.settlement_amount,
      remainingBalance: row.remaining_balance,
      transactionHash: row.transaction_hash ?? null,
      success: row.success,
      errorMessage: row.error_message ?? null,
      settledAt: new Date(row.settled_at),
    }));
  }
}
