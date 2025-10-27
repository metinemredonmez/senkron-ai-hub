import { Module } from '@nestjs/common';
import { PrometheusModule } from '../../lib/nestjs-prometheus';
import { RedisModule } from '@/lib/nestjs-redis';
import { KafkaModule } from '@/lib/nestjs-kafka';
import { EncryptionModule } from '@/lib/nestjs-encryption';
import { OtelModule } from '@/lib/nestjs-otel';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [PrometheusModule, RedisModule, KafkaModule, EncryptionModule, OtelModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
