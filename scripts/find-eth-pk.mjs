#!/usr/bin/env node
// @ts-check

import { argv, stderr, stdout } from 'node:process';
import { generatePrivateKey, english, mnemonicToAccount, privateKeyToAddress } from 'viem/accounts';

const [, , prefix] = argv;

if (typeof prefix !== 'string' || prefix.length === 0) {
  stderr.write('Usage: find-eth-wallet.mjs <address-prefix>\n');
  process.exit(1);
}

const base58ValidChars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
for (const char of prefix) {
  if (!base58ValidChars.includes(char)) {
    stderr.write(`Invalid prefix character: ${char}\n`);
    process.exit(1);
  }
}

let iteration = 0;

const loweredPrefix = `0x${prefix.toLowerCase()}`;

while (true) {
  const privateKey = generatePrivateKey();
  const address = privateKeyToAddress(privateKey);
  if (address.toLowerCase().startsWith(loweredPrefix)) {
    stdout.write(`Address: ${address}\n`);
    stdout.write(`Mnemonic: ${privateKey}\n`);
    break;
  }
  iteration += 1;
  if (iteration % 10000 === 0) {
    stdout.write(`Tried ${iteration} addresses...\n`);
  }
}
