#!/usr/bin/env node
// @ts-check

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPublicClient, createWalletClient, encodeAbiParameters, encodePacked, http, isHex, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hoodi } from 'viem/chains';

import { compileSolidity } from './tools/eth-solc.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const accountPrivateKey = await readFile(join(__dirname, './wallets/0xC4628350Adf29Aa47fb6572E703371Ce65138048'), { encoding: 'utf8' });

if (!isHex(accountPrivateKey)) throw new Error('Invalid private key in wallet file');

const C4628350Adf29Aa47fb6572E703371Ce65138048 = privateKeyToAccount(accountPrivateKey);

const publicClient = createPublicClient({
  chain: hoodi,
  transport: http(),
});

const payerWalletClient = createWalletClient({
  chain: hoodi,
  transport: http(),
  account: C4628350Adf29Aa47fb6572E703371Ce65138048,
});

const compiledBEP20 = await compileSolidity(join(__dirname, './BEP20.sol'), 'BEP20');
const BEP20Bytecode = compiledBEP20.bytecode;

const BEP20DeployementTxPreparation = await publicClient.prepareTransactionRequest({
  to: null,
  data: encodePacked(['bytes', 'bytes'], [
    BEP20Bytecode,
    encodeAbiParameters(
      parseAbiParameters([
        'string initName',
        'string initSymbol',
        'uint8 initDecimals',
        'uint256 initTotalSupply',
        'address initHolder',
      ]),
      ['USD Coin', 'USDC', 6, 1_000_000_000_000n, payerWalletClient.account.address],
    ),
  ]),
});

console.info('BEP20 Deployement Transaction Preparation:', BEP20DeployementTxPreparation);

const BEP20DeployementTxSerialization = await payerWalletClient.signTransaction(BEP20DeployementTxPreparation);

console.info('BEP20 Deployement Transaction Serialization:', BEP20DeployementTxSerialization);

const BEP20DeployementTxHash = await publicClient.sendRawTransaction({
  serializedTransaction: BEP20DeployementTxSerialization,
});

console.info('BEP20 Deployement Transaction Hash:', BEP20DeployementTxHash);

const BEP20DeployementTxReceipt = await publicClient.waitForTransactionReceipt({
  hash: BEP20DeployementTxHash,
});

console.info('BEP20 Deployement Transaction Receipt:', BEP20DeployementTxReceipt);
