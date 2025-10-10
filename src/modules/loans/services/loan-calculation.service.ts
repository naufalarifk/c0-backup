import { Injectable } from '@nestjs/common';

import { BigNumber } from 'bignumber.js';

export interface Currency {
  blockchainKey: string;
  tokenId: string;
  decimals: number;
  symbol: string;
  name: string;
}

export interface ExchangeRate {
  id: string | number;
  bidPrice: string;
  askPrice: string;
  sourceDate: Date;
}

export interface PlatformConfig {
  loanProvisionRate: string | number;
  loanMinLtvRatio: string | number;
  loanMaxLtvRatio: string | number;
}

export interface LoanRequirementsCalculationParams {
  principalAmount: string;
  principalCurrency: Currency;
  collateralCurrency: Currency;
  platformConfig: PlatformConfig;
  exchangeRate: ExchangeRate;
  termInMonths: number;
  calculationDate: Date;
}

export interface LoanRequirementsCalculationResult {
  principalAmount: string;
  principalCurrency: Currency;
  collateralCurrency: Currency;
  requiredCollateralAmount: string;
  minLtvRatio: number;
  maxLtvRatio: number;
  provisionAmount: string;
  provisionRate: number;
  exchangeRate: {
    id: string;
    rate: string;
    timestamp: Date;
  };
  termInMonths: number;
  expirationDate: Date;
}

export interface LoanApplicationCalculationParams {
  principalAmount: string;
  principalCurrency: Currency;
  collateralCurrency: Currency;
  platformConfig: PlatformConfig;
  exchangeRate: ExchangeRate;
  appliedDate: Date;
}

export interface LoanApplicationCalculationResult {
  provisionAmount: string;
  minLtvRatio: number;
  maxLtvRatio: number;
  collateralDepositAmount: string;
}

export interface EarlyLiquidationEstimateParams {
  principalAmount: string;
  interestAmount: string;
  premiAmount: string;
  liquidationFeeAmount: string;
  collateralAmount: string;
  exchangeRate: ExchangeRate;
  estimateDate: Date;
}

export interface EarlyLiquidationEstimateResult {
  totalOutstandingAmount: string;
  currentValuationAmount: string;
  currentLtvRatio: number;
  estimatedLiquidationAmount: string;
  estimatedSurplusDeficit: string;
  estimatedSlippage: number;
}

export interface EarlyRepaymentCalculationParams {
  principalAmount: string;
  interestAmount: string;
  premiAmount: string;
  repaymentAmount: string;
  originationDate: Date;
  maturityDate: Date;
  termInMonths: number;
  requestDate: Date;
}

export interface EarlyRepaymentCalculationResult {
  totalRepaymentAmount: string;
  fullInterestCharged: boolean;
  remainingTermDays: number;
  earlyRepaymentDate: Date;
}

@Injectable()
export class LoanCalculationService {
  /**
   * Converts an amount from human-readable units to smallest units (like wei, satoshi, lamports)
   */
  public toSmallestUnit(amount: string, decimals: number): string {
    const bn = new BigNumber(amount);
    const multiplier = new BigNumber(10).pow(decimals);
    return bn.multipliedBy(multiplier).integerValue(BigNumber.ROUND_DOWN).toFixed(0);
  }

  /**
   * Converts an amount from smallest units to human-readable units
   */
  public fromSmallestUnit(amount: string, decimals: number): string {
    const bn = new BigNumber(amount);
    const divisor = new BigNumber(10).pow(decimals);
    return bn.dividedBy(divisor).toString();
  }

  /**
   * Converts percentage to decimal (e.g., 75 -> 0.75)
   * Used for interest rates which are stored as 0-100 in the database
   */
  private percentageToDecimal(percentage: string | number): BigNumber {
    return new BigNumber(percentage).dividedBy(100);
  }

  /**
   * Converts a rate/ratio that's already in decimal format (0-1) to BigNumber
   * Used for platform config rates/ratios which are stored as 0-1 in the database
   */
  private decimalToBigNumber(decimal: string | number): BigNumber {
    return new BigNumber(decimal);
  }

  /**
   * Calculate loan requirements including collateral amount, provision, and LTV ratios
   * NOTE: principalAmount is expected to be in smallest units
   */
  calculateLoanRequirements(
    params: LoanRequirementsCalculationParams,
  ): LoanRequirementsCalculationResult {
    const {
      principalAmount,
      principalCurrency,
      collateralCurrency,
      platformConfig,
      exchangeRate,
      termInMonths,
      calculationDate,
    } = params;

    // principalAmount is already in smallest units
    const principalAmountBN = new BigNumber(principalAmount);
    // Platform config rates/ratios are already in 0-1 decimal format
    const provisionRateBN = this.decimalToBigNumber(platformConfig.loanProvisionRate);
    const minLtvRatioBN = this.decimalToBigNumber(platformConfig.loanMinLtvRatio);
    const maxLtvRatioBN = this.decimalToBigNumber(platformConfig.loanMaxLtvRatio);

    // Exchange rate is stored in smallest units (e.g., 1000000000000000000 for 1.0 USD)
    // We need to convert it to decimal form by dividing by 10^decimals
    // Assuming the quote currency (USD) has 18 decimals
    const QUOTE_CURRENCY_DECIMALS = 18;
    const exchangeRateBN = new BigNumber(exchangeRate.bidPrice).dividedBy(
      new BigNumber(10).pow(QUOTE_CURRENCY_DECIMALS),
    );

    // Calculate provision amount (keep in smallest units)
    const provisionAmountBN = principalAmountBN.multipliedBy(provisionRateBN);
    const provisionAmount = provisionAmountBN.integerValue(BigNumber.ROUND_DOWN).toString();

    // Convert principal amount to human units for exchange rate calculation
    const principalAmountHuman = this.fromSmallestUnit(principalAmount, principalCurrency.decimals);
    const principalAmountHumanBN = new BigNumber(principalAmountHuman);

    // Calculate required collateral amount using minimum LTV ratio (more conservative)
    // Formula: collateralAmount = principalAmount / (minLtvRatio * exchangeRate)
    const requiredCollateralAmountHumanBN = principalAmountHumanBN
      .dividedBy(minLtvRatioBN.multipliedBy(exchangeRateBN))
      .integerValue(BigNumber.ROUND_UP);
    const requiredCollateralAmount = this.toSmallestUnit(
      requiredCollateralAmountHumanBN.toString(),
      collateralCurrency.decimals,
    );

    // Calculate expiration date (default to 30 days from calculation)
    const expirationDate = new Date(calculationDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      principalAmount,
      principalCurrency,
      collateralCurrency,
      requiredCollateralAmount,
      minLtvRatio: minLtvRatioBN.toNumber(),
      maxLtvRatio: maxLtvRatioBN.toNumber(),
      provisionAmount,
      provisionRate: new BigNumber(platformConfig.loanProvisionRate).toNumber(),
      exchangeRate: {
        id: String(exchangeRate.id),
        rate: exchangeRateBN.toString(),
        timestamp: exchangeRate.sourceDate,
      },
      termInMonths,
      expirationDate,
    };
  }

  /**
   * Calculate loan application parameters including provision and collateral deposit amounts
   * NOTE: principalAmount is expected to be in smallest units
   */
  calculateLoanApplicationParams(
    params: LoanApplicationCalculationParams,
  ): LoanApplicationCalculationResult {
    const { principalAmount, principalCurrency, collateralCurrency, platformConfig, exchangeRate } =
      params;

    // principalAmount is already in smallest units
    const principalAmountBN = new BigNumber(principalAmount);
    // Platform config rates/ratios are already in 0-1 decimal format
    const provisionRateBN = this.decimalToBigNumber(platformConfig.loanProvisionRate);
    const minLtvRatioBN = this.decimalToBigNumber(platformConfig.loanMinLtvRatio);
    const maxLtvRatioBN = this.decimalToBigNumber(platformConfig.loanMaxLtvRatio);

    // Exchange rate is stored in smallest units (e.g., 1000000000000000000 for 1.0 USD)
    // We need to convert it to decimal form by dividing by 10^decimals
    // Assuming the quote currency (USD) has 18 decimals
    const QUOTE_CURRENCY_DECIMALS = 18;
    const exchangeRateBN = new BigNumber(exchangeRate.bidPrice).dividedBy(
      new BigNumber(10).pow(QUOTE_CURRENCY_DECIMALS),
    );

    // Calculate provision amount (keep in smallest units)
    const provisionAmountBN = principalAmountBN.multipliedBy(provisionRateBN);
    const provisionAmount = provisionAmountBN.integerValue(BigNumber.ROUND_DOWN).toString();

    // Convert principal amount to human units for exchange rate calculation
    const principalAmountHuman = this.fromSmallestUnit(principalAmount, principalCurrency.decimals);
    const principalAmountHumanBN = new BigNumber(principalAmountHuman);

    // Calculate collateral deposit amount using minimum LTV ratio
    const collateralDepositAmountHumanBN = principalAmountHumanBN
      .dividedBy(minLtvRatioBN.multipliedBy(exchangeRateBN))
      .integerValue(BigNumber.ROUND_UP);
    const collateralDepositAmount = this.toSmallestUnit(
      collateralDepositAmountHumanBN.toString(),
      collateralCurrency.decimals,
    );

    return {
      provisionAmount,
      minLtvRatio: minLtvRatioBN.toNumber(),
      maxLtvRatio: maxLtvRatioBN.toNumber(),
      collateralDepositAmount,
    };
  }

  /**
   * Estimate early liquidation breakdown and surplus/deficit
   */
  calculateEarlyLiquidationEstimate(
    params: EarlyLiquidationEstimateParams,
  ): EarlyLiquidationEstimateResult {
    const {
      principalAmount,
      interestAmount,
      premiAmount,
      liquidationFeeAmount,
      collateralAmount,
      exchangeRate,
    } = params;

    // Convert to BigNumber for precise calculations
    const principalAmountBN = new BigNumber(principalAmount);
    const interestAmountBN = new BigNumber(interestAmount);
    const premiAmountBN = new BigNumber(premiAmount);
    const liquidationFeeAmountBN = new BigNumber(liquidationFeeAmount);
    const collateralAmountBN = new BigNumber(collateralAmount);
    const exchangeRateBN = new BigNumber(exchangeRate.bidPrice);

    // Calculate total outstanding amount
    const totalOutstandingAmountBN = principalAmountBN
      .plus(interestAmountBN)
      .plus(premiAmountBN)
      .plus(liquidationFeeAmountBN);

    // Calculate current valuation
    const currentValuationAmountBN = collateralAmountBN.multipliedBy(exchangeRateBN);

    // Calculate current LTV ratio
    const currentLtvRatio = principalAmountBN.dividedBy(currentValuationAmountBN).toNumber();

    // Apply estimated market slippage (2%)
    const estimatedSlippage = 0.02;
    const estimatedLiquidationAmountBN = currentValuationAmountBN.multipliedBy(
      new BigNumber(1).minus(estimatedSlippage),
    );

    // Calculate surplus or deficit
    const estimatedSurplusDeficitBN = estimatedLiquidationAmountBN.minus(totalOutstandingAmountBN);

    return {
      totalOutstandingAmount: totalOutstandingAmountBN
        .integerValue(BigNumber.ROUND_DOWN)
        .toString(),
      currentValuationAmount: currentValuationAmountBN
        .integerValue(BigNumber.ROUND_DOWN)
        .toString(),
      currentLtvRatio,
      estimatedLiquidationAmount: estimatedLiquidationAmountBN
        .integerValue(BigNumber.ROUND_DOWN)
        .toString(),
      estimatedSurplusDeficit: estimatedSurplusDeficitBN
        .integerValue(BigNumber.ROUND_DOWN)
        .toString(),
      estimatedSlippage,
    };
  }

  /**
   * Calculate early repayment details including remaining term and amounts
   */
  calculateEarlyRepaymentDetails(
    params: EarlyRepaymentCalculationParams,
  ): EarlyRepaymentCalculationResult {
    const { repaymentAmount, originationDate, maturityDate, requestDate } = params;

    // Calculate term details
    const totalTermDays = Math.ceil(
      (maturityDate.getTime() - originationDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const elapsedDays = Math.ceil(
      (requestDate.getTime() - originationDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const remainingTermDays = Math.max(0, totalTermDays - elapsedDays);

    // For early repayment, borrower still pays full interest (as per common lending practice)
    const fullInterestCharged = true;
    const totalRepaymentAmount = repaymentAmount; // Full repayment amount

    return {
      totalRepaymentAmount,
      fullInterestCharged,
      remainingTermDays,
      earlyRepaymentDate: requestDate,
    };
  }

  /**
   * Calculate liquidation target amount for early liquidation requests
   */
  calculateLiquidationTargetAmount(
    repaymentAmount: string,
    premiAmount: string,
    liquidationFeeAmount: string,
  ): string {
    const repaymentAmountBN = new BigNumber(repaymentAmount);
    const premiAmountBN = new BigNumber(premiAmount);
    const liquidationFeeAmountBN = new BigNumber(liquidationFeeAmount);

    return repaymentAmountBN.plus(premiAmountBN).plus(liquidationFeeAmountBN).toString();
  }

  /**
   * Calculate all loan origination parameters from matched offer and application
   * All amounts are expected to be in smallest units
   */
  calculateLoanOriginationParams(params: {
    principalAmount: string;
    interestRate: number; // 0-1 decimal (e.g., 0.05 = 5%)
    termInMonths: number;
    collateralAmount: string;
    matchedLtvRatio: number;
    matchedCollateralValuationAmount: string;
    provisionRate: number; // 0-1 decimal (e.g., 0.03 = 3%)
  }): {
    principalAmount: string;
    interestAmount: string;
    repaymentAmount: string;
    redeliveryFeeAmount: string;
    redeliveryAmount: string;
    premiAmount: string;
    liquidationFeeAmount: string;
    minCollateralValuation: string;
    mcLtvRatio: number;
    collateralAmount: string;
    maturityDate: Date;
  } {
    const {
      principalAmount,
      interestRate,
      termInMonths,
      collateralAmount,
      matchedLtvRatio,
      matchedCollateralValuationAmount,
      provisionRate,
    } = params;

    // Convert to BigNumber for precise calculations
    const principalAmountBN = new BigNumber(principalAmount);
    const interestRateBN = this.decimalToBigNumber(interestRate);
    const provisionRateBN = this.decimalToBigNumber(provisionRate);

    // Calculate interest amount (simple interest for the term)
    const interestAmountBN = principalAmountBN.multipliedBy(interestRateBN);
    const interestAmount = interestAmountBN.integerValue(BigNumber.ROUND_DOWN).toString();

    // Calculate provision/premi amount (origination fee)
    const premiAmountBN = principalAmountBN.multipliedBy(provisionRateBN);
    const premiAmount = premiAmountBN.integerValue(BigNumber.ROUND_DOWN).toString();

    // Calculate liquidation fee (fixed 2% of principal as per common practice)
    const liquidationFeeRateBN = this.decimalToBigNumber(0.02);
    const liquidationFeeAmountBN = principalAmountBN.multipliedBy(liquidationFeeRateBN);
    const liquidationFeeAmount = liquidationFeeAmountBN
      .integerValue(BigNumber.ROUND_DOWN)
      .toString();

    // Calculate repayment amount (principal + interest + provision)
    const repaymentAmountBN = principalAmountBN.plus(interestAmountBN).plus(premiAmountBN);
    const repaymentAmount = repaymentAmountBN.integerValue(BigNumber.ROUND_DOWN).toString();

    // Calculate redelivery fee (1% of interest amount)
    const redeliveryFeeRateBN = this.decimalToBigNumber(0.01);
    const redeliveryFeeAmountBN = interestAmountBN.multipliedBy(redeliveryFeeRateBN);
    const redeliveryFeeAmount = redeliveryFeeAmountBN.integerValue(BigNumber.ROUND_DOWN).toString();

    // Calculate redelivery amount (repayment - redelivery fee)
    const redeliveryAmountBN = repaymentAmountBN.minus(redeliveryFeeAmountBN);
    const redeliveryAmount = redeliveryAmountBN.integerValue(BigNumber.ROUND_DOWN).toString();

    // Calculate minimum collateral valuation (repayment + premi + liquidation fee)
    const minCollateralValuationBN = repaymentAmountBN.plus(liquidationFeeAmountBN);
    const minCollateralValuation = minCollateralValuationBN
      .integerValue(BigNumber.ROUND_DOWN)
      .toString();

    // Calculate margin call LTV ratio (principal / min collateral valuation)
    const mcLtvRatio = principalAmountBN.dividedBy(minCollateralValuationBN).toNumber();

    // Calculate maturity date (origination date + term in months)
    const originationDate = new Date();
    const maturityDate = new Date(originationDate);
    maturityDate.setMonth(maturityDate.getMonth() + termInMonths);

    return {
      principalAmount,
      interestAmount,
      repaymentAmount,
      redeliveryFeeAmount,
      redeliveryAmount,
      premiAmount,
      liquidationFeeAmount,
      minCollateralValuation,
      mcLtvRatio,
      collateralAmount,
      maturityDate,
    };
  }
}
