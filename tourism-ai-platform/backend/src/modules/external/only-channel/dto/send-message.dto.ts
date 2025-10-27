import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Identifier of the conversation in OnlyChannel/Chat365',
    example: 'conv_01HYGW2C8BZ6FK4',
  })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({
    description: 'Message payload to be delivered to the recipient',
    example: 'Hello from Synchron AI!',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({
    description: 'Optional channel (e.g. whatsapp, web, sms)',
    example: 'whatsapp',
  })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata forwarded to OnlyChannel',
    example: { locale: 'tr-TR', priority: 'high' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Raw payload delivered to OnlyChannel when sending complex messages',
    example: { templateId: 'welcome', parameters: ['Emre'] },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
