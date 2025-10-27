import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ProviderQueryDto {
  @ApiPropertyOptional({
    description: 'Filter providers by medical specialty code',
    example: 'CARD',
  })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({
    description: 'Filter providers supporting a given language (ISO 639-1 code)',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Filter by destination country (ISO 3166-1 alpha-2)',
    example: 'TR',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Requested accreditation tags',
    example: ['JCI', 'ISO9001'],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? String(value).split(',') : undefined,
  )
  @IsArray()
  accreditationTags?: string[];

  @ApiPropertyOptional({
    description: 'Results page (1-indexed)',
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 1))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Results page size',
    default: 20,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 20))
  @IsInt()
  @IsPositive()
  @Max(100)
  size?: number = 20;
}
