import { ApiProperty } from '@nestjs/swagger';

export class PaymentStatusDto {
  @ApiProperty({ description: 'Payment identifier assigned by the system', example: 'pay_abc123' })
  id: string;

  @ApiProperty({ description: 'Current status of the payment', example: 'pending' })
  status: string;

  @ApiProperty({ description: 'Amount captured or awaiting capture', example: 150.5 })
  amount: number;

  @ApiProperty({ description: 'Currency associated with the payment', example: 'USD' })
  currency: string;

  @ApiProperty({
    description: 'Optional metadata or gateway specific payload',
    required: false,
    type: Object,
  })
  metadata?: Record<string, unknown>;
}
