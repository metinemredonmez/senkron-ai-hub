import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AgentCapabilityDto {
  @ApiProperty({ description: 'Capability name exposed by the agent', example: 'triage' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Human-readable description of the capability' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Semantic version for the capability payloads' })
  @IsOptional()
  @IsString()
  version?: string;
}

export class AgentDto {
  @ApiProperty({ description: 'Unique agent identifier registered with the hub' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Internal agent name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'REST base endpoint the orchestrator will call' })
  @IsUrl()
  endpoint!: string;

  @ApiPropertyOptional({ description: 'Display friendly name for UI surfaces' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Current version hash for the agent' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: 'Owning team or business unit' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiPropertyOptional({ type: [AgentCapabilityDto], description: 'Declared capabilities supported by the agent' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentCapabilityDto)
  capabilities: AgentCapabilityDto[] = [];

  @ApiPropertyOptional({ description: 'Supported inbound channels (email, whatsapp, web, ...)' })
  @IsArray()
  @IsString({ each: true })
  supportedChannels: string[] = [];

  @ApiPropertyOptional({ description: 'Tenants this agent is available for' })
  @IsArray()
  @IsString({ each: true })
  tenants: string[] = [];

  @ApiPropertyOptional({ description: 'Arbitrary metadata entries' })
  metadata: Record<string, unknown> = {};
}
