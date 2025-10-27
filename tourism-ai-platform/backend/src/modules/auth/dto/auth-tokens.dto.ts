import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken!: string;

  @ApiProperty({
    description: 'Access token lifetime in seconds',
    example: 3600,
  })
  expiresIn!: number;
}

export class LoginUserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  scopes!: string[];
}

export class LoginResponseDto extends AuthTokensDto {
  @ApiProperty({ type: LoginUserSummaryDto })
  user!: LoginUserSummaryDto;
}
