import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthCheckController } from './health-check.controller';
import { RedisHealthIndicator } from './redis.health-indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthCheckController],
  providers: [RedisHealthIndicator],
})
export class HealthCheckModule {}
