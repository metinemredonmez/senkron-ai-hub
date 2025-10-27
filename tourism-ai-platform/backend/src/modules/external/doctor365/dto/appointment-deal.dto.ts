import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class AppointmentDealDto {
  @ApiProperty({
    description: 'Doktor365 appointment identifier',
    example: 'd365_app_456',
  })
  @IsString()
  @Length(3, 120)
  doktor365AppointmentId!: string;

  @ApiProperty({
    description: 'Deal identifier to associate with the appointment',
    example: 'D-123',
  })
  @IsString()
  @Length(1, 80)
  dealId!: string;

  @ApiProperty({
    description: 'Type of content provided with the deal',
    example: 'text',
  })
  @IsString()
  @Length(1, 40)
  noteType!: string;

  @ApiPropertyOptional({
    description: 'Optional note body that accompanies the deal',
    example: 'Patient confirmed airport transfer requirements.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
