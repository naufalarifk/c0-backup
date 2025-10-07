import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { AccountLayout } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';

import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { AddressChanged, IndexerListener, Listener } from '../indexer-listener.abstract';

type SolanaTokenStrategy =
  | {
      mode: 'native';
      tokenId: 'slip44:501';
      tokenKey: 'native:slip44:501';
    }
  | {
      mode: 'spl';
      tokenId: string;
      tokenKey: `spl:${string}`;
      mintAddress: string;
    };

type SolanaIndexerConfig = {
  rpcUrlEnvVar: string;
  wsUrlEnvVar?: string;
  defaultRpcUrl: string;
  defaultWsUrl?: string;
};

@Injectable()
@Listener('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
export class SolanaMainnetIndexerListener extends IndexerListener {
  readonly logger = new TelemetryLogger(SolanaMainnetIndexerListener.name);
  #watchersByToken = new Map<string, Map<string, AddressChanged>>();
  #activeStrategies = new Set<string>();
  #activeSubscriptions = new Map<string, number>();
  #connection: Connection;

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
  ) {
    super(discovery, redis, invoicePaymentQueue);

    const config: SolanaIndexerConfig = {
      rpcUrlEnvVar: 'SOLANA_RPC_URL',
      wsUrlEnvVar: 'SOLANA_WS_URL',
      defaultRpcUrl: 'https://api.mainnet-beta.solana.com',
    };

    const rpcUrl = process.env[config.rpcUrlEnvVar] || config.defaultRpcUrl;
    const wsUrl = config.wsUrlEnvVar ? process.env[config.wsUrlEnvVar] : undefined;

    this.#connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: wsUrl || config.defaultWsUrl,
    });

    this.#connection.onAccountChange = this.#connection.onAccountChange.bind(this.#connection);
  }

  async stop() {
    await super.stop();

    for (const [key, subscriptionId] of this.#activeSubscriptions.entries()) {
      this.logger.debug(`Cleaning up Solana subscription: ${key}`);
      try {
        await this.#connection.removeAccountChangeListener(subscriptionId);
      } catch (error) {
        this.logger.error(`Failed to remove subscription ${key}`, error);
      }
    }
    this.#activeSubscriptions.clear();
  }

  async onAddressAdded(change: AddressChanged): Promise<void> {
    if (!this.#isValidSolanaAddress(change.address)) {
      this.logger.error('Invalid Solana address', { address: change.address });
      return;
    }

    const strategy = this.#resolveTokenStrategy(change);
    if (!strategy) {
      this.logger.warn('Unsupported token id received for Solana indexer', {
        tokenId: change.tokenId,
        address: change.address,
      });
      return;
    }

    const tokenWatchers = this.#watchersByToken.get(strategy.tokenKey) ?? new Map();
    const watchKey = this.#buildWatchKey(change);

    // Check if this address is already being watched
    if (tokenWatchers.has(watchKey)) {
      return;
    }

    tokenWatchers.set(watchKey, { ...change, tokenId: strategy.tokenId });
    this.#watchersByToken.set(strategy.tokenKey, tokenWatchers);

    // Mark strategy as active if first address for this token
    const isFirstAddress = !this.#activeStrategies.has(strategy.tokenKey);
    if (isFirstAddress) {
      this.#activeStrategies.add(strategy.tokenKey);
      this.logger.log('Starting Solana indexer strategy', {
        mode: strategy.mode,
        tokenId: strategy.tokenId,
      });
    }

    // Always set up subscription for the new address
    if (strategy.mode === 'native') {
      await this.#setupNativeAddressListener(strategy, watchKey, {
        ...change,
        tokenId: strategy.tokenId,
      });
    } else if (strategy.mode === 'spl') {
      await this.#setupSplAddressListener(strategy, watchKey, {
        ...change,
        tokenId: strategy.tokenId,
      });
    }
  }

  async onAddressRemoved(change: AddressChanged): Promise<void> {
    const strategy = this.#resolveTokenStrategy(change);
    if (!strategy) {
      this.logger.warn('Attempted to remove unsupported Solana token watcher', {
        tokenId: change.tokenId,
        address: change.address,
      });
      return;
    }

    const tokenWatchers = this.#watchersByToken.get(strategy.tokenKey);
    if (!tokenWatchers) {
      return;
    }

    const watchKey = this.#buildWatchKey(change);
    tokenWatchers.delete(watchKey);

    // Remove the specific subscription for this address
    const subscriptionKey = `${strategy.tokenKey}:${watchKey}`;
    const subscriptionId = this.#activeSubscriptions.get(subscriptionKey);
    if (subscriptionId !== undefined) {
      try {
        await this.#connection.removeAccountChangeListener(subscriptionId);
        this.#activeSubscriptions.delete(subscriptionKey);
        this.logger.log('Removed account change listener', {
          address: change.address,
          tokenId: strategy.tokenId,
        });
      } catch (error) {
        this.logger.error('Failed to remove account change listener', error);
      }
    }

    // If no more watchers for this token, mark strategy as inactive
    if (tokenWatchers.size === 0) {
      this.#watchersByToken.delete(strategy.tokenKey);
      this.#activeStrategies.delete(strategy.tokenKey);

      this.logger.log('No more wallets tracked for Solana token, stopped strategy runner', {
        tokenId: strategy.tokenId,
      });
    }
  }

  #isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  #resolveTokenStrategy(change: AddressChanged): SolanaTokenStrategy | undefined {
    const normalizedTokenId = change.tokenId.toLowerCase();

    if (normalizedTokenId === 'slip44:501') {
      return { mode: 'native', tokenId: 'slip44:501', tokenKey: 'native:slip44:501' };
    }

    if (normalizedTokenId.startsWith('spl:')) {
      // Extract mint address from original (case-sensitive) token ID
      const mintAddress = change.tokenId.split(':')[1];
      if (mintAddress && this.#isValidSolanaAddress(mintAddress)) {
        return {
          mode: 'spl',
          tokenId: `spl:${mintAddress}`,
          tokenKey: `spl:${mintAddress.toLowerCase()}`,
          mintAddress,
        };
      }
    }

    return undefined;
  }

  #buildWatchKey(change: AddressChanged) {
    return `${change.address}::${change.derivedPath}`;
  }

  async #setupNativeAddressListener(
    strategy: SolanaTokenStrategy,
    watchKey: string,
    watcher: AddressChanged,
  ) {
    const blockchainKey = this.getBlockchainKey();
    if (!blockchainKey) {
      throw new Error('Blockchain key not found');
    }

    try {
      const pubkey = new PublicKey(watcher.address);
      let previousBalance = await this.#connection.getBalance(pubkey);

      const subscriptionId = this.#connection.onAccountChange(
        pubkey,
        async (accountInfo, context) => {
          try {
            const newBalance = accountInfo.lamports;

            if (newBalance > previousBalance) {
              const amount = (newBalance - previousBalance).toString();

              this.logger.log('Detected native SOL transaction', {
                address: watcher.address,
                amount: (newBalance - previousBalance) / 1e9,
                slot: context.slot,
              });

              await this.dispatchDetectedTransaction({
                blockchainKey,
                tokenId: strategy.tokenId,
                derivedPath: watcher.derivedPath,
                address: watcher.address,
                txHash: `slot:${context.slot}`,
                sender: '',
                amount,
                timestamp: Math.floor(Date.now() / 1000),
              });
            }

            previousBalance = newBalance;
          } catch (error) {
            this.logger.error('Error processing Solana account change', error);
          }
        },
        { commitment: 'confirmed' },
      );

      this.#activeSubscriptions.set(`${strategy.tokenKey}:${watchKey}`, subscriptionId);

      this.logger.log('Native SOL listener started for address', {
        address: watcher.address,
      });
    } catch (error) {
      this.logger.error('Failed to start native SOL listener', error);
    }
  }

  async #setupSplAddressListener(
    strategy: SolanaTokenStrategy & { mode: 'spl' },
    watchKey: string,
    watcher: AddressChanged,
  ) {
    const blockchainKey = this.getBlockchainKey();
    if (!blockchainKey) {
      throw new Error('Blockchain key not found');
    }

    try {
      const mintPubkey = new PublicKey(strategy.mintAddress);
      const ownerPubkey = new PublicKey(watcher.address);

      const tokenAccounts = await this.#connection.getTokenAccountsByOwner(ownerPubkey, {
        mint: mintPubkey,
      });

      if (tokenAccounts.value.length === 0) {
        this.logger.warn('No token account found for SPL token', {
          address: watcher.address,
          mint: strategy.mintAddress,
        });
        return;
      }

      const tokenAccountPubkey = tokenAccounts.value[0].pubkey;
      let previousBalance = BigInt(0);

      const accountInfo = await this.#connection.getParsedAccountInfo(tokenAccountPubkey);
      if (accountInfo.value && 'parsed' in accountInfo.value.data) {
        const parsedData = accountInfo.value.data.parsed as {
          info?: { tokenAmount?: { amount?: string } };
        };
        previousBalance = BigInt(parsedData.info?.tokenAmount?.amount || '0');
      }

      const subscriptionId = this.#connection.onAccountChange(
        tokenAccountPubkey,
        async (accountInfo, context) => {
          try {
            // onAccountChange returns data as Buffer, we need to manually decode it
            if (!accountInfo.data || !(accountInfo.data instanceof Buffer)) {
              return;
            }

            // Decode the SPL token account data
            const decodedData = AccountLayout.decode(accountInfo.data);
            const newBalance = decodedData.amount;

            if (newBalance > previousBalance) {
              const amount = (newBalance - previousBalance).toString();

              this.logger.log('Detected SPL token transfer', {
                address: watcher.address,
                mint: strategy.mintAddress,
                amount,
                slot: context.slot,
              });

              await this.dispatchDetectedTransaction({
                blockchainKey,
                tokenId: strategy.tokenId,
                derivedPath: watcher.derivedPath,
                address: watcher.address,
                txHash: `slot:${context.slot}`,
                sender: '',
                amount,
                timestamp: Math.floor(Date.now() / 1000),
              });
            }

            previousBalance = newBalance;
          } catch (error) {
            this.logger.error('Error processing SPL token account change', error);
          }
        },
        { commitment: 'confirmed' },
      );

      this.#activeSubscriptions.set(`${strategy.tokenKey}:${watchKey}`, subscriptionId);

      this.logger.log('SPL token listener started', {
        address: watcher.address,
        mint: strategy.mintAddress,
      });
    } catch (error) {
      this.logger.error('Failed to start SPL listener', error);
    }
  }
}
