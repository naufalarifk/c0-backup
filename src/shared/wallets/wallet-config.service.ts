import { Injectable } from '@nestjs/common';

import { BitcoinWalletConfig, BtcWalletService } from './btc-wallet.service';
import { EthereumWalletConfig, EthWalletService } from './eth-wallet.service';
import { SolanaWalletConfig, SolWalletService } from './sol-wallet.service';

export interface NetworkConfig {
  bitcoin: BitcoinWalletConfig;
  ethereum: EthereumWalletConfig;
  solana: SolanaWalletConfig;
}

@Injectable()
export class WalletConfigService {
  getNetworkConfig(network: 'mainnet' | 'testnet' | 'devnet'): NetworkConfig {
    const configs: Record<string, NetworkConfig> = {
      mainnet: {
        bitcoin: {
          network: 'mainnet',
          rpcEndpoint: 'https://blockstream.info/api',
        },
        ethereum: {
          network: 'mainnet',
          rpcEndpoint: process.env.ETH_MAINNET_RPC_URL || 'https://eth.llamarpc.com',
        },
        solana: {
          network: 'mainnet',
          rpcEndpoint: 'https://api.mainnet-beta.solana.com',
        },
      },
      testnet: {
        bitcoin: {
          network: 'testnet',
          rpcEndpoint: 'https://blockstream.info/testnet/api',
        },
        ethereum: {
          network: 'testnet',
          rpcEndpoint: process.env.ETH_TESTNET_RPC_URL || 'https://sepolia.drpc.org',
        },
        solana: {
          network: 'testnet',
          rpcEndpoint: 'https://api.testnet.solana.com',
        },
      },
      devnet: {
        bitcoin: {
          network: 'testnet', // Use testnet for Bitcoin as there's no devnet
          rpcEndpoint: 'https://blockstream.info/testnet/api',
        },
        ethereum: {
          network: 'testnet', // Use testnet for Ethereum
          rpcEndpoint: process.env.ETH_TESTNET_RPC_URL || 'https://sepolia.drpc.org',
        },
        solana: {
          network: 'devnet',
          rpcEndpoint: 'https://api.devnet.solana.com',
        },
      },
    };

    return configs[network] || configs.testnet;
  }

  createBtcWalletService(network: 'mainnet' | 'testnet' | 'devnet' = 'testnet'): BtcWalletService {
    const config = this.getNetworkConfig(network);
    return new BtcWalletService(config.bitcoin);
  }

  createEthWalletService(network: 'mainnet' | 'testnet' | 'devnet' = 'testnet'): EthWalletService {
    const config = this.getNetworkConfig(network);
    return new EthWalletService(config.ethereum);
  }

  createSolWalletService(network: 'mainnet' | 'testnet' | 'devnet' = 'testnet'): SolWalletService {
    const config = this.getNetworkConfig(network);
    return new SolWalletService(config.solana);
  }
}
