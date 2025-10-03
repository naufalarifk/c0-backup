import { Injectable } from '@nestjs/common';

import { RedisService } from '../../shared/services/redis.service';

@Injectable()
export class IndexerEventService {
  constructor(private redis: RedisService) {}

  async addWallet(blockchainKey: string, tokenId: string, address: string, derivedPath: string) {
    await this.redis.publish(
      `indexer:${blockchainKey}:address:added`,
      JSON.stringify({ tokenId, address, derivedPath }),
    );
  }

  async removeWallet(blockchainKey: string, tokenId: string, address: string, derivedPath: string) {
    await this.redis.publish(
      `indexer:${blockchainKey}:address:removed`,
      JSON.stringify({ tokenId, address, derivedPath }),
    );
  }
}
