import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderSummaryDto {
  @ApiProperty({ description: 'Doktor365 provider identifier' })
  id!: string;

  @ApiProperty({ description: 'Display name' })
  name!: string;

  @ApiProperty({ description: 'Medical specialty canonical code' })
  specialty!: string;

  @ApiPropertyOptional({ description: 'Primary location / city' })
  location?: string;

  @ApiPropertyOptional({
    description: 'Supported languages (ISO 639-1 codes)',
    type: [String],
  })
  languageSupport?: string[];

  @ApiPropertyOptional({ description: 'Accreditation details' })
  accreditation?: string;

  @ApiPropertyOptional({ description: 'Average patient rating (0-5)' })
  rating?: number;
}
