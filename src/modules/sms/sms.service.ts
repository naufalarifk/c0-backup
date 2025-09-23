import { Injectable } from '@nestjs/common';

import { CacheService } from '../../shared/services/cache.service';
import { ensureExists, ResponseHelper } from '../../shared/utils';

@Injectable()
export class SmsService {
  private readonly VERIFICATION_PREFIX = 'verification';

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get verification code for phone number (for testing/debugging)
   */
  async getVerificationCode(phoneNumber: string) {
    // Validate phone number format
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`;
    }

    const ids = await this.cacheService.get<string[]>(`list:${phoneNumber}`, {
      prefix: this.VERIFICATION_PREFIX,
    });
    ensureExists(ids !== null, 'No verification code found for this phone number');

    const message = await this.cacheService.get<{ value: string }>(`${ids!.at(-1)}`, {
      prefix: this.VERIFICATION_PREFIX,
    });
    ensureExists(message !== null, 'No verification code found for this phone number');

    return ResponseHelper.success('Verification code retrieved successfully', {
      phoneNumber,
      message: message!.value.split(':').shift() || 'No verification code found',
    });
  }
}
