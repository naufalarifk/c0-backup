import { Injectable } from '@nestjs/common';

@Injectable()
export class InstitutionsService {
  apply() {
    return { message: 'Application received' };
  }
}
