import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class RegisterTenantDto {
  @ApiProperty({ description: 'Tenant identifier' })
  @IsString()
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Metadata describing external integrations', type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Settings patch that will merge into tenant settings', type: Object })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
