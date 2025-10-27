import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PatientSyncResponseDto {
  @ApiProperty({
    description: 'Doktor365 patient identifier to reuse for follow-up calls',
  })
  doktor365Id!: string;

  @ApiProperty({
    description: 'Platform patient identifier used to establish idempotency',
  })
  patientId!: string;

  @ApiProperty({
    description: 'Current synchronization status at Doktor365',
    example: 'active',
  })
  status!: string;

  @ApiProperty({
    description: 'ISO timestamp for when Doktor365 last confirmed the record',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: 'ISO timestamp when the platform last synchronized the record',
  })
  lastSyncedAt?: string;

  @ApiPropertyOptional({
    description: 'Known allergies stored at Doktor365',
    type: [String],
    example: ['penicillin'],
  })
  allergies?: string[];

  @ApiPropertyOptional({
    description: 'Recorded blood type (ABO/Rh)',
    example: 'O+',
  })
  bloodType?: string;

  @ApiPropertyOptional({
    description: 'Latest laboratory result payload returned by Doktor365',
    type: Object,
    example: { hemoglobin: { value: 13.5, unit: 'g/dL' } },
  })
  labResults?: Record<string, any>;
}
