#!/usr/bin/env node
// @ts-check

import { argv } from 'node:process';
import { createPublicClient, createWalletClient, encodeFunctionData, erc20Abi, formatEther, http, isAddress, isHex } from 'viem';
import { hoodi } from 'viem/chains';

import { ethGetNativeOrERC20Balance } from '../contracts/tools/eth-rpc.mjs';
import { privateKeyToAccount } from 'viem/accounts';

const [,, erc20Address, ownerPrivateKey, receiverAddress] = argv;

if (erc20Address !== '0x' && !isAddress(erc20Address)) throw new Error('Invalid token address provided');
if (!isHex(ownerPrivateKey)) throw new Error('Invalid private key provided');
if (!isAddress(receiverAddress)) throw new Error('Invalid address provided');

const publicClient = createPublicClient({
  chain: hoodi,
  transport: http(),
});

const ownerAccount = privateKeyToAccount(ownerPrivateKey);

const ownerClient = createWalletClient({
  chain: hoodi,
  transport: http(),
  account: ownerAccount,
});


// const mintTxPreparation = await ownerClient.prepareTransactionRequest({
//   from: ownerAccount.address,
//   to: erc20Address,
//   value: 0n,
//   data: encodeFunctionData({
//     abi: erc20Abi,
//     // functionName: '',
//   }),
// });

