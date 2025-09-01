import { Injectable } from '@nestjs/common';

import { CreateKycDto } from './dto/create-kyc.dto';
import { UpdateKycDto } from './dto/update-kyc.dto';

@Injectable()
export class KycService {
  create(createKycDto: CreateKycDto) {
    return 'This action adds a new kyc';
  }

  findAll() {
    return `This action returns all kyc`;
  }

  findOne(id: number) {
    return `This action returns a #${id} kyc`;
  }

  update(id: number, updateKycDto: UpdateKycDto) {
    return `This action updates a #${id} kyc`;
  }

  remove(id: number) {
    return `This action removes a #${id} kyc`;
  }
}
