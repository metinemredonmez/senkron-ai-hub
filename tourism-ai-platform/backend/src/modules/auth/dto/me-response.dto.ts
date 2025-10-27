import { ApiProperty } from '@nestjs/swagger';
import { LoginUserSummaryDto } from './auth-tokens.dto';

export class MeResponseDto {
  @ApiProperty({ description: 'Tenant identifier resolved from the request context' })
  tenantId!: string;

  @ApiProperty({ type: LoginUserSummaryDto })
  user!: LoginUserSummaryDto;
}
