import type { TokenPayload } from 'google-auth-library';

import { Injectable, UnauthorizedException } from '@nestjs/common';

import { OAuth2Client } from 'google-auth-library';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';

export interface GoogleTokenPayload extends TokenPayload {
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

@Injectable()
export class GoogleTokenVerifierService {
  private readonly logger = new TelemetryLogger(GoogleTokenVerifierService.name);
  private readonly client: OAuth2Client;
  private readonly acceptedAudiences: string[];

  constructor(private readonly configService: AppConfigService) {
    const { webClientId, androidClientId } = this.configService.googleClientIds;
    this.client = new OAuth2Client(webClientId);

    // Accept both web and Android client IDs as valid audiences
    this.acceptedAudiences = [webClientId, androidClientId].filter(Boolean);

    this.logger.log('GoogleTokenVerifier initialized with audiences:', this.acceptedAudiences);
  }

  /**
   * Verifies a Google ID token and returns the payload
   * @param idToken - The ID token from Google Sign-In
   * @returns The verified token payload
   * @throws UnauthorizedException if verification fails
   */
  async verifyIdToken(idToken: string): Promise<GoogleTokenPayload> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.acceptedAudiences,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        this.logger.warn('Token verification returned no payload');
        throw new UnauthorizedException('Invalid ID token: no payload');
      }

      // Validate issuer
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (!validIssuers.includes(payload.iss)) {
        this.logger.warn('Invalid token issuer', { issuer: payload.iss });
        throw new UnauthorizedException('Invalid ID token: invalid issuer');
      }

      // Validate email verification
      if (!payload.email_verified) {
        this.logger.warn('Email not verified', { email: payload.email });
        throw new UnauthorizedException('Email not verified with Google');
      }

      // Validate audience
      if (!this.acceptedAudiences.includes(payload.aud)) {
        this.logger.warn('Invalid audience', { audience: payload.aud });
        throw new UnauthorizedException('Invalid ID token: invalid audience');
      }

      this.logger.log('Token verified successfully', { sub: payload.sub, email: payload.email });

      return payload as GoogleTokenPayload;
    } catch (error) {
      this.logger.error('Token verification failed', { error });
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to verify Google ID token');
    }
  }

  /**
   * Extracts user information from verified token payload
   */
  extractUserInfo(payload: GoogleTokenPayload) {
    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name || '',
      picture: payload.picture || '',
      givenName: payload.given_name || '',
      familyName: payload.family_name || '',
    };
  }
}
