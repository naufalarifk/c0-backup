import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

import { HdWalletService } from './hdwallet.service';
import {
  AccountResponseDto,
  AddressResponseDto,
  BalanceResponseDto,
  BitcoinSignatureResponseDto,
  CreateAccountDto,
  EthereumSignatureResponseDto,
  GenerateAddressDto,
  GenerateWalletDto,
  HealthResponseDto,
  MultiChainWalletResponseDto,
  RestoreWalletDto,
  SignBitcoinTransactionDto,
  SignEthereumTransactionDto,
  SignSolanaTransactionDto,
  SolanaSignatureResponseDto,
  WalletResponseDto,
} from './hdwalletdto';
import { WalletExceptionFilter } from './wallet-exception.filter';

//to-do refactor code to be readable

@ApiTags('wallet')
@Controller('wallet')
@UseFilters(WalletExceptionFilter)
@ApiExtraModels(
  WalletResponseDto,
  AccountResponseDto,
  AddressResponseDto,
  BalanceResponseDto,
  BitcoinSignatureResponseDto,
  EthereumSignatureResponseDto,
  SolanaSignatureResponseDto,
  MultiChainWalletResponseDto,
  HealthResponseDto,
)
@ApiProduces('application/json')
@ApiConsumes('application/json')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(private readonly walletService: HdWalletService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Health check for wallet service',
    description:
      'Returns the current status and health of the wallet service. Used for monitoring and load balancer health checks.',
    operationId: 'getWalletHealth',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet service is healthy and operational',
    schema: {
      $ref: getSchemaPath(HealthResponseDto),
    },
  })
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      message: 'Wallet service is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('generate-wallet')
  @ApiOperation({
    summary: 'Generate a multi-chain wallet',
    description:
      'Generates addresses, public keys, and private keys for Bitcoin, Ethereum, and Solana networks',
    operationId: 'generateMultiChainWallet',
  })
  @ApiBody({ type: GenerateWalletDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Multi-chain wallet generated successfully',
    schema: {
      $ref: getSchemaPath(MultiChainWalletResponseDto),
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid blockchain key or parameters',
  })
  async generateWalletElaborate(
    @Body() generateWalletDto: GenerateWalletDto,
  ): Promise<MultiChainWalletResponseDto> {
    try {
      const walletResult = await this.walletService.generateWalletElaborate({
        blockchainKey: generateWalletDto.blockchainKey,
      });

      return {
        addresses: walletResult.addresses,
        publicKeys: walletResult.publicKeys,
        privateKeys: walletResult.privateKeys,
        derivationPaths: walletResult.derivationPaths,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to generate wallet', error);
      throw new HttpException(
        `Failed to generate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('/demonstrate')
  @ApiOperation({
    summary: 'Demonstrate wallet usage',
    description: 'Demonstrates wallet generation and balance checking functionality',
    operationId: 'demonstrateWalletUsage',
  })
  @ApiBody({ type: GenerateWalletDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wallet demonstration completed successfully',
    schema: {
      $ref: getSchemaPath(MultiChainWalletResponseDto),
    },
  })
  demonstrateUsage(@Body() generateWalletDto: GenerateWalletDto) {
    try {
      return this.walletService.demonstrateUsage(generateWalletDto.blockchainKey);
    } catch (err: unknown) {
      this.logger.error('Failed to demonstrate usage', err);
      throw new HttpException('Failed to demonstrate usage', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('sign-bitcoin-transaction')
  @ApiOperation({
    summary: 'Sign a Bitcoin transaction',
    description: 'Signs a Bitcoin transaction with the provided inputs, outputs, and private key',
    operationId: 'signBitcoinTransaction',
  })
  @ApiBody({ type: SignBitcoinTransactionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bitcoin transaction signed successfully',
    schema: {
      $ref: getSchemaPath(BitcoinSignatureResponseDto),
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid transaction data or private key',
  })
  async signBitcoinTransaction(
    @Body() signBitcoinDto: SignBitcoinTransactionDto,
  ): Promise<BitcoinSignatureResponseDto> {
    try {
      return await this.walletService.signBitcoinTransaction(
        signBitcoinDto.inputs,
        signBitcoinDto.outputs,
        signBitcoinDto.privateKey,
        signBitcoinDto.feeRate,
      );
    } catch (error) {
      this.logger.error('Failed to sign Bitcoin transaction', error);
      throw new HttpException(
        `Failed to sign Bitcoin transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('sign-ethereum-transaction')
  @ApiOperation({
    summary: 'Sign an Ethereum transaction',
    description: 'Signs an Ethereum transaction with the provided parameters and private key',
    operationId: 'signEthereumTransaction',
  })
  @ApiBody({ type: SignEthereumTransactionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ethereum transaction signed successfully',
    schema: {
      $ref: getSchemaPath(EthereumSignatureResponseDto),
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid transaction data or private key',
  })
  async signEthereumTransaction(
    @Body() signEthereumDto: SignEthereumTransactionDto,
  ): Promise<EthereumSignatureResponseDto> {
    try {
      const params = {
        to: signEthereumDto.to,
        value: signEthereumDto.value,
        gasLimit: signEthereumDto.gasLimit,
        gasPrice: signEthereumDto.gasPrice,
        data: signEthereumDto.data,
      };

      return await this.walletService.signEthereumTransaction(params, signEthereumDto.privateKey);
    } catch (error) {
      this.logger.error('Failed to sign Ethereum transaction', error);
      throw new HttpException(
        `Failed to sign Ethereum transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('sign-solana-transaction')
  @ApiOperation({
    summary: 'Sign a Solana transaction',
    description: 'Signs a Solana transaction with the provided parameters and private key',
    operationId: 'signSolanaTransaction',
  })
  @ApiBody({ type: SignSolanaTransactionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Solana transaction signed successfully',
    schema: {
      $ref: getSchemaPath(SolanaSignatureResponseDto),
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid transaction data or private key',
  })
  async signSolanaTransaction(
    @Body() signSolanaDto: SignSolanaTransactionDto,
  ): Promise<SolanaSignatureResponseDto> {
    try {
      const params = {
        to: signSolanaDto.to,
        amount: signSolanaDto.amount,
        memo: signSolanaDto.memo,
      };

      return await this.walletService.signSolanaTransaction(params, signSolanaDto.privateKey);
    } catch (error) {
      this.logger.error('Failed to sign Solana transaction', error);
      throw new HttpException(
        `Failed to sign Solana transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('get-balances')
  @ApiOperation({
    summary: 'Get wallet balances for all chains',
    description: 'Retrieves balances for Bitcoin, Ethereum, and Solana addresses',
    operationId: 'getWalletBalances',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        addresses: {
          type: 'object',
          properties: {
            btc: { type: 'string', example: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2' },
            eth: { type: 'string', example: '0x742d35Cc6aB1C0532F4c7D7B8b1F6B7E0C7b8A8B' },
            solana: { type: 'string', example: '11111111111111111111111111111112' },
          },
          required: ['btc', 'eth', 'solana'],
        },
      },
      required: ['addresses'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Balances retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        btc: { type: 'object' },
        eth: { type: 'string' },
        solana: { type: 'number' },
      },
    },
  })
  async getBalances(
    @Body() body: { addresses: { btc: string; eth: string; solana: string } },
  ): Promise<{ btc: unknown; eth: string; solana: number }> {
    try {
      return await this.walletService.getWalletBalances(body.addresses);
    } catch (error) {
      this.logger.error('Failed to get balances', error);
      throw new HttpException(
        `Failed to get balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
