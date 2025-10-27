import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsObject, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class TenantDto {
  @ApiProperty({ description: 'Tenant identifier' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Human friendly name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Short code used in routing/URLs' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ description: 'Feature flags and environment configuration' })
  @IsObject()
  settings: Record<string, unknown> = {};

  @ApiPropertyOptional({ description: 'Whether tenant is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Creation timestamp' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAt?: Date;

  @ApiPropertyOptional({ description: 'Last updated timestamp' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  updatedAt?: Date;
}
