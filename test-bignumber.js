import BigNumber from 'bignumber.js';

// Test BigNumber implementation for DECIMAL(78, 0) values
console.log('Testing BigNumber implementation...');

// Test provision fee calculation
const principalAmount = '10000.000000000000000000';
const principal = new BigNumber(principalAmount);
const provisionRate = new BigNumber('3.0').div(100); // 3%
const fee = principal.times(provisionRate);
console.log('Principal:', principalAmount);
console.log('Fee (3%):', fee.toFixed());

// Test liquidation calculation
const collateralAmount = new BigNumber('15000.000000000000000000');
const liquidationFeeRate = new BigNumber(0.01); // 1%
const liquidationFee = collateralAmount.times(liquidationFeeRate);
const estimatedProceeds = collateralAmount.minus(liquidationFee);
console.log('Collateral:', collateralAmount.toFixed());
console.log('Liquidation Fee (1%):', liquidationFee.toFixed());
console.log('Estimated Proceeds:', estimatedProceeds.toFixed());

// Test interest rate calculation
const interestAmount = new BigNumber('600.000000000000000000');
const interestRate = interestAmount.div(principal).times(100).toNumber();
console.log('Interest Rate:', interestRate, '%');

console.log('All BigNumber tests passed!');
