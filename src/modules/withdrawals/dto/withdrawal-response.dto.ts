import { ApiProperty } from '@nestjs/swagger';

export class WithdrawalCreatedResponseDto {
  @ApiProperty({
    description: 'Withdrawal ID',
    example: '1234',
  })
  id: string;

  @ApiProperty({
    description: 'Withdrawal status',
    example: 'Requested',
    enum: ['Requested', 'Sent', 'Confirmed', 'Failed', 'RefundApproved', 'RefundRejected'],
  })
  status: string;

  @ApiProperty({
    description: 'Amount requested for withdrawal',
    example: '1500.50',
  })
  requestAmount: string;

  @ApiProperty({
    description: 'Withdrawal fee amount',
    example: '7.50',
  })
  feeAmount: string;

  @ApiProperty({
    description: 'Net amount after fees',
    example: '1493.00',
  })
  netAmount: string;

  @ApiProperty({
    description: 'Currency blockchain key',
    example: 'eip155:56',
  })
  currencyBlockchainKey: string;

  @ApiProperty({
    description: 'Currency token ID',
    example: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
  })
  currencyTokenId: string;

  @ApiProperty({
    description: 'Beneficiary ID',
    example: '33',
  })
  beneficiaryId: string;

  @ApiProperty({
    description: 'Request timestamp',
    example: '2025-09-19T06:30:00.000Z',
  })
  requestDate: string;

  @ApiProperty({
    description: 'Estimated processing time in minutes',
    example: 30,
  })
  estimatedProcessingTime: number;
}

// New response DTOs matching the JSON structure
export class WithdrawalCurrencyDto {
  @ApiProperty({ example: 'eip155:56' })
  blockchainKey: string;

  @ApiProperty({ example: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d' })
  tokenId: string;

  @ApiProperty({ example: 'Binance-Peg USD Coin' })
  name: string;

  @ApiProperty({ example: 'USDC' })
  symbol: string;

  @ApiProperty({ example: 18 })
  decimals: number;

  @ApiProperty({ example: 'https://cryptologos.cc/logos/tether-usdt-logo.png', required: false })
  logoUrl?: string;
}

export class WithdrawalBlockchainDto {
  @ApiProperty({ example: 'eip155:56' })
  key: string;

  @ApiProperty({ example: 'Binance Smart Chain' })
  name: string;

  @ApiProperty({ example: 'BSC' })
  shortName: string;

  @ApiProperty({ example: 'https://cryptologos.cc/logos/bnb-bnb-logo.png', required: false })
  image?: string;
}

export class WithdrawalBeneficiaryDto {
  @ApiProperty({ example: '301' })
  id: string;

  @ApiProperty({ example: 'eip155:56' })
  blockchainKey: string;

  @ApiProperty({ example: '0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567' })
  address: string;

  @ApiProperty({ example: 'My BSC Hardware Wallet', required: false })
  label?: string;

  @ApiProperty({ example: '2025-08-01T12:00:00Z' })
  createdDate: Date;

  @ApiProperty({ example: '2025-08-01T12:30:00Z', required: false })
  verifiedDate?: Date;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ type: WithdrawalBlockchainDto })
  blockchain: WithdrawalBlockchainDto;
}

export class WithdrawalRecordDto {
  @ApiProperty({ example: '501' })
  id: string;

  @ApiProperty({ type: WithdrawalCurrencyDto })
  currency: WithdrawalCurrencyDto;

  @ApiProperty({ type: WithdrawalBeneficiaryDto })
  beneficiary: WithdrawalBeneficiaryDto;

  @ApiProperty({ example: '1000.000000000000000000' })
  requestAmount: string;

  @ApiProperty({ example: '995.000000000000000000', required: false })
  sentAmount?: string;

  @ApiProperty({ example: '5.000000000000000000', required: false })
  networkFee?: string;

  @ApiProperty({ example: '0.000000000000000000', required: false })
  platformFee?: string;

  @ApiProperty({ example: '2025-08-11T14:00:00Z' })
  requestDate: Date;

  @ApiProperty({ example: '2025-08-11T14:15:00Z', required: false })
  sentDate?: Date;

  @ApiProperty({
    example: '0xdef456789abcdef123456789abcdef123456789abcdef123456789abcdef1234',
    required: false,
  })
  sentHash?: string;

  @ApiProperty({ example: '2025-08-11T15:00:00Z', required: false })
  confirmedDate?: Date;

  @ApiProperty({ example: null, required: false })
  failedDate?: Date;

  @ApiProperty({ example: null, required: false })
  failureReason?: string;

  @ApiProperty({
    example: 'confirmed',
    enum: ['requested', 'sent', 'confirmed', 'failed', 'refund_approved', 'refund_rejected'],
  })
  state: string;

  @ApiProperty({
    example:
      'https://bscscan.com/tx/0xdef456789abcdef123456789abcdef123456789abcdef123456789abcdef1234',
    required: false,
  })
  blockchainExplorerUrl?: string;

  @ApiProperty({ example: null, required: false })
  estimatedConfirmationTime?: string;
}

export class WithdrawalPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  total: number;

  @ApiProperty({ example: 1 })
  totalPages: number;

  @ApiProperty({ example: false })
  hasNext: boolean;

  @ApiProperty({ example: false })
  hasPrev: boolean;
}

export class WithdrawalsListResponseDto {
  @ApiProperty({ type: [WithdrawalRecordDto] })
  withdrawals: WithdrawalRecordDto[];

  @ApiProperty({ type: WithdrawalPaginationDto })
  pagination: WithdrawalPaginationDto;
}

export class WithdrawalValidationResponseDto {
  @ApiProperty({
    description: 'Whether withdrawal is valid',
    example: true,
  })
  isValid: boolean;

  @ApiProperty({
    description: 'Validation error message if invalid',
    example: 'Insufficient balance',
    required: false,
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Available account balance',
    example: '2500.75',
  })
  availableBalance: string;

  @ApiProperty({
    description: 'Current withdrawal limits',
  })
  limits: {
    minAmount: string;
    maxAmount: string;
    dailyLimit: string;
    remainingDailyLimit: string;
  };

  @ApiProperty({
    description: 'Fee breakdown',
  })
  fees: {
    platformFee: string;
    networkFee: string;
    totalFee: string;
    feePercentage: string;
  };
}

export class WithdrawalRefundRequestResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Refund request submitted successfully. Admin approval required.',
  })
  message: string;

  @ApiProperty({
    description: 'Withdrawal ID',
    example: '1234',
  })
  withdrawalId: string;

  @ApiProperty({
    description: 'Current status after refund request',
    example: 'RefundRequested',
  })
  status: string;

  @ApiProperty({
    description: 'Estimated processing time for admin review',
    example: '1-3 business days',
  })
  estimatedProcessingTime: string;
}
