import { ApiProperty } from '@nestjs/swagger';
import { RedisHealthDto } from './redis-health.dto';

class HealthComponentDto {
  @ApiProperty({ description: 'Component status', example: 'up' })
  status: string;

  @ApiProperty({
    description: 'Response time in milliseconds recorded by the health probe',
    example: 42,
    required: false,
  })
  time?: number;
}

class HealthDetailsDto {
  @ApiProperty({
    description: 'Primary database health status',
    required: false,
    type: () => HealthComponentDto,
  })
  database?: HealthComponentDto;

  @ApiProperty({
    description: 'Redis cache connectivity status',
    required: false,
    type: () => RedisHealthDto,
  })
  redis?: RedisHealthDto;

  @ApiProperty({
    description: 'Node.js memory heap usage status',
    required: false,
    type: () => HealthComponentDto,
  })
  memory_heap?: HealthComponentDto;
}

export class HealthStatusDto {
  @ApiProperty({ description: 'Overall health status for the service', example: 'ok' })
  status: string;

  @ApiProperty({
    description: 'Detailed health check status per dependency',
    type: () => HealthDetailsDto,
  })
  details: HealthDetailsDto;
}
