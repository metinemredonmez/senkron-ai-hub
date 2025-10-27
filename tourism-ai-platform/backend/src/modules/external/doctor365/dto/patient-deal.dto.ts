import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class PatientDealDto {
  @ApiProperty({
    description: 'Doktor365 patient identifier',
    example: 'd365_pat_123456',
  })
  @IsString()
  @Length(3, 120)
  doktor365PatientId!: string;

  @ApiProperty({
    description: 'Doktor365 deal identifier',
    example: 'D-123',
  })
  @IsString()
  @Length(1, 80)
  dealId!: string;

  @ApiProperty({
    description: 'Deal note type provided to Doktor365',
    example: 'text',
  })
  @IsString()
  @Length(1, 40)
  noteType!: string;

  @ApiPropertyOptional({
    description: 'Optional annotation stored alongside the deal',
    example: 'Patient accepted the premium veneer package upgrade.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
