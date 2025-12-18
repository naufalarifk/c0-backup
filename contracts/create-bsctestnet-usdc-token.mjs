#!/usr/bin/env node
// @ts-check

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPublicClient, createWalletClient, encodeFunctionData, encodePacked, http, isHex, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';

import { ethSendRawTransaction } from './tools/eth-rpc.mjs';
import { compileSolidity } from './tools/eth-solc.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const accountPrivateKey = await readFile(join(__dirname, './wallets/0xC4628350Adf29Aa47fb6572E703371Ce65138048'), { encoding: 'utf8' });

if (!isHex(accountPrivateKey)) throw new Error('Invalid private key in wallet file');

const C4628350Adf29Aa47fb6572E703371Ce65138048 = privateKeyToAccount(accountPrivateKey);

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(),
});

const ownerClient = createWalletClient({
  chain: bscTestnet,
  transport: http(),
  account: C4628350Adf29Aa47fb6572E703371Ce65138048,
});

const compiledBEP20 = await compileSolidity(join(__dirname, './BEP20.sol'), 'BEP20');
const BEP20Bytecode = compiledBEP20.bytecode;

const BEP20DeployementTxPreparation = await ownerClient.prepareTransactionRequest({
  to: null,
  data: encodePacked(['bytes'], [BEP20Bytecode]),
});

console.info('BEP20 Deployement Transaction Preparation:', BEP20DeployementTxPreparation);

const BEP20DeployementTxSerialization = await ownerClient.signTransaction(BEP20DeployementTxPreparation);

console.info('BEP20 Deployement Transaction Serialization:', BEP20DeployementTxSerialization);

const BEP20DeployementTxHash = await ethSendRawTransaction(publicClient, BEP20DeployementTxSerialization);

console.info('BEP20 Deployement Transaction Hash:', BEP20DeployementTxHash);

const BEP20DeployementTxReceipt = await publicClient.waitForTransactionReceipt({
  hash: BEP20DeployementTxHash,
});

console.info('BEP20 Deployement Transaction Receipt:', BEP20DeployementTxReceipt);

const BEP20ContractAddress = BEP20DeployementTxReceipt.contractAddress;

const BEP20InitializationTxPreparation = await ownerClient.prepareTransactionRequest({
  to: BEP20ContractAddress,
  data: encodeFunctionData({
    abi: parseAbi([
      'function initialize(string memory initName, string memory initSymbol, uint8 initDecimals, uint256 initTotalSupply, address initHolder) public',
    ]),
    functionName: 'initialize',
    args: ['USD Coin', 'USDC', 6, 1_000_000_000_000n, ownerClient.account.address],
  }),
});

console.info('BEP20 Initialization Transaction Preparation:', BEP20InitializationTxPreparation);

const BEP20InitializationTxSerialization = await ownerClient.signTransaction(BEP20InitializationTxPreparation);

console.info('BEP20 Initialization Transaction Serialization:', BEP20InitializationTxSerialization);

const BEP20InitializationTxHash = await ethSendRawTransaction(publicClient, BEP20InitializationTxSerialization);

console.info('BEP20 Initialization Transaction Hash:', BEP20InitializationTxHash);

const BEP20InitializationTxReceipt = await publicClient.waitForTransactionReceipt({
  hash: BEP20InitializationTxHash,
});

console.info('BEP20 Initialization Transaction Receipt:', BEP20InitializationTxReceipt);
