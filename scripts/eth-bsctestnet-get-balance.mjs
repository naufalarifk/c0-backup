#!/usr/bin/env node
// @ts-check

import { argv } from 'node:process';
import { createPublicClient, formatEther, http, isAddress } from 'viem';
import { bscTestnet } from 'viem/chains';

import { ethGetNativeOrERC20Balance } from '../contracts/tools/eth-rpc.mjs';

const [,, tokenAddress, address] = argv;

if (!isAddress(address)) throw new Error('Invalid address provided');
if (tokenAddress !== '0x' && !isAddress(tokenAddress)) throw new Error('Invalid token address provided');

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(),
});

const nativeBalance = await ethGetNativeOrERC20Balance(publicClient, tokenAddress, address);

console.info(`BSC Testnet Native Balance of ${address}:`, nativeBalance, 'wei or', formatEther(nativeBalance), 'BNB');
