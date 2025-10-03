import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import {
  CreatePushTokenDto,
  CreatePushTokenResponseDto,
  DeletePushTokenResponseDto,
  ListPushTokensQueryDto,
  ListPushTokensResponseDto,
  UpdatePushTokenDto,
  UpdatePushTokenResponseDto,
} from '../dto/push-tokens.dto';

@Injectable()
export class PushTokensService {
  constructor(private readonly repository: CryptogadaiRepository) {}

  /**
   * Create or update push token for current device and session
   */
  async createToken(userId: string, dto: CreatePushTokenDto): Promise<CreatePushTokenResponseDto> {
    const result = await this.repository.userRegisterPushToken({
      userId,
      pushToken: dto.pushToken,
      deviceId: dto.deviceId,
      deviceType: dto.deviceType,
      deviceName: dto.deviceName,
      deviceModel: dto.deviceModel,
      currentSessionId: dto.currentSessionId,
      registeredDate: new Date(dto.registeredDate),
    });

    return {
      success: true,
      tokenId: result.id,
      message: result.isNew ? 'Push token created successfully' : 'Push token updated successfully',
      isNew: result.isNew,
    };
  }

  /**
   * Delete push token (soft cleanup - nullify session reference)
   */
  async deleteToken(userId: string, currentSessionId: string): Promise<DeletePushTokenResponseDto> {
    const result = await this.repository.userUnregisterPushToken({
      userId,
      currentSessionId,
    });

    return {
      success: true,
      message:
        result.tokensUpdated > 0
          ? 'Push token deleted successfully'
          : 'No active push token found for this session',
      tokensDeleted: result.tokensUpdated,
    };
  }

  /**
   * Update push token (update last_used_date and session reference)
   */
  async updateToken(userId: string, dto: UpdatePushTokenDto): Promise<UpdatePushTokenResponseDto> {
    const result = await this.repository.userSyncPushToken({
      userId,
      pushToken: dto.pushToken,
      deviceId: dto.deviceId,
      currentSessionId: dto.currentSessionId,
      lastUsedDate: new Date(dto.lastUsedDate),
    });

    return {
      success: true,
      tokensUpdated: result.tokensSynced,
    };
  }

  /**
   * List push tokens for user
   */
  async listUserTokens(
    userId: string,
    query: ListPushTokensQueryDto,
  ): Promise<ListPushTokensResponseDto> {
    const { tokens } = await this.repository.platformViewsPushTokens({
      userId,
      activeOnly: query.activeOnly,
    });

    return {
      tokens: tokens.map(token => ({
        ...token,
        lastUsedDate: token.lastUsedDate.toISOString(),
      })),
    };
  }
}
