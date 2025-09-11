import { Controller, Post } from '@nestjs/common';

import { InstitutionsService } from './institutions.service';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  apply() {
    return this.institutionsService.apply();
  }
}
