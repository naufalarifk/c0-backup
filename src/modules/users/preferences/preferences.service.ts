import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { UserPreferencesDto } from './dto/user-preferences.dto';

@Injectable()
export class PreferencesService {
  constructor(private readonly repo: CryptogadaiRepository) {}

  async getPreferences(userId: string) {
    try {
      const preferences = await this.repo.userGetsPreferences({ userId });

      return {
        success: true,
        data: {
          notifications: preferences.notifications,
          display: preferences.display,
          privacy: preferences.privacy,
        },
      };
    } catch (error) {
      console.error('PreferencesService.getPreferences', error);
      throw error;
    }
  }

  async updatePreferences(userId: string, preferences: UserPreferencesDto) {
    try {
      const result = await this.repo.userUpdatesPreferences({
        userId,
        preferences,
        updateDate: new Date(),
      });

      // Get updated preferences to return
      const updatedPreferences = await this.repo.userGetsPreferences({ userId });

      return {
        success: true,
        data: {
          notifications: updatedPreferences.notifications,
          display: updatedPreferences.display,
          privacy: updatedPreferences.privacy,
        },
      };
    } catch (error) {
      console.error('PreferencesService.updatePreferences', error);
      throw error;
    }
  }
}
