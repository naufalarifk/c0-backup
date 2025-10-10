import type {
  ActiveLoanForValuation,
  ExchangeRateUpdatedEvent,
  LtvWarningLevel,
  ValuationCalculationResult,
} from './valuation.types';

import { Injectable, Logger } from '@nestjs/common';

import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isInstanceOf,
  isNumber,
  isString,
} from 'typeshaper';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { fromLowestDenomination } from '../../shared/utils/decimal';

@Injectable()
export class ValuationService {
  private readonly logger = new Logger(ValuationService.name);

  // LTV warning thresholds based on SRS-CG-v2.4-EN.md BR-011
  // When collateral value drops to these levels, warnings are triggered
  // LTV = Debt / Collateral Value
  private readonly WARNING_THRESHOLDS = {
    warning1: 1 / 1.15, // ~0.87 LTV - Collateral = Debt + 15%
    warning2: 1 / 1.1, // ~0.91 LTV - Collateral = Debt + 10%
    warning3: 1 / 1.05, // ~0.95 LTV - Collateral = Debt + 5%
    riskPremium: 1 / 1.02, // ~0.98 LTV - Collateral = Debt + 2% (pending order)
    liquidation: 1.0, // 100% LTV - Collateral = Debt (liquidation threshold)
  };

  constructor(private readonly repository: CryptogadaiRepository) {}

  /**
   * Retrieves all active loans that need valuation updates
   */
  async getActiveLoansForValuation(): Promise<ActiveLoanForValuation[]> {
    const rows = await this.repository.sql`
      SELECT
        l.id as loan_id,
        l.borrower_user_id,
        l.collateral_currency_blockchain_key,
        l.collateral_currency_token_id,
        l.collateral_amount,
        l.principal_currency_blockchain_key,
        l.principal_currency_token_id,
        l.principal_amount,
        l.interest_amount,
        l.premi_amount as provision_amount,
        l.current_ltv_ratio,
        l.mc_ltv_ratio,
        l.maturity_date,
        cc.decimals as collateral_decimals,
        pc.decimals as principal_decimals
      FROM loans l
      JOIN currencies cc ON l.collateral_currency_blockchain_key = cc.blockchain_key
        AND l.collateral_currency_token_id = cc.token_id
      JOIN currencies pc ON l.principal_currency_blockchain_key = pc.blockchain_key
        AND l.principal_currency_token_id = pc.token_id
      WHERE l.status = 'Active'
      ORDER BY l.current_ltv_ratio DESC
    `;

    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'loan_id');
      assertProp(check(isString, isNumber), row, 'borrower_user_id');
      assertPropString(row, 'collateral_currency_blockchain_key');
      assertPropString(row, 'collateral_currency_token_id');
      assertProp(check(isString, isNumber), row, 'collateral_amount');
      assertPropString(row, 'principal_currency_blockchain_key');
      assertPropString(row, 'principal_currency_token_id');
      assertProp(check(isString, isNumber), row, 'principal_amount');
      assertProp(check(isString, isNumber), row, 'interest_amount');
      assertProp(check(isString, isNumber), row, 'provision_amount');
      assertProp(check(isString, isNumber), row, 'current_ltv_ratio');
      assertProp(check(isString, isNumber), row, 'mc_ltv_ratio');
      assertProp(isInstanceOf(Date), row, 'maturity_date');
      assertProp(check(isString, isNumber), row, 'collateral_decimals');
      assertProp(check(isString, isNumber), row, 'principal_decimals');
      return row;
    });

    return rows.map(row => ({
      loanId: String(row.loan_id),
      borrowerUserId: String(row.borrower_user_id),
      collateralBlockchainKey: row.collateral_currency_blockchain_key,
      collateralTokenId: row.collateral_currency_token_id,
      collateralAmount: String(row.collateral_amount),
      collateralDecimals: Number(row.collateral_decimals),
      principalBlockchainKey: row.principal_currency_blockchain_key,
      principalTokenId: row.principal_currency_token_id,
      principalAmount: String(row.principal_amount),
      interestAmount: String(row.interest_amount),
      provisionAmount: String(row.provision_amount),
      principalDecimals: Number(row.principal_decimals),
      currentLtvRatio: Number(row.current_ltv_ratio),
      mcLtvRatio: Number(row.mc_ltv_ratio),
      maturityDate: row.maturity_date as Date,
    }));
  }

  /**
   * Calculates loan valuation using new exchange rate
   */
  async calculateLoanValuation(
    loan: ActiveLoanForValuation,
    exchangeRate: ExchangeRateUpdatedEvent,
  ): Promise<ValuationCalculationResult> {
    // Use mid price for valuation (average of bid and ask)
    const bidPrice = Number(exchangeRate.bidPrice);
    const askPrice = Number(exchangeRate.askPrice);
    const midPrice = (bidPrice + askPrice) / 2;

    // Convert collateral to human-readable for calculation
    const collateralAmountHuman = Number(
      fromLowestDenomination(loan.collateralAmount, loan.collateralDecimals),
    );

    // Calculate collateral valuation in principal currency
    const collateralValuationHuman = collateralAmountHuman * midPrice;

    // Calculate total debt (principal + interest + provision)
    const principalHuman = Number(
      fromLowestDenomination(loan.principalAmount, loan.principalDecimals),
    );
    const interestHuman = Number(
      fromLowestDenomination(loan.interestAmount, loan.principalDecimals),
    );
    const provisionHuman = Number(
      fromLowestDenomination(loan.provisionAmount, loan.principalDecimals),
    );
    const totalDebtHuman = principalHuman + interestHuman + provisionHuman;

    // Calculate new LTV ratio
    const newLtvRatio = totalDebtHuman / collateralValuationHuman;

    // Determine breached thresholds
    // We only trigger warnings when LTV crosses from below to above threshold
    const breachedThresholds: LtvWarningLevel[] = [];
    const previousLtvRatio = loan.currentLtvRatio;

    // Check thresholds in order of severity (liquidation first)
    if (
      newLtvRatio >= this.WARNING_THRESHOLDS.liquidation &&
      previousLtvRatio < this.WARNING_THRESHOLDS.liquidation
    ) {
      breachedThresholds.push('liquidation');
    } else if (
      newLtvRatio >= this.WARNING_THRESHOLDS.riskPremium &&
      previousLtvRatio < this.WARNING_THRESHOLDS.riskPremium
    ) {
      breachedThresholds.push('riskPremium');
    } else if (
      newLtvRatio >= this.WARNING_THRESHOLDS.warning3 &&
      previousLtvRatio < this.WARNING_THRESHOLDS.warning3
    ) {
      breachedThresholds.push('warning3');
    } else if (
      newLtvRatio >= this.WARNING_THRESHOLDS.warning2 &&
      previousLtvRatio < this.WARNING_THRESHOLDS.warning2
    ) {
      breachedThresholds.push('warning2');
    } else if (
      newLtvRatio >= this.WARNING_THRESHOLDS.warning1 &&
      previousLtvRatio < this.WARNING_THRESHOLDS.warning1
    ) {
      breachedThresholds.push('warning1');
    }

    // Convert back to smallest units for storage
    const collateralValuationAmount = String(
      Math.floor(collateralValuationHuman * 10 ** loan.principalDecimals),
    );
    const totalDebtAmount = String(Math.floor(totalDebtHuman * 10 ** loan.principalDecimals));

    return {
      loanId: loan.loanId,
      exchangeRateId: exchangeRate.exchangeRateId,
      valuationDate: exchangeRate.retrievalDate,
      collateralValuationAmount,
      newLtvRatio,
      previousLtvRatio,
      totalDebtAmount,
      breachedThresholds,
    };
  }

  /**
   * Updates loan valuation in database
   */
  async updateLoanValuation(valuation: ValuationCalculationResult): Promise<void> {
    try {
      await this.repository.platformUpdatesLoanValuations({
        loanId: valuation.loanId,
        exchangeRateId: valuation.exchangeRateId,
        valuationDate: valuation.valuationDate,
        ltvRatio: valuation.newLtvRatio,
        collateralValuationAmount: valuation.collateralValuationAmount,
      });

      this.logger.debug(
        `Updated valuation for loan ${valuation.loanId}: LTV ${valuation.previousLtvRatio.toFixed(4)} → ${valuation.newLtvRatio.toFixed(4)}`,
      );
    } catch (error) {
      this.logger.error(`Failed to update valuation for loan ${valuation.loanId}:`, error);
      throw error;
    }
  }

  /**
   * Processes valuation updates for all active loans based on exchange rate update
   */
  async processValuationUpdates(
    exchangeRate: ExchangeRateUpdatedEvent,
  ): Promise<ValuationCalculationResult[]> {
    this.logger.log(
      `Processing valuation updates for exchange rate ${exchangeRate.baseCurrencyTokenId}/${exchangeRate.quoteCurrencyTokenId}`,
    );

    const activeLoans = await this.getActiveLoansForValuation();
    const relevantLoans = activeLoans.filter(
      loan =>
        loan.collateralBlockchainKey === exchangeRate.blockchainKey &&
        loan.collateralTokenId === exchangeRate.baseCurrencyTokenId &&
        loan.principalTokenId === exchangeRate.quoteCurrencyTokenId,
    );

    this.logger.log(`Found ${relevantLoans.length} loans to update with new exchange rate`);

    const results: ValuationCalculationResult[] = [];

    for (const loan of relevantLoans) {
      try {
        const valuation = await this.calculateLoanValuation(loan, exchangeRate);
        await this.updateLoanValuation(valuation);
        results.push(valuation);
      } catch (error) {
        this.logger.error(`Failed to process valuation for loan ${loan.loanId}:`, error);
      }
    }

    this.logger.log(`Completed ${results.length} valuation updates`);
    return results;
  }

  /**
   * Gets loans approaching maturity for time-based warnings
   */
  async getLoansApproachingMaturity(daysUntilMaturity: number): Promise<ActiveLoanForValuation[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilMaturity);
    targetDate.setHours(23, 59, 59, 999); // End of day

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const rows = await this.repository.sql`
      SELECT
        l.id as loan_id,
        l.borrower_user_id,
        l.collateral_currency_blockchain_key,
        l.collateral_currency_token_id,
        l.collateral_amount,
        l.principal_currency_blockchain_key,
        l.principal_currency_token_id,
        l.principal_amount,
        l.interest_amount,
        l.premi_amount as provision_amount,
        l.current_ltv_ratio,
        l.mc_ltv_ratio,
        l.maturity_date,
        cc.decimals as collateral_decimals,
        pc.decimals as principal_decimals
      FROM loans l
      JOIN currencies cc ON l.collateral_currency_blockchain_key = cc.blockchain_key
        AND l.collateral_currency_token_id = cc.token_id
      JOIN currencies pc ON l.principal_currency_blockchain_key = pc.blockchain_key
        AND l.principal_currency_token_id = pc.token_id
      WHERE l.status = 'Active'
        AND l.maturity_date >= ${startOfDay.toISOString()}
        AND l.maturity_date <= ${targetDate.toISOString()}
    `;

    assertArrayMapOf(rows, row => {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'loan_id');
      assertProp(check(isString, isNumber), row, 'borrower_user_id');
      assertPropString(row, 'collateral_currency_blockchain_key');
      assertPropString(row, 'collateral_currency_token_id');
      assertProp(check(isString, isNumber), row, 'collateral_amount');
      assertPropString(row, 'principal_currency_blockchain_key');
      assertPropString(row, 'principal_currency_token_id');
      assertProp(check(isString, isNumber), row, 'principal_amount');
      assertProp(check(isString, isNumber), row, 'interest_amount');
      assertProp(check(isString, isNumber), row, 'provision_amount');
      assertProp(check(isString, isNumber), row, 'current_ltv_ratio');
      assertProp(check(isString, isNumber), row, 'mc_ltv_ratio');
      assertProp(isInstanceOf(Date), row, 'maturity_date');
      assertProp(check(isString, isNumber), row, 'collateral_decimals');
      assertProp(check(isString, isNumber), row, 'principal_decimals');
      return row;
    });

    return rows.map(row => ({
      loanId: String(row.loan_id),
      borrowerUserId: String(row.borrower_user_id),
      collateralBlockchainKey: row.collateral_currency_blockchain_key,
      collateralTokenId: row.collateral_currency_token_id,
      collateralAmount: String(row.collateral_amount),
      collateralDecimals: Number(row.collateral_decimals),
      principalBlockchainKey: row.principal_currency_blockchain_key,
      principalTokenId: row.principal_currency_token_id,
      principalAmount: String(row.principal_amount),
      interestAmount: String(row.interest_amount),
      provisionAmount: String(row.provision_amount),
      principalDecimals: Number(row.principal_decimals),
      currentLtvRatio: Number(row.current_ltv_ratio),
      mcLtvRatio: Number(row.mc_ltv_ratio),
      maturityDate: row.maturity_date as Date,
    }));
  }
}
