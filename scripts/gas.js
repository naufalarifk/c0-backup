const { createPublicClient, http, parseEther, formatEther, formatGwei, parseGwei } = require('viem');
const { mainnet } = require('viem/chains')

const client = createPublicClient({
  chain: mainnet,
  transport: http()
})

// ============================================
// 🔥 SEMUA METHOD GAS ESTIMATION DI VIEM
// ============================================

async function gasEstimationMethods() {

  // 1️⃣ estimateGas - UNTUK GAS LIMIT
  console.log('=== 1. estimateGas (Gas Limit) ===')
  try {
    const gasLimit = await client.estimateGas({
      to: '0x638013655ef85c78240D030529e02Aed510c0CF2',
      value: parseEther('0.1')
    })
    console.log('Gas Limit:', gasLimit.toString()) // Contoh: 21000n
  } catch (error) {
    console.log('Error estimateGas:', error.message)
  }

  // 2️⃣ getGasPrice - LEGACY GAS PRICE (Pre EIP-1559)
  console.log('\n=== 2. getGasPrice (Legacy) ===')
  try {
    const gasPrice = await client.getGasPrice()
    console.log('Gas Price (wei):', gasPrice.toString())
    console.log('Gas Price (gwei):', formatGwei(gasPrice))
  } catch (error) {
    console.log('Error getGasPrice:', error.message)
  }

  // 3️⃣ estimateFeesPerGas - EIP-1559 FEE ESTIMATION (RECOMMENDED)
  console.log('\n=== 3. estimateFeesPerGas (EIP-1559) ===')
  try {
    const feeData = await client.estimateFeesPerGas()
    console.log('Max Fee Per Gas:', formatGwei(feeData.maxFeePerGas), 'gwei')
    console.log('Max Priority Fee:', formatGwei(feeData.maxPriorityFeePerGas), 'gwei')
  } catch (error) {
    console.log('Error estimateFeesPerGas:', error.message)
  }

  // 4️⃣ estimateMaxPriorityFeePerGas - HANYA PRIORITY FEE
  console.log('\n=== 4. estimateMaxPriorityFeePerGas ===')
  try {
    const priorityFee = await client.estimateMaxPriorityFeePerGas()
    console.log('Max Priority Fee:', formatGwei(priorityFee), 'gwei')
  } catch (error) {
    console.log('Error estimateMaxPriorityFeePerGas:', error.message)
  }

  // 5️⃣ COMPLETE CALCULATION - TOTAL TRANSACTION COST
  console.log('\n=== 5. COMPLETE COST CALCULATION ===')
  try {
    const amount = parseEther('0.1')

    // Get gas limit
    const gasLimit = await client.estimateGas({
      to: '0x742d35Cc6634C0532925a3b8D814532d5bC6f1cd',
      value: amount
    })

    // Get fee data
    const feeData = await client.estimateFeesPerGas()

    // Calculate total gas cost
    const totalGasCost = gasLimit * feeData.maxFeePerGas

    // Total transaction cost = amount + gas cost
    const totalTransactionCost = amount + totalGasCost

    console.log('📊 BREAKDOWN:')
    console.log('Amount to send:', formatEther(amount), 'ETH')
    console.log('Gas Limit:', gasLimit.toString())
    console.log('Max Fee Per Gas:', formatGwei(feeData.maxFeePerGas), 'gwei')
    console.log('Total Gas Cost:', formatEther(totalGasCost), 'ETH')
    console.log('💰 TOTAL DEDUCTION:', formatEther(totalTransactionCost), 'ETH')

    return {
      amount,
      gasLimit,
      gasPrice: feeData.maxFeePerGas,
      totalGasCost,
      totalTransactionCost
    }

  } catch (error) {
    console.log('Error in complete calculation:', error.message)
  }
}

// ============================================
// 🚀 CONTOH REAL WORLD USAGE
// ============================================

class TransactionCalculator {
  constructor() {
    this.client = client
  }

  // Method untuk cek berapa balance yang dibutuhin
  async calculateRequiredBalance(recipientAddress, amountToSend) {
    try {
      console.log('\n🧮 CALCULATING REQUIRED BALANCE...')

      // 1. Estimate gas limit
      const gasLimit = await this.client.estimateGas({
        to: recipientAddress,
        value: amountToSend
      })

      // 2. Get current gas prices
      const feeData = await this.client.estimateFeesPerGas()

      // 3. Calculate gas cost
      const gasCost = gasLimit * feeData.maxFeePerGas

      // 4. Total yang dibutuhkan
      const totalRequired = amountToSend + gasCost

      console.log('✅ RESULT:')
      console.log('Amount to send:', formatEther(amountToSend), 'ETH')
      console.log('Gas cost:', formatEther(gasCost), 'ETH')
      console.log('🔥 TOTAL BALANCE NEEDED:', formatEther(totalRequired), 'ETH')

      return {
        amountToSend: {
          wei: amountToSend,
          eth: formatEther(amountToSend)
        },
        gasCost: {
          wei: gasCost,
          eth: formatEther(gasCost),
          gasLimit: gasLimit.toString(),
          gasPrice: formatGwei(feeData.maxFeePerGas) + ' gwei'
        },
        totalRequired: {
          wei: totalRequired,
          eth: formatEther(totalRequired)
        }
      }

    } catch (error) {
      console.error('❌ Error calculating required balance:', error.message)
      throw error
    }
  }

  // Method untuk simulate transaction sebelum execute
  async simulateTransaction(from, to, value) {
    try {
      console.log('\n🎭 SIMULATING TRANSACTION...')

      // Simulate the transaction
      await this.client.call({
        account: from,
        to,
        value
      })

      console.log('✅ Transaction simulation SUCCESS')
      return true

    } catch (error) {
      console.log('❌ Transaction simulation FAILED:', error.message)
      return false
    }
  }
}

// ============================================
// 🏃‍♂️ EXAMPLE USAGE
// ============================================

async function main() {
  // Show all gas estimation methods
  await gasEstimationMethods()

  // Real world example
  const calculator = new TransactionCalculator()

  try {
    const result = await calculator.calculateRequiredBalance(
      '0x742d35Cc6634C0532925a3b8D814532d5bC6f1cd', // recipient
      parseEther('0.1') // 0.1 ETH
    )

    console.log('\n📋 SUMMARY FOR USER:')
    console.log('To send 0.1 ETH, you need:', result.totalRequired.eth, 'ETH in your wallet')
    console.log('Gas fee will be:', result.gasCost.eth, 'ETH')

  } catch (error) {
    console.log('Failed to calculate:', error.message)
  }
}

main()
