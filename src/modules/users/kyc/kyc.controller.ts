/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';

import { CreateKycDto } from './dto/create-kyc.dto';
import { UpdateKycDto } from './dto/update-kyc.dto';
import { KycService } from './kyc.service';

@Controller('users/:userId/kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get()
  async getKycStatus(@Param('userId') userId: string) {
    return await this.kycService.getKycByUserId(userId);
  }

  @Post()
  async submitKyc(@Param('userId') userId: string, @Body() createKycDto: CreateKycDto) {
    return await this.kycService.createKyc(userId, createKycDto);
  }

  @Put()
  async updateKyc(@Param('userId') userId: string, @Body() updateKycDto: UpdateKycDto) {
    return await this.kycService.updateKyc(userId, updateKycDto);
  }

  @Post('verify')
  async verifyKyc(@Param('userId') userId: string) {
    return await this.kycService.verifyKyc(userId);
  }

  @Post('reject')
  async rejectKyc(@Param('userId') userId: string, @Body('reason') reason: string) {
    return await this.kycService.rejectKyc(userId, reason);
  }

  @Get('documents')
  async getKycDocuments(@Param('userId') userId: string) {
    return await this.kycService.getDocuments(userId);
  }

  @Post('documents')
  async uploadDocument(@Param('userId') userId: string, @Body() documentData: any) {
    return await this.kycService.uploadDocument(userId, documentData);
  }
}
