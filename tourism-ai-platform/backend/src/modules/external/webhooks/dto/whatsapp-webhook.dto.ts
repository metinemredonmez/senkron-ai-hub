import { ApiProperty } from '@nestjs/swagger';

export class WhatsappWebhookDto {
  @ApiProperty({ description: 'Message type (text, image, etc.)' })
  type: string;

  @ApiProperty({ description: 'Sender phone number' })
  from: string;

  @ApiProperty({ description: 'Message content' })
  body: any;
}
