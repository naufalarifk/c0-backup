/**
 * Rate and Ratio Utilities
 *
 * This module provides utilities for handling rate and ratio values consistently across the application.
 *
 * CONVENTIONS:
 * - Storage format (database, internal calculations): 0-1 decimal (e.g., 0.75 = 75%)
 * - Display format (UI, some API responses): 0-100 percentage (e.g., 75 = 75%)
 * - All variables with rate/ratio data should have suffix: *Rate, *_rate, *Ratio, *_ratio
 */

import { BigNumber } from 'bignumber.js';

/**
 * Validates that a rate/ratio value is within the valid 0-1 range
 * @param value - The rate/ratio value to validate (0-1 decimal)
 * @param fieldName - Name of the field for error messages
 * @throws Error if value is outside 0-1 range
 */
export function validateRateRatio(value: number | string, fieldName: string): void {
  const numValue = typeof value === 'string' ? Number.parseFloat(value) : value;

  if (Number.isNaN(numValue)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (numValue < 0 || numValue > 1) {
    throw new Error(`${fieldName} must be between 0 and 1 (got ${numValue})`);
  }
}

/**
 * Validates that a percentage value is within the valid 0-100 range
 * @param value - The percentage value to validate (0-100)
 * @param fieldName - Name of the field for error messages
 * @throws Error if value is outside 0-100 range
 */
export function validatePercentage(value: number | string, fieldName: string): void {
  const numValue = typeof value === 'string' ? Number.parseFloat(value) : value;

  if (Number.isNaN(numValue)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (numValue < 0 || numValue > 100) {
    throw new Error(`${fieldName} must be between 0 and 100 (got ${numValue})`);
  }
}

/**
 * Converts a decimal rate/ratio (0-1) to percentage (0-100) for display purposes
 * @param decimal - Decimal value (0-1)
 * @returns Percentage value (0-100)
 * @example decimalToPercentage(0.75) // returns 75
 */
export function decimalToPercentage(decimal: number | string): number {
  const bn = new BigNumber(decimal);
  return bn.multipliedBy(100).toNumber();
}

/**
 * Converts a percentage (0-100) to decimal rate/ratio (0-1) for storage
 * @param percentage - Percentage value (0-100)
 * @returns Decimal value (0-1)
 * @example percentageToDecimal(75) // returns 0.75
 */
export function percentageToDecimal(percentage: number | string): number {
  const bn = new BigNumber(percentage);
  return bn.dividedBy(100).toNumber();
}

/**
 * Converts a decimal rate/ratio (0-1) to BigNumber for precise calculations
 * @param decimal - Decimal value (0-1)
 * @returns BigNumber instance
 */
export function decimalToBigNumber(decimal: number | string): BigNumber {
  return new BigNumber(decimal);
}

/**
 * Converts a percentage (0-100) to BigNumber decimal (0-1) for precise calculations
 * @param percentage - Percentage value (0-100)
 * @returns BigNumber instance in decimal format
 */
export function percentageToBigNumberDecimal(percentage: number | string): BigNumber {
  return new BigNumber(percentage).dividedBy(100);
}

/**
 * Formats a decimal rate/ratio (0-1) as a percentage string with specified decimal places
 * @param decimal - Decimal value (0-1)
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 * @example formatAsPercentage(0.7565, 2) // returns "75.65%"
 */
export function formatAsPercentage(decimal: number | string, decimalPlaces = 2): string {
  const percentage = decimalToPercentage(decimal);
  return `${percentage.toFixed(decimalPlaces)}%`;
}

/**
 * Ensures a value is in decimal format (0-1), converting from percentage if needed
 * This is useful when you're unsure of the input format
 * @param value - Value that might be decimal (0-1) or percentage (0-100)
 * @returns Decimal value (0-1)
 */
export function ensureDecimalFormat(value: number | string): number {
  const numValue = typeof value === 'string' ? Number.parseFloat(value) : value;

  // If value is > 1, assume it's a percentage and convert
  if (numValue > 1) {
    return percentageToDecimal(numValue);
  }

  return numValue;
}

/**
 * Type guard to check if a value is a valid rate/ratio (0-1)
 * @param value - Value to check
 * @returns true if value is a valid rate/ratio
 */
export function isValidRateRatio(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

/**
 * Type guard to check if a value is a valid percentage (0-100)
 * @param value - Value to check
 * @returns true if value is a valid percentage
 */
export function isValidPercentage(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 100;
}
