import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsObject, IsOptional, IsString } from 'class-validator';

export class HubEventDto {
  @ApiProperty({ description: 'Unique identifier for the event', example: 'evt-01HY4YAYZ6S9C8' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Tenant identifier used for routing', example: 'tenant-123' })
  @IsString()
  tenantId!: string;

  @ApiProperty({ description: 'Event type name, e.g. conversation.message' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Emitter of the event (agent/orchestrator/channel)', example: 'orchestrator' })
  @IsString()
  source!: string;

  @ApiProperty({ description: 'ISO timestamp for the event being emitted' })
  @IsDate()
  @Type(() => Date)
  timestamp!: Date;

  @ApiPropertyOptional({ description: 'Agent name that should handle the event', example: 'preop-agent' })
  @IsOptional()
  @IsString()
  targetAgent?: string;

  @ApiPropertyOptional({ description: 'Conversation/interaction channel', example: 'whatsapp' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ description: 'Optional session identifier when tracking multi-turn exchanges' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Correlation id to trace the lifecycle across systems' })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Payload delivered with the event' })
  @IsObject()
  payload: Record<string, unknown> = {};

  @ApiPropertyOptional({ description: 'Arbitrary metadata for downstream processors' })
  @IsObject()
  metadata: Record<string, unknown> = {};
}
