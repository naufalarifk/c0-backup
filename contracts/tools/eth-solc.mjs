// @ts-check

import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import solc from 'solc';
import { isHex } from 'viem';

/** @typedef {import('viem').Abi} Abi */
/** @typedef {import('viem').Hex} Hex */

/**
 * @typedef {Object} SolidityCompilationOutput
 * @property {Hex} bytecode
 * @property {Abi} abi
 */

/**
 * This function only support single-file solidity source code
 *
 * @param {string} sourceCodePath the smart contract source code
 * @param {string} contractName the contract name to compile
 * @returns {Promise<SolidityCompilationOutput>}
 */
export async function compileSolidity(sourceCodePath, contractName) {
  const sourceCodeDir = dirname(sourceCodePath);
  const sourceCode = await readFile(sourceCodePath, { encoding: 'utf8' });
  const compilationOutput = JSON.parse(solc.compile(
    JSON.stringify({
      language: 'Solidity',
      sources: {
        [`${contractName}.sol`]: { content: sourceCode },
      },
      settings: {
        outputSelection: {
          '*': { '*': ['*'] },
        },
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    }),
    {
      /** @param {string} path */
      import(path) {
        const sourceCode = readFileSync(join(sourceCodeDir, path), { encoding: 'utf8' });
        return {
          contents: sourceCode,
        };
      },
    },
  ));

  if (Array.isArray(compilationOutput.errors) && compilationOutput.errors.length > 0) {
    console.error('compilationOutput.errors', compilationOutput.errors);
    throw new Error('Compilation failed');
  }

  const contract = compilationOutput.contracts[`${contractName}.sol`][contractName];
  const bytecode = `0x${contract.evm.bytecode.object}`;
  const abi = contract.abi;

  if (!isHex(bytecode)) {
    throw new Error('Invalid bytecode');
  }

  return { bytecode, abi };
}
