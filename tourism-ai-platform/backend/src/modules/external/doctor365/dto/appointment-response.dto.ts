import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AppointmentProxyResponseDto {
  @ApiProperty({
    description: 'Doktor365 appointment identifier',
  })
  doktor365AppointmentId!: string;

  @ApiProperty({
    description: 'Platform appointment identifier used for idempotency',
  })
  appointmentId!: string;

  @ApiProperty({
    description: 'Doktor365 scheduling status',
    example: 'confirmed',
  })
  status!: string;

  @ApiProperty({
    description: 'Scheduled start datetime in ISO-8601 format (UTC)',
  })
  scheduledAt!: string;

  @ApiPropertyOptional({
    description: 'Optional location or telemedicine link returned by Doktor365',
  })
  location?: string;
}
