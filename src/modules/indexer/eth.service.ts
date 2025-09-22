import { Injectable, OnModuleInit } from '@nestjs/common';

import { ethers } from 'ethers';
import { Observable } from 'rxjs';

interface EthereumTokenInfo {
  name: string;
  symbol: string;
  decimals: number;
}

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
}

interface TokenDetection extends TokenInfo {
  address: string;
  method?: string;
  from?: string;
  to?: string;
  amount?: string;
}

interface TransactionAnalysis {
  type: string;
  tokens: TokenDetection[];
  isContract?: boolean;
  value?: string;
  error?: string;
}

@Injectable()
export class EthereumService implements OnModuleInit {
  provider: ethers.WebSocketProvider;

  // Common ERC-20 function signatures
  private readonly ERC20_TRANSFER_SIGNATURE = '0xa9059cbb'; // transfer(address,uint256)
  private readonly ERC20_TRANSFER_FROM_SIGNATURE = '0x23b872dd'; // transferFrom(address,address,uint256)
  private readonly ERC20_APPROVE_SIGNATURE = '0x095ea7b3'; // approve(address,uint256)

  // ERC-20 Transfer event signature
  private readonly ERC20_TRANSFER_EVENT =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  constructor() {
    this.provider = new ethers.WebSocketProvider(
      process.env.ETH_WS_URL || 'wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID',
    );
  }

  onModuleInit() {
    console.log('Ethereum service initialized');
  }

  /**
   * Returns an Observable that emits every new block
   */
  onNewBlock(): Observable<ethers.Block> {
    return new Observable(subscriber => {
      const handler = (blockNumber: number) => {
        // Handle the async operation without making the handler async
        this.provider
          .getBlock(blockNumber, true)
          .then(block => {
            if (block) {
              subscriber.next(block);
            }
          })
          .catch(err => {
            subscriber.error(err);
          });
      };

      this.provider.on('block', handler).catch(err => {
        console.error('Error setting up block listener', err);
        subscriber.error(err);
      });

      // Cleanup on unsubscribe
      return () => {
        this.provider.off('block', handler).catch(err => {
          console.error('Error removing block listener', err);
        });
      };
    });
  }

  /**
   * Analyze a transaction to detect tokens involved
   */
  async analyzeTransactionForTokens(txHash: string): Promise<TransactionAnalysis> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!tx || !receipt) {
        return { type: 'unknown', tokens: [] };
      }

      const analysis: TransactionAnalysis = {
        type: 'native', // ETH transfer by default
        tokens: [],
        isContract: tx.to ? await this.isContractAddress(tx.to) : false,
        value: ethers.formatEther(tx.value),
      };

      // Check if it's an ERC-20 transaction
      if (tx.data && tx.data.length > 10 && tx.to) {
        const functionSignature = tx.data.slice(0, 10);

        if (
          functionSignature === this.ERC20_TRANSFER_SIGNATURE ||
          functionSignature === this.ERC20_TRANSFER_FROM_SIGNATURE ||
          functionSignature === this.ERC20_APPROVE_SIGNATURE
        ) {
          analysis.type = 'erc20';

          // Get token info from the contract
          const tokenInfo = await this.getERC20TokenInfo(tx.to);
          if (tokenInfo) {
            analysis.tokens.push({
              address: tx.to,
              ...tokenInfo,
              method: this.getFunctionName(functionSignature),
            });
          }
        }
      }

      // Analyze logs for token transfers (including multi-token transactions)
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          if (log.topics[0] === this.ERC20_TRANSFER_EVENT) {
            const tokenInfo = await this.getERC20TokenInfo(log.address);
            if (tokenInfo) {
              analysis.tokens.push({
                address: log.address,
                ...tokenInfo,
                from: ethers.getAddress('0x' + log.topics[1].slice(26)),
                to: ethers.getAddress('0x' + log.topics[2].slice(26)),
                amount: log.data,
              });
            }
          }
        }

        if (analysis.tokens.length > 0) {
          analysis.type = analysis.tokens.length > 1 ? 'multi-token' : 'erc20';
        }
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing transaction for tokens:', error);
      return { type: 'error', tokens: [], error: error.message };
    }
  }

  /**
   * Get ERC-20 token information
   */
  async getERC20TokenInfo(contractAddress: string): Promise<EthereumTokenInfo> {
    try {
      const contract = new ethers.Contract(
        contractAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)',
        ],
        this.provider,
      );

      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => 'Unknown'),
        contract.symbol().catch(() => 'UNK'),
        contract.decimals().catch(() => 18n),
      ]);

      return { name, symbol, decimals: Number(decimals) };
    } catch {
      return { name: 'Unknown', symbol: 'UNK', decimals: 18 };
    }
  }

  /**
   * Check if an address is a contract
   */
  async isContractAddress(address: string): Promise<boolean> {
    try {
      const code = await this.provider.getCode(address);
      return code !== '0x';
    } catch {
      return false;
    }
  }

  /**
   * Get function name from signature
   */
  private getFunctionName(signature: string): string {
    const functionMap = {
      [this.ERC20_TRANSFER_SIGNATURE]: 'transfer',
      [this.ERC20_TRANSFER_FROM_SIGNATURE]: 'transferFrom',
      [this.ERC20_APPROVE_SIGNATURE]: 'approve',
    };
    return functionMap[signature] || 'unknown';
  }
}
