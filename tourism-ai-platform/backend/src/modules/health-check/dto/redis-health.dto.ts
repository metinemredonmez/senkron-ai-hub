import { ApiProperty } from '@nestjs/swagger';

export class RedisHealthDto {
  @ApiProperty({ description: 'Redis connection status', example: 'up' })
  status: string;

  @ApiProperty({
    description: 'Elapsed time in milliseconds for the Redis health probe',
    example: 12,
    required: false,
  })
  time?: number;

  @ApiProperty({
    description: 'Additional Redis connection details',
    required: false,
    type: Object,
  })
  info?: Record<string, unknown>;
}
