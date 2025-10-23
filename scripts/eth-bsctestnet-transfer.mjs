#!/usr/bin/env node
// @ts-check

import { argv } from 'node:process';
import { createPublicClient, parseEther, formatEther, http, isAddress, isHex, createWalletClient } from 'viem';
import { bscTestnet } from 'viem/chains';

import { ethSendRawTransaction } from '../contracts/tools/eth-rpc.mjs';
import { privateKeyToAccount } from 'viem/accounts';

const [,, tokenAddress, privateKeySender, addressReceiver, etherAmount] = argv;

if (tokenAddress !== '0x' && !isAddress(tokenAddress)) throw new Error('Invalid token address provided');
if (!isHex(privateKeySender)) throw new Error('Invalid private key sender provided');
if (!isAddress(addressReceiver)) throw new Error('Invalid address receiver provided');

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(),
});

const senderAccount = privateKeyToAccount(privateKeySender);
const senderClient = createWalletClient({
  chain: bscTestnet,
  transport: http(),
  account: senderAccount,
});

const transferTxPreparation = await senderClient.prepareTransactionRequest({
  from: senderAccount.address,
  to: addressReceiver,
  value: parseEther(etherAmount),
});

console.info('BSC Testnet Transfer Transaction Preparation:', transferTxPreparation);

const transferTxSerialization = await senderClient.signTransaction(transferTxPreparation);

console.info('BSC Testnet Transfer Transaction Serialization:', transferTxSerialization);

const transferTxHash = await ethSendRawTransaction(publicClient, transferTxSerialization);

console.info('BSC Testnet Transfer Transaction Hash:', transferTxHash);
