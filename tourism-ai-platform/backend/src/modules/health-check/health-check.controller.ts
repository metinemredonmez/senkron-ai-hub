import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RedisHealthIndicator } from './redis.health-indicator';
import { HealthStatusDto } from './dto/health-status.dto';

@ApiTags('health')
@Controller('health')
export class HealthCheckController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe for core dependencies' })
  @ApiResponse({
    status: 200,
    description: 'Service health information',
    type: HealthStatusDto,
  })
  async readiness(): Promise<HealthStatusDto> {
    const result = await this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
    return {
      status: result.status ?? 'ok',
      details: result.details as HealthStatusDto['details'],
    };
  }
}
