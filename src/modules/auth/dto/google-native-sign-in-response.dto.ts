import { ApiProperty } from '@nestjs/swagger';

export class GoogleNativeUserDto {
  @ApiProperty({ example: '52' })
  id: string;

  @ApiProperty({ example: 'kerajaanlogika@gmail.com' })
  email: string;

  @ApiProperty({ example: 'kerajaanlogika' })
  name: string;

  @ApiProperty({
    example:
      'https://lh3.googleusercontent.com/a/ACg8ocIWTydjnyQkmuAsWtRpVd3oYoNJtxfEfjcRQc8xM6d9iO_Lzw=s96-c',
  })
  image: string;

  @ApiProperty({ example: true })
  emailVerified: boolean;
}

export class GoogleNativeSessionDto {
  @ApiProperty({ example: '019a06a7-c73c-77bb-a2c0-72c0b5ac2877' })
  token: string;

  @ApiProperty({ example: '2025-10-28T12:04:10.172Z' })
  expiresAt: string;
}

export class GoogleNativeSignInResponseDto {
  @ApiProperty({ type: GoogleNativeUserDto })
  user: GoogleNativeUserDto;

  @ApiProperty({ type: GoogleNativeSessionDto })
  session: GoogleNativeSessionDto;
}

export class GoogleNativeLinkResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Google account linked successfully' })
  message: string;
}
