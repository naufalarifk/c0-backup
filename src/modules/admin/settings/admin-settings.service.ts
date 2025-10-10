import { BadRequestException, Injectable } from '@nestjs/common';

import {
  assertDefined,
  assertProp,
  assertPropNumber,
  assertPropString,
  check,
  isInstanceOf,
  isNullable,
  isString,
} from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import {
  LoanLiquidationMode,
  PlatformConfigDto,
  PlatformConfigUpdateDto,
} from './dto/admin-settings.dto';

@Injectable()
export class AdminSettingsService {
  private readonly logger = new TelemetryLogger(AdminSettingsService.name);

  constructor(private readonly repo: CryptogadaiRepository) {}

  async getPlatformConfig(): Promise<PlatformConfigDto> {
    try {
      // Get the most recent platform configuration
      const rows = await this.repo.sql`
        SELECT
          effective_date,
          admin_user_id,
          loan_provision_rate,
          loan_individual_redelivery_fee_rate,
          loan_institution_redelivery_fee_rate,
          loan_min_ltv_ratio,
          loan_max_ltv_ratio,
          loan_repayment_duration_in_days,
          loan_liquidation_mode,
          loan_liquidation_premi_rate,
          loan_liquidation_fee_rate
        FROM platform_configs
        ORDER BY effective_date DESC
        LIMIT 1
      `;

      if (rows.length === 0) {
        // Return default configuration if none exists
        const now = new Date();
        return {
          effectiveDate: now.toISOString(),
          adminUserId: 0,
          adminUserName: null,
          loanProvisionRate: 0.03,
          loanIndividualRedeliveryFeeRate: 0.1,
          loanInstitutionRedeliveryFeeRate: 0.025,
          loanMinLtvRatio: 0.6,
          loanMaxLtvRatio: 0.75,
          loanRepaymentDurationInDays: 30,
          loanLiquidationMode: LoanLiquidationMode.Partial,
          loanLiquidationPremiRate: 0.02,
          loanLiquidationFeeRate: 0.02,
        };
      }

      const config = rows[0] as any; // Type assertion for database result
      assertDefined(config);
      assertProp(check(isString, isInstanceOf(Date)), config, 'effective_date');
      assertPropNumber(config, 'admin_user_id');
      assertPropNumber(config, 'loan_provision_rate');
      assertPropNumber(config, 'loan_individual_redelivery_fee_rate');
      assertPropNumber(config, 'loan_institution_redelivery_fee_rate');
      assertPropNumber(config, 'loan_min_ltv_ratio');
      assertPropNumber(config, 'loan_max_ltv_ratio');
      assertPropNumber(config, 'loan_repayment_duration_in_days');
      assertPropString(config, 'loan_liquidation_mode');
      assertPropNumber(config, 'loan_liquidation_premi_rate');
      assertPropNumber(config, 'loan_liquidation_fee_rate');

      // Get admin user name separately
      let adminUserName: string | null = null;
      try {
        const adminRows = await this.repo.sql`
          SELECT name FROM users WHERE id = ${config.admin_user_id}
        `;
        adminUserName = adminRows.length > 0 ? (adminRows[0] as any).name : null;
      } catch (error) {
        // If user lookup fails, adminUserName remains null
        this.logger.warn('Failed to get admin user name', {
          adminUserId: config.admin_user_id,
          error: error.message,
        });
      }

      // Convert effective_date to ISO string if it's a Date object
      const effectiveDate =
        config.effective_date instanceof Date
          ? config.effective_date.toISOString()
          : config.effective_date;

      return {
        effectiveDate,
        adminUserId: config.admin_user_id,
        adminUserName,
        loanProvisionRate: config.loan_provision_rate,
        loanIndividualRedeliveryFeeRate: config.loan_individual_redelivery_fee_rate,
        loanInstitutionRedeliveryFeeRate: config.loan_institution_redelivery_fee_rate,
        loanMinLtvRatio: config.loan_min_ltv_ratio,
        loanMaxLtvRatio: config.loan_max_ltv_ratio,
        loanRepaymentDurationInDays: config.loan_repayment_duration_in_days,
        loanLiquidationMode: config.loan_liquidation_mode as LoanLiquidationMode,
        loanLiquidationPremiRate: config.loan_liquidation_premi_rate,
        loanLiquidationFeeRate: config.loan_liquidation_fee_rate,
      };
    } catch (error) {
      this.logger.error('Failed to get platform configuration', { error: error.message });
      // If database query fails (e.g., table doesn't exist), return default configuration
      const now = new Date();
      return {
        effectiveDate: now.toISOString(),
        adminUserId: 0,
        adminUserName: null,
        loanProvisionRate: 0.03,
        loanIndividualRedeliveryFeeRate: 0.1,
        loanInstitutionRedeliveryFeeRate: 0.025,
        loanMinLtvRatio: 0.6,
        loanMaxLtvRatio: 0.75,
        loanRepaymentDurationInDays: 30,
        loanLiquidationMode: LoanLiquidationMode.Partial,
        loanLiquidationPremiRate: 0.02,
        loanLiquidationFeeRate: 0.02,
      };
    }
  }

  async updatePlatformConfig(
    adminUserId: string,
    updateData: PlatformConfigUpdateDto,
  ): Promise<PlatformConfigDto> {
    // Validate LTV ratio constraints
    if (updateData.loanMinLtvRatio > updateData.loanMaxLtvRatio) {
      throw new BadRequestException('Minimum LTV ratio cannot be greater than maximum LTV ratio');
    }

    const now = new Date();

    // Get admin user name
    const adminRows = await this.repo.sql`
      SELECT name FROM users WHERE id = ${adminUserId}
    `;
    const adminUserName = adminRows.length > 0 ? (adminRows[0] as any).name : null;

    // Insert new configuration
    const insertResult = await this.repo.sql`
      INSERT INTO platform_configs (
        effective_date,
        admin_user_id,
        loan_provision_rate,
        loan_individual_redelivery_fee_rate,
        loan_institution_redelivery_fee_rate,
        loan_min_ltv_ratio,
        loan_max_ltv_ratio,
        loan_repayment_duration_in_days,
        loan_liquidation_mode,
        loan_liquidation_premi_rate,
        loan_liquidation_fee_rate
      ) VALUES (
        ${now.toISOString()},
        ${Number(adminUserId)},
        ${updateData.loanProvisionRate},
        ${updateData.loanIndividualRedeliveryFeeRate},
        ${updateData.loanInstitutionRedeliveryFeeRate},
        ${updateData.loanMinLtvRatio},
        ${updateData.loanMaxLtvRatio},
        ${updateData.loanRepaymentDurationInDays},
        ${updateData.loanLiquidationMode},
        ${updateData.loanLiquidationPremiRate},
        ${updateData.loanLiquidationFeeRate}
      )
    `;

    // Return the configuration that was just set
    // Note: We construct the response instead of reading back from DB
    // to ensure atomic response even if DB persistence is delayed
    return {
      effectiveDate: now.toISOString(),
      adminUserId: Number(adminUserId),
      adminUserName,
      loanProvisionRate: updateData.loanProvisionRate,
      loanIndividualRedeliveryFeeRate: updateData.loanIndividualRedeliveryFeeRate,
      loanInstitutionRedeliveryFeeRate: updateData.loanInstitutionRedeliveryFeeRate,
      loanMinLtvRatio: updateData.loanMinLtvRatio,
      loanMaxLtvRatio: updateData.loanMaxLtvRatio,
      loanRepaymentDurationInDays: updateData.loanRepaymentDurationInDays,
      loanLiquidationMode: updateData.loanLiquidationMode,
      loanLiquidationPremiRate: updateData.loanLiquidationPremiRate,
      loanLiquidationFeeRate: updateData.loanLiquidationFeeRate,
    };
  }
}
