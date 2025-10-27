import { ApiProperty } from '@nestjs/swagger';

export class PaymentsWebhookDto {
  @ApiProperty({
    description: 'Event type (payment_succeeded, payment_failed, etc.)',
  })
  event: string;

  @ApiProperty({ description: 'Webhook payload data', type: Object })
  data: Record<string, any>;
}
