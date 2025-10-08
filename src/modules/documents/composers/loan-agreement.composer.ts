import type { GeneratedDocument, LoanAgreementData } from '../document.types';

import { promises as fs } from 'fs';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { v4 as uuidv4 } from 'uuid';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { DocumentComposer, DocumentComposerAbstract } from '../document-composer.abstract';

@Injectable()
@DocumentComposer('LoanAgreement')
export class LoanAgreementComposer extends DocumentComposerAbstract<LoanAgreementData> {
  private readonly logger = new TelemetryLogger(LoanAgreementComposer.name);

  async generateDocument(data: LoanAgreementData): Promise<GeneratedDocument> {
    this.logger.log(`Generating loan agreement for loan: ${data.loanId}`);

    const documentId = uuidv4();
    const fileName = `loan-agreement-${data.loanId}-${documentId}`;
    const outputDir = process.env.DOCUMENT_OUTPUT_DIR || '/tmp/claude/documents';
    const filePath = path.join(outputDir, fileName);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    const content = await this.generateDocumentContent(data);

    await fs.writeFile(filePath, content);
    const stats = await fs.stat(filePath);

    return {
      id: documentId,
      type: data.type,
      filePath,
      fileName,
      size: stats.size,
      createdAt: new Date(),
      metadata: {
        loanId: data.loanId,
        borrowerId: data.borrowerId,
        lenderId: data.lenderId,
      },
    };
  }

  private async generateHtmlContent(data: LoanAgreementData): Promise<string> {
    const template = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loan Agreement - ${data.loanId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .section { margin: 20px 0; }
        .terms { background: #f9f9f9; padding: 15px; border-left: 4px solid #007bff; }
        .signature-section { margin-top: 40px; display: flex; justify-content: space-between; }
        .signature-box { border: 1px solid #ccc; padding: 20px; width: 40%; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CRYPTO LOAN AGREEMENT</h1>
        <p><strong>Agreement ID:</strong> ${data.loanId}</p>
        <p><strong>Date:</strong> ${data.originationDate.toLocaleDateString()}</p>
    </div>

    <div class="section">
        <h2>PARTIES</h2>
        <p><strong>Borrower:</strong> ${data.borrower.name} (${data.borrower.email})</p>
        <p><strong>Lender:</strong> ${data.lender.name} (${data.lender.email}) - ${data.lender.type}</p>
        <p><strong>Platform:</strong> CryptoGadai Platform</p>
    </div>

    <div class="section">
        <h2>LOAN TERMS</h2>
        <table>
            <tr>
                <th>Principal Amount</th>
                <td>${data.principalAmount} ${data.principalCurrency.symbol}</td>
            </tr>
            <tr>
                <th>Collateral Amount</th>
                <td>${data.collateralAmount} ${data.collateralCurrency.symbol}</td>
            </tr>
            <tr>
                <th>Interest Rate</th>
                <td>${data.interestRate}% per annum</td>
            </tr>
            <tr>
                <th>Term</th>
                <td>${data.termMonths} months</td>
            </tr>
            <tr>
                <th>Origination Date</th>
                <td>${data.originationDate.toLocaleDateString()}</td>
            </tr>
            <tr>
                <th>Maturity Date</th>
                <td>${data.maturityDate.toLocaleDateString()}</td>
            </tr>
        </table>
    </div>

    <div class="terms">
        <h3>TERMS AND CONDITIONS</h3>
        <ol>
            <li><strong>Collateral:</strong> The borrower pledges ${data.collateralAmount} ${data.collateralCurrency.symbol} as collateral for this loan.</li>
            <li><strong>Interest:</strong> Interest accrues at ${data.interestRate}% per annum and is payable in full at maturity.</li>
            <li><strong>Repayment:</strong> The borrower must repay the full principal plus interest by the maturity date.</li>
            <li><strong>Liquidation:</strong> If the loan-to-value ratio exceeds 70%, the platform may liquidate the collateral.</li>
            <li><strong>Platform Guarantee:</strong> The platform guarantees 100% repayment to the lender.</li>
            <li><strong>Early Repayment:</strong> Borrower may repay early without penalty, but full interest applies.</li>
            <li><strong>Default:</strong> Failure to repay by maturity date will result in automatic liquidation.</li>
        </ol>
    </div>

    <div class="signature-section">
        <div class="signature-box">
            <h4>Borrower Signature</h4>
            <p>Name: ${data.borrower.name}</p>
            <p>Date: ________________</p>
            <p>Signature: ________________</p>
        </div>
        <div class="signature-box">
            <h4>Lender Signature</h4>
            <p>Name: ${data.lender.name}</p>
            <p>Date: ________________</p>
            <p>Signature: ________________</p>
        </div>
    </div>

    <div style="margin-top: 40px; font-size: 12px; color: #666;">
        <p><em>This agreement is governed by the terms and conditions of the CryptoGadai platform.
        For complete terms, please refer to our Terms of Service.</em></p>
        <p><em>Generated on: ${new Date().toLocaleString()}</em></p>
    </div>
</body>
</html>`;

    return template;
  }

  private async generateDocumentContent(data: LoanAgreementData): Promise<string> {
    return await this.generateHtmlContent(data);
  }
}
