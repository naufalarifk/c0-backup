#!/usr/bin/env tsx

/**
 * Get Active Invoices
 *
 * This script retrieves information about active invoices including:
 * - Invoice ID
 * - Blockchain Key
 * - Token ID
 *
 * Active invoices are those with status: Pending, PartiallyPaid, Overdue
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SharedModule } from '../src/shared/shared.module';
import { Module } from '@nestjs/common';
import { assertArrayMapOf, assertPropString } from 'typeshaper';

@Module({
  imports: [SharedModule],
})
class GetActiveInvoicesModule {}

async function getActiveInvoices() {
  console.log('🔍 Getting Active Invoices\n');
  console.log('='.repeat(80));

  const app = await NestFactory.createApplicationContext(GetActiveInvoicesModule, {
    logger: ['error', 'warn'],
  });

  try {
    const repo = app.get('CryptogadaiRepository');

    // Query active invoices
    const activeInvoicesRows = await repo.sql`
      SELECT id, currency_blockchain_key, currency_token_id
      FROM invoices
      WHERE status IN ('Pending', 'PartiallyPaid', 'Overdue')
      ORDER BY id
    `;

    assertArrayMapOf(activeInvoicesRows, function (row) {
      assertPropString(row, 'id');
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      return row;
    });

    console.log(`\n📋 Found ${activeInvoicesRows.length} active invoice(s):\n`);

    if (activeInvoicesRows.length === 0) {
      console.log('   No active invoices found.');
    } else {
      console.log('   Invoice ID                    | Blockchain Key                          | Token ID');
      console.log('   ------------------------------|------------------------------------------|------------------------------------------');

      for (const invoice of activeInvoicesRows) {
        console.log(`   ${invoice.id.padEnd(30)} | ${invoice.currency_blockchain_key.padEnd(40)} | ${invoice.currency_token_id}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Query complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await app.close();
  }
}

getActiveInvoices()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });