import { Injectable, UnprocessableEntityException } from '@nestjs/common';

import { assertDefined, assertPropNumber, assertPropString } from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { CurrencyConfigDto, CurrencyConfigUpdateDto } from './dto/admin-currencies.dto';

@Injectable()
export class AdminCurrenciesService {
  private readonly logger = new TelemetryLogger(AdminCurrenciesService.name);

  constructor(private readonly repo: CryptogadaiRepository) {}

  async getCurrencies(): Promise<CurrencyConfigDto[]> {
    // Get all currencies with their configurations
    // All rates and ratios are stored in 0-1 decimal format
    const rows = await this.repo.sql`
      SELECT
        blockchain_key,
        token_id,
        name,
        symbol,
        decimals,
        image,
        COALESCE(withdrawal_fee_rate, 0)::FLOAT as withdrawal_fee_rate,
        COALESCE(min_withdrawal_amount, '0')::TEXT as min_withdrawal_amount,
        COALESCE(max_withdrawal_amount, '0')::TEXT as max_withdrawal_amount,
        COALESCE(max_daily_withdrawal_amount, '0')::TEXT as max_daily_withdrawal_amount,
        COALESCE(min_loan_principal_amount, '0')::TEXT as min_loan_principal_amount,
        COALESCE(max_loan_principal_amount, '0')::TEXT as max_loan_principal_amount,
        COALESCE(max_ltv, 0)::FLOAT as max_ltv,
        COALESCE(ltv_warning_threshold, 0)::FLOAT as ltv_warning_threshold,
        COALESCE(ltv_critical_threshold, 0)::FLOAT as ltv_critical_threshold,
        COALESCE(ltv_liquidation_threshold, 0)::FLOAT as ltv_liquidation_threshold
      FROM currencies
      ORDER BY blockchain_key, token_id
    `;

    this.logger.log(`Found ${rows.length} currencies in database`);

    return rows.map((row: unknown) => {
      assertDefined(row);
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'token_id');
      assertPropString(row, 'name');
      assertPropString(row, 'symbol');
      assertPropNumber(row, 'decimals');
      assertPropString(row, 'image');
      assertPropNumber(row, 'withdrawal_fee_rate');
      assertPropString(row, 'min_withdrawal_amount');
      assertPropString(row, 'max_withdrawal_amount');
      assertPropString(row, 'max_daily_withdrawal_amount');
      assertPropString(row, 'min_loan_principal_amount');
      assertPropString(row, 'max_loan_principal_amount');
      assertPropNumber(row, 'max_ltv');
      assertPropNumber(row, 'ltv_warning_threshold');
      assertPropNumber(row, 'ltv_critical_threshold');
      assertPropNumber(row, 'ltv_liquidation_threshold');

      return {
        blockchainKey: row.blockchain_key,
        tokenId: row.token_id,
        name: row.name,
        symbol: row.symbol,
        decimals: row.decimals,
        image: row.image,
        withdrawalFeeRate: row.withdrawal_fee_rate,
        minWithdrawalAmount: row.min_withdrawal_amount,
        maxWithdrawalAmount: row.max_withdrawal_amount,
        maxDailyWithdrawalAmount: row.max_daily_withdrawal_amount,
        minLoanPrincipalAmount: row.min_loan_principal_amount,
        maxLoanPrincipalAmount: row.max_loan_principal_amount,
        maxLtv: row.max_ltv,
        ltvWarningThreshold: row.ltv_warning_threshold,
        ltvCriticalThreshold: row.ltv_critical_threshold,
        ltvLiquidationThreshold: row.ltv_liquidation_threshold,
      };
    });
  }

  async updateCurrencyConfig(
    blockchainKey: string,
    tokenId: string,
    updateData: CurrencyConfigUpdateDto,
  ): Promise<CurrencyConfigDto | null> {
    try {
      // First check if currency exists (before validation to return 404 for non-existent currencies)
      const currencyRows = await this.repo.sql`
        SELECT blockchain_key, token_id, name, symbol, decimals, image
        FROM currencies
        WHERE blockchain_key = ${blockchainKey} AND token_id = ${tokenId}
      `;

      if (currencyRows.length === 0) {
        return null;
      }

      const currency = currencyRows[0] as any;

      // Validate LTV threshold ordering
      if (updateData.ltvWarningThreshold > updateData.ltvCriticalThreshold) {
        throw new UnprocessableEntityException(
          'LTV warning threshold must be less than or equal to critical threshold',
        );
      }
      if (updateData.ltvCriticalThreshold > updateData.ltvLiquidationThreshold) {
        throw new UnprocessableEntityException(
          'LTV critical threshold must be less than or equal to liquidation threshold',
        );
      }
      if (updateData.ltvLiquidationThreshold > updateData.maxLtv) {
        throw new UnprocessableEntityException(
          'LTV liquidation threshold must be less than or equal to maximum LTV',
        );
      }

      // Update currency configuration
      // All rates and ratios are stored in 0-1 decimal format
      await this.repo.sql`
        UPDATE currencies SET
          withdrawal_fee_rate = ${updateData.withdrawalFeeRate},
          min_withdrawal_amount = ${updateData.minWithdrawalAmount},
          max_withdrawal_amount = ${updateData.maxWithdrawalAmount},
          max_daily_withdrawal_amount = ${updateData.maxDailyWithdrawalAmount},
          min_loan_principal_amount = ${updateData.minLoanPrincipalAmount},
          max_loan_principal_amount = ${updateData.maxLoanPrincipalAmount},
          max_ltv = ${updateData.maxLtv},
          ltv_warning_threshold = ${updateData.ltvWarningThreshold},
          ltv_critical_threshold = ${updateData.ltvCriticalThreshold},
          ltv_liquidation_threshold = ${updateData.ltvLiquidationThreshold}
        WHERE blockchain_key = ${blockchainKey} AND token_id = ${tokenId}
      `;

      this.logger.log('Currency configuration updated', {
        blockchainKey,
        tokenId,
      });

      // Return updated currency config
      return {
        blockchainKey: currency.blockchain_key,
        tokenId: currency.token_id,
        name: currency.name,
        symbol: currency.symbol,
        decimals: currency.decimals,
        image: currency.image,
        withdrawalFeeRate: updateData.withdrawalFeeRate,
        minWithdrawalAmount: updateData.minWithdrawalAmount,
        maxWithdrawalAmount: updateData.maxWithdrawalAmount,
        maxDailyWithdrawalAmount: updateData.maxDailyWithdrawalAmount,
        minLoanPrincipalAmount: updateData.minLoanPrincipalAmount,
        maxLoanPrincipalAmount: updateData.maxLoanPrincipalAmount,
        maxLtv: updateData.maxLtv,
        ltvWarningThreshold: updateData.ltvWarningThreshold,
        ltvCriticalThreshold: updateData.ltvCriticalThreshold,
        ltvLiquidationThreshold: updateData.ltvLiquidationThreshold,
      };
    } catch (error) {
      this.logger.error('Failed to update currency configuration', {
        error: error.message,
        blockchainKey,
        tokenId,
      });
      throw error;
    }
  }
}
