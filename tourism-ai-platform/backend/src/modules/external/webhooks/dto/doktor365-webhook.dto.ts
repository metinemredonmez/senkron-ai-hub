import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class Doktor365WebhookDto {
  @ApiProperty({
    description: 'Event type emitted by Doktor365',
    enum: ['patient.updated', 'appointment.status.changed'],
  })
  event!: string;

  @ApiProperty({
    description: 'Payload body provided by Doktor365 for the event',
    type: Object,
  })
  data!: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Optional tenant identifier provided by Doktor365',
  })
  tenantId?: string;
}
