import type { Request, Response } from 'express';

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { fromNodeHeaders } from 'better-auth/node';
import { v7 as uuidv7 } from 'uuid';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../../shared/services/app-config.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { Public } from '../auth.decorator';
import { AuthService } from '../auth.service';
import { GoogleNativeSignInDto } from '../dto/google-native-sign-in.dto';
import {
  GoogleNativeLinkResponseDto,
  GoogleNativeSignInResponseDto,
} from '../dto/google-native-sign-in-response.dto';
import { GoogleTokenVerifierService } from '../services/google-token-verifier.service';

@ApiTags('Authentication - Native Google')
@Controller('auth/google')
export class GoogleNativeAuthController {
  private readonly logger = new TelemetryLogger(GoogleNativeAuthController.name);

  constructor(
    private readonly googleVerifier: GoogleTokenVerifierService,
    private readonly authService: AuthService,
    private readonly repo: CryptogadaiRepository,
    private readonly configService: AppConfigService,
  ) {}

  @Public()
  @Post('native')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Native Google Sign-In',
    description: 'Authenticate using Google ID token from native mobile SDK',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated',
    type: GoogleNativeSignInResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async nativeSignIn(
    @Body() dto: GoogleNativeSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoogleNativeSignInResponseDto> {
    try {
      // Verify the ID token with Google
      const payload = await this.googleVerifier.verifyIdToken(dto.idToken);
      const userInfo = this.googleVerifier.extractUserInfo(payload);

      this.logger.log('Native Google sign-in initiated', { email: userInfo.email });

      // Check if account exists with this provider
      const existingAccount = await this.repo.betterAuthFindOneAccount([
        { field: 'providerId', value: 'google' },
        { field: 'accountId', value: userInfo.googleId },
      ]);

      let userId: string;

      if (existingAccount) {
        // User exists with this Google account
        userId = String(existingAccount.userId);
        this.logger.log('Existing Google account found', { userId });
      } else {
        // Check if user exists with this email
        const existingUser = await this.repo.betterAuthFindOneUser([
          { field: 'email', value: userInfo.email },
        ]);

        if (existingUser) {
          // Link the Google account to existing user
          userId = String(existingUser.id);
          await this.repo.betterAuthCreateAccount({
            userId,
            providerId: 'google',
            accountId: userInfo.googleId,
          });
          this.logger.log('Linked Google account to existing user', { userId });
        } else {
          // Create new user with Google account
          const newUser = await this.repo.betterAuthCreateUser({
            name: userInfo.name,
            email: userInfo.email,
            emailVerified: userInfo.emailVerified,
            image: userInfo.picture,
          });

          userId = String(newUser.id);

          // Create the Google account link
          await this.repo.betterAuthCreateAccount({
            userId,
            providerId: 'google',
            accountId: userInfo.googleId,
          });

          this.logger.log('Created new user with Google account', { userId });
        }
      }

      // Create Better Auth session manually
      const sessionToken = uuidv7();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const session = await this.repo.betterAuthCreateSession({
        id: uuidv7(),
        token: sessionToken,
        userId,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        ipAddress: req.ip || req.socket.remoteAddress || '',
        userAgent: req.headers['user-agent'] || '',
      });

      this.logger.log('Session created successfully', { userId });

      // Set session cookie manually
      const cookiePrefix = this.configService.authConfig.cookiePrefix;
      const cookieName = `${cookiePrefix}.session_token`;
      res.cookie(cookieName, sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      // Get user details
      const user = await this.repo.betterAuthFindOneUser([{ field: 'id', value: userId }]);

      const userEmail = (user?.email as string | undefined) || userInfo.email;
      const userName = (user?.name as string | undefined) || userInfo.name;
      const userImage = (user?.image as string | undefined) || userInfo.picture;

      return {
        user: {
          id: userId,
          email: userEmail,
          name: userName,
          image: userImage,
          emailVerified: true,
        },
        session: {
          token: sessionToken,
          expiresAt: expiresAt.toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Native Google sign-in failed', { error });
      throw error;
    }
  }

  @Public()
  @Post('native/link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Link Google Account (Native)',
    description: 'Link Google account to existing user using ID token from native SDK',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully linked account',
    type: GoogleNativeLinkResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid token or authentication required' })
  @ApiResponse({ status: 400, description: 'Email mismatch or account already linked' })
  async nativeLinkAccount(
    @Body() dto: GoogleNativeSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GoogleNativeLinkResponseDto> {
    try {
      // Verify the ID token
      const payload = await this.googleVerifier.verifyIdToken(dto.idToken);
      const userInfo = this.googleVerifier.extractUserInfo(payload);

      // Get current authenticated user
      const session = await this.authService.api.getSession({
        headers: req.headers,
      });

      if (!session?.user) {
        throw new UnauthorizedException('User must be authenticated to link account');
      }

      const userId = session.user.id;

      // Verify email matches
      if (session.user.email !== userInfo.email) {
        this.logger.warn('Email mismatch during account linking', {
          userId,
          sessionEmail: session.user.email,
          googleEmail: userInfo.email,
        });
        throw new BadRequestException(
          'Google email does not match your registered email. Please use the Google account associated with your email.',
        );
      }

      // Check if Google account is already linked to another user
      const existingAccount = await this.repo.betterAuthFindOneAccount([
        { field: 'providerId', value: 'google' },
        { field: 'accountId', value: userInfo.googleId },
      ]);

      if (existingAccount && String(existingAccount.userId) !== userId) {
        throw new BadRequestException(
          'This Google account is already linked to another user account.',
        );
      }

      if (existingAccount && String(existingAccount.userId) === userId) {
        // Already linked
        this.logger.log('Google account already linked', { userId });
        return {
          success: true,
          message: 'Google account is already linked to your account',
        };
      }

      // Link the account
      await this.repo.betterAuthCreateAccount({
        userId,
        providerId: 'google',
        accountId: userInfo.googleId,
      });

      this.logger.log('Linked Google account', { userId });

      return {
        success: true,
        message: 'Google account linked successfully',
      };
    } catch (error) {
      this.logger.error('Native Google account linking failed', { error });
      throw error;
    }
  }
}
