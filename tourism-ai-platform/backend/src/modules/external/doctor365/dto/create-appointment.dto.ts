import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

const CHANNELS = ['in_person', 'video', 'phone'] as const;

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'Doktor365 patient identifier (returned by sync endpoint)',
    example: 'd365_pat_123456',
  })
  @IsString()
  @Length(3, 120)
  doktor365PatientId!: string;

  @ApiProperty({
    description: 'Doktor365 provider identifier',
    example: 'd365_doc_987',
  })
  @IsString()
  @Length(3, 120)
  doktor365ProviderId!: string;

  @ApiProperty({
    description:
      'Local appointment identifier to enforce idempotency across retries',
    example: 'b548a573-2bc4-4b11-b136-f7b18286fd32',
  })
  @IsUUID()
  appointmentId!: string;

  @ApiProperty({
    description: 'Scheduled start timestamp in ISO-8601 format (UTC)',
    example: '2024-05-01T08:30:00.000Z',
  })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({
    description: 'Appointment delivery channel',
    enum: CHANNELS,
    default: 'in_person',
  })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: (typeof CHANNELS)[number];

  @ApiPropertyOptional({
    description:
      'Concise appointment notes (automatically redacted in logs, avoid PII)',
    example: 'Initial consultation for dental veneers package',
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
