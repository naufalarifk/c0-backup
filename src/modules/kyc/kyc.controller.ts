import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { CreateKycDto } from './dto/create-kyc.dto';
import { UpdateKycDto } from './dto/update-kyc.dto';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post()
  create(@Body() createKycDto: CreateKycDto) {
    return this.kycService.create(createKycDto);
  }

  @Get()
  findAll() {
    return this.kycService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.kycService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateKycDto: UpdateKycDto) {
    return this.kycService.update(+id, updateKycDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.kycService.remove(+id);
  }
}
