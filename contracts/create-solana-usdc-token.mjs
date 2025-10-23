// @ts-check

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ASSOCIATED_TOKEN_PROGRAM_ID, AuthorityType, createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction, createMintToInstruction, createSetAuthorityInstruction, getAssociatedTokenAddressSync, getMinimumBalanceForRentExemptMint, getMintLen, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, Keypair, sendAndConfirmTransaction, Transaction, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
// import { createKuboRPCClient } from 'kubo-rpc-client';

import { packCreateMetadataAccountV3Instruction } from './tools/solana-metaplex.mjs';

/** @typedef {import('./tools/solana-metaplex.mjs').CreateMetadataV3AccountParams} CreateMetadataAccountParams */

const __dirname = new URL('.', import.meta.url).pathname;

const connection = new Connection('https://api.devnet.solana.com', {
  commitment: 'confirmed',
});

const payerKeypairFilePath = join(__dirname, './wallets/cgdSQB5ggp8Q4nKE7LwwTgXE2i1H68k9WcKepAGVDGS.json');
const payerKeypairJson = await readFile(payerKeypairFilePath, { encoding: 'utf-8' });
const payerKeypairArray = JSON.parse(payerKeypairJson);
const payerKeypair = Keypair.fromSecretKey(Uint8Array.from(payerKeypairArray));

const tokenKeypairFilePath = join(__dirname, './wallets/CGUsdwgPH4mMEQoA3ZMi2C2aiJywFb3x5SrMFt2F9dj4.json');
const tokenKeypairJson = await readFile(tokenKeypairFilePath, { encoding: 'utf-8' });
const tokenKeypairArray = JSON.parse(tokenKeypairJson);
const tokenKeypair = Keypair.fromSecretKey(Uint8Array.from(tokenKeypairArray));
// const tokenKeypair = Keypair.generate();

const existingTokenAccountInfo = await connection.getAccountInfo(tokenKeypair.publicKey);

if (existingTokenAccountInfo) {
  throw new Error(`Token account already exists: ${tokenKeypair.publicKey.toBase58()}`);
}

// const kubo = createKuboRPCClient('http://localhost:5001');

// const usdcFilePath = join(__dirname, '@/app/fixture/usd-coin-usdc-logo.png');
// const usdcFileBuffer = await readFile(usdcFilePath, { encoding: undefined });
// const usdcIpfsResult = await kubo.add(usdcFileBuffer, { pin: true });

// const usdcCid = usdcIpfsResult.cid.toV1().toString();
// const usdcUrl = `ipfs://${usdcCid}`;

const usdcUrl = 'https://bafkreibml7m7nffhrjirkqtev7yihxt57ftljzabx3fws3ccbdqt4e22pi.ipfs.dweb.link/';

const splTokenRentExempt = await getMinimumBalanceForRentExemptMint(connection);
const splTokenAccountSpace = getMintLen([]);

const payerAta = getAssociatedTokenAddressSync(
  tokenKeypair.publicKey,
  payerKeypair.publicKey,
  false,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
);

const tokenCreationTx = new Transaction();

tokenCreationTx.add(SystemProgram.createAccount({
  fromPubkey: payerKeypair.publicKey,
  newAccountPubkey: tokenKeypair.publicKey,
  lamports: splTokenRentExempt,
  space: splTokenAccountSpace,
  programId: TOKEN_PROGRAM_ID,
}));

tokenCreationTx.add(createInitializeMint2Instruction(
  tokenKeypair.publicKey,
  6,
  payerKeypair.publicKey,
  payerKeypair.publicKey,
  TOKEN_PROGRAM_ID,
));

tokenCreationTx.add(createAssociatedTokenAccountIdempotentInstruction(
  payerKeypair.publicKey,
  payerAta,
  payerKeypair.publicKey,
  tokenKeypair.publicKey,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
));

tokenCreationTx.add(createMintToInstruction(
  tokenKeypair.publicKey,
  payerAta,
  payerKeypair.publicKey,
  100_000_000 * LAMPORTS_PER_SOL,
  [],
  TOKEN_PROGRAM_ID,
));

tokenCreationTx.add(packCreateMetadataAccountV3Instruction({
  mint: tokenKeypair.publicKey,
  authority: payerKeypair.publicKey,
  payer: payerKeypair.publicKey,
  name: 'USD Coin',
  symbol: 'USDC',
  uri: usdcUrl,
  sellerFeeBasisPoints: 0,
}));

tokenCreationTx.add(createSetAuthorityInstruction(
  tokenKeypair.publicKey,
  payerKeypair.publicKey,
  AuthorityType.MintTokens,
  null,
  [],
  TOKEN_PROGRAM_ID,
));

tokenCreationTx.add(createSetAuthorityInstruction(
  tokenKeypair.publicKey,
  payerKeypair.publicKey,
  AuthorityType.FreezeAccount,
  null,
  [],
  TOKEN_PROGRAM_ID,
));

// tokenCreationTx.feePayer = payerKeypair.publicKey;
// tokenCreationTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
// const compiledMessage = tokenCreationTx.compileMessage();
// console.log('compiledMessage.accountKeys.map((key) => key.toBase58())', compiledMessage.accountKeys.map((key) => key.toBase58()));
// console.log('compiledMessage.instructions[6].accounts', compiledMessage.instructions[6].accounts);

const tokenCreationSignature = await sendAndConfirmTransaction(connection, tokenCreationTx, [payerKeypair, tokenKeypair], {
  commitment: 'confirmed',
});

console.info('Token creation transaction signature:', tokenCreationSignature);
