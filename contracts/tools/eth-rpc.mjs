// @ts-check

import { randomUUID } from 'node:crypto';

import { encodeFunctionData, isAddress, isHash, parseAbi } from 'viem';

/** @typedef {import('viem').Address} Address */
/** @typedef {import('viem').Hash} Hash */
/** @typedef {import('viem').Hex} Hex */
/** @typedef {import('viem').PublicClient} PublicClient */
/** @typedef {import('viem').TransactionRequest<Hex, Hex>} TransactionRequest */

/**
 * The viem package already has a these functions
 * We reimplment it ourselves for debuggability and for manual rpc urls management
 */

let rpcUrlRoundRobin = Math.round(Math.random() * Number.MAX_SAFE_INTEGER);
/** @type {Map<string, { limitUntil: number }>} */
const limitedRpcUrlMap = new Map();

/**
 * @param {PublicClient} client
 * @param {number|string|undefined} optionalReqId
 * @param {string} method
 * @param {unknown[]} params
 * @returns {Promise<any>}
 */
export async function ethRpcFetch(client, optionalReqId, method, params) {
  const reqId = optionalReqId ?? randomUUID().toUpperCase();

  const nowTime = Date.now();

  const allRpcUrls = client.chain?.rpcUrls.default.http ?? [];
  const rpcUrls = allRpcUrls.filter(function (rpcUrl) {
    const limit = limitedRpcUrlMap.get(rpcUrl);
    if (limit === undefined) {
      return true;
    }
    return limit.limitUntil < nowTime;
  });

  if (rpcUrls.length === 0) {
    // console.debug('ethRpc', 'no rpc available for ', client.chain?.id, client.chain?.name);
    await new Promise(function (resolve) {
      setTimeout(resolve, 10000);
    });
    return await ethRpcFetch(client, reqId, method, params);
  }

  rpcUrlRoundRobin += 1;

  if (rpcUrlRoundRobin >= Number.MAX_SAFE_INTEGER) {
    rpcUrlRoundRobin = 0;
  }

  const rpcUrlIndex = rpcUrlRoundRobin % rpcUrls.length;
  const rpcUrl = rpcUrls[rpcUrlIndex];

  try {
    // console.debug('ethRpc:req', rpcUrl, method, params);

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: reqId,
        jsonrpc: '2.0',
        method,
        params,
      }),
    });

    // const resForLog = res.clone();
    // const resText = await resForLog.text();
    // console.debug('ethRpc:res:raw', rpcUrl, method, resText);

    const resBody = await res.json();

    if (resBody?.error !== undefined) {
      // console.debug('ethRpc:res:err', rpcUrl, method, resBody);

      throw new Error(JSON.stringify(resBody.error));
    }

    // console.debug('ethRpc:res', rpcUrl, method, resBody);

    return resBody;
  }
  catch (error) {
    // console.debug('ethRpc:err', rpcUrl, method, error);

    if (error instanceof Error && error.message.includes('nonce too low')) {
      throw new Error(`nonce too low: ${JSON.stringify(error)}`);
    }

    if (error instanceof Error && error.message.includes('invalid argument')) {
      throw new Error(`invalid argument: ${JSON.stringify(error)}`);
    }

    if (error instanceof Error && error.message.includes('required exceeds allowance')) {
      throw new Error(`required exceeds allowance: ${JSON.stringify(error)}`);
    }

    limitedRpcUrlMap.set(rpcUrl, {
      limitUntil: Date.now() + 1000 * 60 * 5, // 5 minutes
    });

    // retry indefinitely
    return await ethRpcFetch(client, reqId, method, params);
  }
}

/**
 * @param {PublicClient} client
 * @returns {Promise<bigint>}
 */
export async function ethBlockNumber(client) {
  const reqId = randomUUID().toUpperCase();

  const resBody = await ethRpcFetch(client, reqId, 'eth_blockNumber', []);

  if (typeof resBody !== 'object' || resBody === null) {
    throw new Error(`expect object, got ${resBody}`);
  }

  if (!('result' in resBody) || typeof resBody?.result !== 'string' || !resBody.result.startsWith('0x')) {
    throw new Error(`expect hex string, got ${JSON.stringify(resBody)}`);
  }

  return BigInt(resBody.result);
}

/**
 * @param {PublicClient} client
 * @param {TransactionRequest} transaction
 * @returns {Promise<Hex>}
 */
export async function ethCall(client, transaction) {
  const reqId = randomUUID().toUpperCase();

  const resBody = await ethRpcFetch(client, reqId, 'eth_call', [transaction, 'latest']);

  if (typeof resBody !== 'object' || resBody === null) {
    throw new Error(`expect object, got ${resBody}`);
  }

  if (!('result' in resBody) || typeof resBody?.result !== 'string' || !resBody.result.startsWith('0x')) {
    throw new Error(`expect hex string, got ${JSON.stringify(resBody)}`);
  }

  return resBody.result;
}

/**
 * @param {PublicClient} client
 * @returns {Promise<bigint>}
 */
export async function ethGasPrice(client) {
  const reqId = randomUUID().toUpperCase();

  const resBody = await ethRpcFetch(client, reqId, 'eth_gasPrice', []);

  if (typeof resBody !== 'object' || resBody === null) {
    throw new Error(`expect object, got ${resBody}`);
  }

  if (!('result' in resBody) || typeof resBody?.result !== 'string' || !resBody.result.startsWith('0x')) {
    throw new Error(`expect hex string, got ${JSON.stringify(resBody)}`);
  }

  return BigInt(resBody.result);
}

/**
 * @param {PublicClient} client
 * @param {bigint} blockNumber
 * @param {boolean} [includeTransactions=false]
 * @returns {Promise<import('viem').Block>}
 */
export async function ethGetBlockByNumber(client, blockNumber, includeTransactions = false) {
  const reqId = randomUUID().toUpperCase();

  const resBody = await ethRpcFetch(client, reqId, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, includeTransactions]);

  if (typeof resBody !== 'object' || resBody === null) {
    throw new Error(`expect object, got ${resBody}`);
  }

  if (!('result' in resBody) || typeof resBody?.result !== 'object' || resBody.result === null) {
    throw new Error(`expect object, got ${JSON.stringify(resBody)}`);
  }

  return resBody.result;
}

/**
 * @param {PublicClient} client
 * @param {Address} address
 * @param {string} blockTag
 */
export async function ethGetTransactionCount(client, address, blockTag = 'latest') {
  const reqId = randomUUID().toUpperCase();

  const resBody = await ethRpcFetch(client, reqId, 'eth_getTransactionCount', [address, blockTag]);

  if (typeof resBody !== 'object' || resBody === null) {
    throw new Error(`expect object, got ${resBody}`);
  }

  if (!('result' in resBody) || typeof resBody?.result !== 'string' || !resBody.result.startsWith('0x')) {
    throw new Error(`expect hex string, got ${JSON.stringify(resBody)}`);
  }

  return BigInt(resBody.result);
}

/**
 * @param {PublicClient} client
 * @param {Hash} hash
 * @returns {Promise<import('viem').Transaction<Hex>>}
 */
export async function ethGetTransactionByHash(client, hash) {
  const reqId = randomUUID().toUpperCase();

  const resBody = await ethRpcFetch(client, reqId, 'eth_getTransactionByHash', [hash]);

  if (typeof resBody !== 'object' || resBody === null) {
    throw new Error(`expect object, got ${resBody}`);
  }

  if (!('result' in resBody) || typeof resBody?.result !== 'object' || resBody.result === null) {
    throw new Error(`expect object, got ${JSON.stringify(resBody)}`);
  }

  return resBody.result;
}

/**
 * @param {PublicClient} client
 * @param {Hash} hash
 * @returns {Promise<import('viem').TransactionReceipt>}
 */
export async function ethGetTransactionReceipt(client, hash) {
  const reqId = randomUUID().toUpperCase();

  const resBody = await ethRpcFetch(client, reqId, 'eth_getTransactionReceipt', [hash]);

  if (typeof resBody !== 'object' || resBody === null) {
    throw new Error(`expect object, got ${resBody}`);
  }

  if (!('result' in resBody) || typeof resBody?.result !== 'object' || resBody.result === null) {
    throw new Error(`expect object, got ${JSON.stringify(resBody)}`);
  }

  if (!('logs' in resBody.result) || !Array.isArray(resBody.result.logs)) {
    throw new Error(`expect logs to be an array, got ${JSON.stringify(resBody)}`);
  }

  return resBody.result;
}

/**
 * @param {PublicClient} client
 * @param {TransactionRequest} transaction
 */
export async function ethEstimateGas(client, transaction) {
  const reqId = randomUUID().toUpperCase();

  const resBody = await ethRpcFetch(client, reqId, 'eth_estimateGas', [transaction]);

  if (typeof resBody !== 'object' || resBody === null) {
    throw new Error(`expect object, got ${resBody}`);
  }

  if (!('result' in resBody) || typeof resBody?.result !== 'string' || !resBody.result.startsWith('0x')) {
    throw new Error(`expect hex string, got ${JSON.stringify(resBody)}`);
  }

  return BigInt(resBody.result);
}

/**
 * Send raw transaction to all rpc urls
 *
 * @param {PublicClient} client
 * @param {Hex} serializedTransaction
 * @returns {Promise<Hash>}
 */
export async function ethSendRawTransaction(client, serializedTransaction) {
  const rpcUrls = client.chain?.rpcUrls.default.http ?? [];

  const { hashes, errors } = await Promise
    .allSettled(rpcUrls.map(async function (rpcUrl) {

      const reqId = randomUUID().toUpperCase();

      const reqBody = JSON.stringify({
        id: reqId,
        jsonrpc: '2.0',
        method: 'eth_sendRawTransaction',
        params: [serializedTransaction],
      });

      console.info('SendRawTransaction', rpcUrl, reqBody);

      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: reqBody,
      });

      const resBody = await res.json();

      if (resBody.error !== undefined) {
        throw JSON.stringify(resBody.error);
      }

      if (typeof resBody !== 'object' || resBody === null) {
        throw `expect object, got ${resBody}`;
      }

      if (!('result' in resBody) || typeof resBody?.result !== 'string' || !resBody.result.startsWith('0x')) {
        throw `expect hex string, got ${JSON.stringify(resBody)}`;
      }

      const txHash = resBody.result;

      if (!isHash(txHash)) {
        throw `invalid transaction hash: ${JSON.stringify({ txHash })}`;
      }

      console.info('RawTransactionSent', rpcUrl, txHash);

      return txHash;
    }))
    .then(function (results) {
      return {
        hashes: results.filter((result) => result.status === 'fulfilled').map((result) => result.value),
        errors: results.filter((result) => result.status === 'rejected').map((result) => result.reason),
      };
    });

  if (hashes.length === 0) {
    throw new Error(`Failed to send transaction: ${errors.join(', ')}`);
  }

  return hashes[0];
}

/**
 * Get native balance or ERC20 token balance
 *
 * @param {PublicClient} client
 * @param {'0x'|Address} tokenAddress
 * @param {Address} address
 * @returns {Promise<bigint>}
 */
export async function ethGetNativeOrERC20Balance(client, tokenAddress, address) {
  const reqId = randomUUID().toUpperCase();

  if (tokenAddress === '0x') {
    const resBody = await ethRpcFetch(client, reqId, 'eth_getBalance', [address, 'latest']);

    if (typeof resBody !== 'object' || resBody === null) {
      throw new Error(`expect object, got ${resBody}`);
    }

    if (!('result' in resBody) || typeof resBody?.result !== 'string' || !resBody.result.startsWith('0x')) {
      throw new Error(`expect hex string, got ${JSON.stringify(resBody)}`);
    }

    return BigInt(resBody.result);
  }
  else if (isAddress(tokenAddress)) {
    const resBody = await ethRpcFetch(client, reqId, 'eth_call', [{
      to: tokenAddress,
      data: encodeFunctionData({
        abi: parseAbi([
          'function balanceOf(address) public view returns (uint256)',
        ]),
        functionName: 'balanceOf',
        args: [address],
      }),
    }, 'latest']);

    if (typeof resBody !== 'object' || resBody === null) {
      throw new Error(`expect object, got ${resBody}`);
    }

    if (!('result' in resBody) || typeof resBody?.result !== 'string' || !resBody.result.startsWith('0x')) {
      throw new Error(`expect hex string, got ${JSON.stringify(resBody)}`);
    }

    return BigInt(resBody.result);
  }
  else {
    throw new Error(`expect token address to be '0x' or an address, got ${tokenAddress}`);
  }
}
